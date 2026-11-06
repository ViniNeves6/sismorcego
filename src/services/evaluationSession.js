import { getIdTokenResult, onIdTokenChanged, signInWithCustomToken, signOut } from 'firebase/auth';
import { doc, getDocFromServer, onSnapshot } from 'firebase/firestore';
import { createEvaluationApi, validateEvaluationStatus } from './evaluationApi';

export const EVALUATION_UID = 'sismorcego-teste-coordenadores';
const failure = code => Object.assign(new Error('Não foi possível validar a avaliação.'), { code });
const fatalAuth = error => /user-disabled|user-token-expired|invalid-user-token|user-not-found/.test(error?.code || '');
const monotonicClock = () => global.performance.now();

export function assertEvaluationToken(user, token, serverTime) {
  if (user?.uid !== EVALUATION_UID || user.isAnonymous || token?.claims?.sismorcegoEvaluationAccount !== true ||
    !Number.isFinite(Date.parse(token.expirationTime)) || Date.parse(token.expirationTime) <= serverTime) throw failure('evaluation/unauthorized-session');
}

// Evaluation expiration never deletes Firebase persistence or the encrypted
// record queue. A later server extension can reuse or automatically restore Auth.
// Only a verified server response opens a bounded, monotonic-clock UI lease.
export function createEvaluationSession({ auth, db, projectId, backendEnabled, api = createEvaluationApi(),
  sdk = { getIdTokenResult, onIdTokenChanged, signInWithCustomToken, signOut, doc, getDocFromServer, onSnapshot },
  online = async () => true, clock = monotonicClock }) {
  let state = { status: 'checking', user: null, role: null, reason: null };
  let active = true, initialized = false, changingAuth = false, paused = false, revision = 0;
  let running, forced = false, followup, unsubscribe, leaseTimer, leaseDeadline = 0, lastServer, observedUid;
  let unsubscribeControl, watchedUid;
  const listeners = new Set();
  const emit = patch => { if (active) { state = { ...state, ...patch }; listeners.forEach(fn => fn(state)); } };
  const current = ticket => active && revision === ticket;
  const block = (status, reason = null) => {
    leaseDeadline = 0; clearTimeout(leaseTimer);
    emit({ status, user: null, role: null, reason });
  };
  const bounded = promise => {
    let timeout;
    return Promise.race([promise, new Promise((_, reject) => { timeout = setTimeout(() => reject(failure('network/timeout')), 15000); })])
      .finally(() => clearTimeout(timeout));
  };
  const trustedNow = () => lastServer ? lastServer.serverTime + Math.max(0, clock() - lastServer.receivedAt) : Infinity;
  function watchControl(user) {
    if (watchedUid === user?.uid) return;
    unsubscribeControl?.(); unsubscribeControl = null; watchedUid = user?.uid;
    if (user?.uid !== EVALUATION_UID || !sdk.onSnapshot) return;
    unsubscribeControl = sdk.onSnapshot(sdk.doc(db, 'configuracoes', 'avaliacaoCoordenadores'), { includeMetadataChanges: true }, snapshot => {
      if (!active || snapshot.metadata?.fromCache || auth.currentUser?.uid !== EVALUATION_UID) return;
      const data = snapshot.exists() ? snapshot.data() : null;
      const startAt = data?.startAt?.toMillis?.(), expiresAt = data?.expiresAt?.toMillis?.();
      // Cache snapshots never grant access. A matching first server snapshot
      // must not interrupt the tutorial; a policy change blocks then rechecks
      // through the trusted-clock backend before exposing protected screens.
      if (lastServer && data?.enabled === (['active', 'expired', 'not-started', 'blocked'].includes(lastServer.state)) &&
        startAt === lastServer.startAt && expiresAt === lastServer.expiresAt) return;
      block(data?.enabled === false ? 'suspended' : 'checking');
      revalidate(true);
    }, () => { if (active) revalidate(true); });
  }
  const acceptStatus = (status, startedAt) => {
    validateEvaluationStatus(status);
    lastServer = { ...status, receivedAt: clock() };
    if (status.state !== 'active') { block(status.state); return false; }
    // Subtract the full round trip, rather than granting extra time in transit.
    leaseDeadline = clock() + Math.min(status.leaseMs, status.expiresAt - status.serverTime) - Math.max(0, clock() - startedAt);
    if (leaseDeadline <= clock()) { block('expired'); return false; }
    return true;
  };
  async function resetFirebase() {
    changingAuth = true;
    try { await bounded(sdk.signOut(auth)); } finally { changingAuth = false; }
  }
  async function authenticate(ticket) {
    const startedAt = clock(), packet = await bounded(api.issue());
    if (!current(ticket) || !acceptStatus(packet, startedAt)) return null;
    if (packet.uid !== EVALUATION_UID || typeof packet.customToken !== 'string') throw failure('evaluation/unauthorized-session');
    changingAuth = true;
    try { return (await bounded(sdk.signInWithCustomToken(auth, packet.customToken))).user; }
    finally { changingAuth = false; }
  }
  function revalidate(force = false) {
    if (!active || paused || !initialized || !backendEnabled || !auth || !db) return Promise.resolve();
    if (running) {
      if (force && !forced && !followup) followup = running.catch(() => {}).then(() => { followup = null; return revalidate(true); });
      return followup || running;
    }
    const ticket = ++revision;
    if (state.status === 'ready' && leaseDeadline <= clock()) block('checking');
    const task = (async () => {
      try {
        if (!await online()) throw failure('network/offline');
        const startedAt = clock(), status = await bounded(api.status());
        if (!current(ticket) || !acceptStatus(status, startedAt)) return;
        let user = auth.currentUser;
        if (user && user.uid !== EVALUATION_UID) { await resetFirebase(); user = null; }
        if (!user) user = await authenticate(ticket);
        if (!current(ticket) || !user) return;
        let token;
        try { token = await bounded(sdk.getIdTokenResult(user, force)); }
        catch (error) {
          if (!fatalAuth(error)) throw error;
          // Revoking a refresh token is distinct from disabling the shared
          // account or suspending the evaluation. The server decides re-entry.
          await resetFirebase(); user = await authenticate(ticket);
          if (!current(ticket) || !user) return;
          token = await bounded(sdk.getIdTokenResult(user));
        }
        assertEvaluationToken(user, token, trustedNow());
        const profile = await bounded(sdk.getDocFromServer(sdk.doc(db, 'usuarios', user.uid)));
        if (!current(ticket)) return;
        if (!profile.exists() || profile.data()?.role !== 'coordenador') throw failure('evaluation/not-coordinator');
        const remaining = Math.min(leaseDeadline - clock(), Date.parse(token.expirationTime) - trustedNow());
        if (remaining <= 0) { block(trustedNow() >= lastServer.expiresAt ? 'expired' : 'offline'); return; }
        clearTimeout(leaseTimer);
        leaseTimer = setTimeout(() => {
          if (!active) return;
          block(trustedNow() >= lastServer.expiresAt ? 'expired' : 'checking');
          revalidate(true);
        }, remaining);
        emit({ status: 'ready', user, role: 'coordenador', reason: null });
      } catch (error) {
        if (!current(ticket)) return;
        const network = /network|timeout|offline/.test(error?.code || '');
        const transient = network || ['evaluation/unavailable', 'evaluation/rate-limited'].includes(error?.code);
        if (transient && state.status === 'ready' && clock() < leaseDeadline) return;
        if (transient && ['expired', 'suspended', 'not-started', 'blocked'].includes(state.status)) return;
        block(network ? 'offline' : 'unavailable', error?.code || 'evaluation/unavailable');
      }
    })();
    running = task; forced = force;
    task.finally(() => { if (running === task) running = null; });
    return task;
  }
  function start() {
    if (!backendEnabled || !auth || !db || !['sismorcego-50b25', 'demo-sismorcego-spark'].includes(projectId)) {
      block('unavailable', 'unsupported-build'); return;
    }
    unsubscribe = sdk.onIdTokenChanged(auth, user => {
      if (!active) return;
      initialized = true;
      const changed = observedUid !== user?.uid;
      observedUid = user?.uid;
      watchControl(user);
      if (!changingAuth) {
        if (changed) block('checking');
        revalidate();
      }
    }, () => { initialized = true; block('unavailable'); });
  }
  return { start, revalidate, getState: () => state,
    setForeground(value) {
      paused = !value;
      if (paused) { revision++; running = null; leaseDeadline = 0; clearTimeout(leaseTimer); }
      else { block('checking'); revalidate(true); }
    },
    subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); },
    dispose() { active = false; revision++; clearTimeout(leaseTimer); unsubscribe?.(); unsubscribeControl?.(); listeners.clear(); },
  };
}
