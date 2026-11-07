import { getIdTokenResult, onIdTokenChanged, signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { doc, getDocFromServer, onSnapshot } from 'firebase/firestore';
import { EVALUATION_CREDENTIALS } from './appEnvironment';
import { evaluationPeriod } from './evaluationPolicy';

export const EVALUATION_UID = 'sismorcego-teste-coordenadores';
const LEASE_MS = 60000;
const failure = code => Object.assign(new Error('Não foi possível validar a avaliação.'), { code });
const fatalAuth = error => /user-disabled|user-token-expired|invalid-user-token|user-not-found/.test(error?.code || '');
const monotonicClock = () => global.performance.now();

export function assertEvaluationToken(user, token, serverTime) {
  if (user?.uid !== EVALUATION_UID || user.isAnonymous || token?.claims?.sismorcegoEvaluationAccount !== true ||
    !Number.isFinite(Date.parse(token.expirationTime)) || Date.parse(token.expirationTime) <= serverTime) throw failure('evaluation/unauthorized-session');
}

// Firebase Auth + Firestore only. No custom-token issuer or installation setup.
// The local clock never authorizes access: a forced Firebase token refresh gives
// an issuance-time reference; a server-only profile read must pass the rules.
export function createEvaluationSession({ auth, db, projectId, firebaseEnabled, credentials = EVALUATION_CREDENTIALS,
  sdk = { getIdTokenResult, onIdTokenChanged, signInWithEmailAndPassword, signOut, doc, getDocFromServer, onSnapshot },
  online = async () => true, clock = monotonicClock }) {
  let state = { status: 'checking', user: null, role: null, reason: null };
  let active = true, initialized = false, changingAuth = false, paused = false, revision = 0;
  let running, followup, unsubscribe, leaseTimer, leaseDeadline = 0, lastPolicy, observedUid;
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
  const trustedNow = () => lastPolicy ? lastPolicy.serverTime + Math.max(0, clock() - lastPolicy.receivedAt) : Infinity;
  function watchControl(user) {
    if (watchedUid === user?.uid) return;
    unsubscribeControl?.(); unsubscribeControl = null; watchedUid = user?.uid;
    if (user?.uid !== EVALUATION_UID || !sdk.onSnapshot) return;
    unsubscribeControl = sdk.onSnapshot(sdk.doc(db, 'configuracoes', 'avaliacaoCoordenadores'), { includeMetadataChanges: true }, snapshot => {
      if (!active || snapshot.metadata?.fromCache || auth.currentUser?.uid !== EVALUATION_UID) return;
      const data = snapshot.exists() ? snapshot.data() : null;
      if (lastPolicy && data?.enabled === lastPolicy.enabled &&
        data?.startAt?.toMillis?.() === lastPolicy.startAt && data?.expiresAt?.toMillis?.() === lastPolicy.expiresAt) return;
      revision++; // A stale in-flight profile read must not undo this policy change.
      block(data?.enabled === false ? 'suspended' : 'checking');
      revalidate(true);
    }, () => { if (active) revalidate(true); });
  }
  async function resetFirebase() {
    changingAuth = true;
    try { await bounded(sdk.signOut(auth)); } finally { changingAuth = false; }
  }
  async function authenticate() {
    changingAuth = true;
    try { return (await bounded(sdk.signInWithEmailAndPassword(auth, credentials.email, credentials.password))).user; }
    finally { changingAuth = false; }
  }
  function revalidate(force = false) {
    if (!active || paused || !initialized || !firebaseEnabled || !auth || !db) return Promise.resolve();
    if (running) {
      // A policy/network change during an in-flight read needs one fresh pass.
      if (force && !followup) followup = running.catch(() => {}).then(() => { followup = null; return revalidate(); });
      return followup || running;
    }
    const ticket = ++revision;
    if (state.status === 'ready' && leaseDeadline <= clock()) block('checking');
    const task = (async () => {
      try {
        if (!await online()) throw failure('network/offline');
        let user = auth.currentUser;
        if (user && user.uid !== EVALUATION_UID) { await resetFirebase(); user = null; }
        if (!user) user = await authenticate();
        if (!current(ticket) || !user) return;
        let startedAt = clock(), token;
        try { token = await bounded(sdk.getIdTokenResult(user, true)); }
        catch (error) {
          if (!fatalAuth(error) || error.code === 'auth/user-disabled') throw error;
          await resetFirebase(); user = await authenticate();
          if (!current(ticket) || !user) return;
          startedAt = clock(); token = await bounded(sdk.getIdTokenResult(user, true));
        }
        if (!current(ticket)) return;
        const issuedAt = Date.parse(token.issuedAtTime);
        if (!Number.isFinite(issuedAt)) throw failure('evaluation/invalid-server-time');
        // JWT issuance is rounded to seconds. Add a second and the full round
        // trip conservatively; the profile read below is the final authority.
        const serverTime = issuedAt + 1000 + Math.max(0, clock() - startedAt), receivedAt = clock();
        assertEvaluationToken(user, token, serverTime);
        const snapshot = await bounded(sdk.getDocFromServer(sdk.doc(db, 'configuracoes', 'avaliacaoCoordenadores')));
        if (!current(ticket)) return;
        const policy = evaluationPeriod(snapshot.exists() ? snapshot.data() : null, serverTime + Math.max(0, clock() - receivedAt));
        lastPolicy = { ...policy, serverTime, receivedAt };
        if (policy.state !== 'active') { block(policy.state); return; }
        // This request is evaluated with request.time by Firestore, including
        // the global evaluation guard and the existing ownership/role rules.
        const profile = await bounded(sdk.getDocFromServer(sdk.doc(db, 'usuarios', user.uid)));
        if (!current(ticket)) return;
        if (!profile.exists() || profile.data()?.role !== 'coordenador') throw failure('evaluation/not-coordinator');
        const remaining = Math.min(LEASE_MS, policy.expiresAt - trustedNow(), Date.parse(token.expirationTime) - trustedNow());
        if (remaining <= 0) { block(trustedNow() >= policy.expiresAt ? 'expired' : 'offline'); return; }
        leaseDeadline = clock() + remaining; clearTimeout(leaseTimer);
        leaseTimer = setTimeout(() => {
          if (!active) return;
          block(trustedNow() >= lastPolicy.expiresAt ? 'expired' : 'checking'); revalidate();
        }, remaining);
        emit({ status: 'ready', user, role: 'coordenador', reason: null });
      } catch (error) {
        if (!current(ticket)) return;
        const code = error?.code || '';
        const network = /network|timeout|offline|unavailable|deadline-exceeded/.test(code);
        if (network && state.status === 'ready' && clock() < leaseDeadline) return;
        if (network && ['expired', 'suspended', 'not-started', 'blocked'].includes(state.status)) return;
        const denied = code === 'permission-denied';
        const blocked = denied || /evaluation\/unauthorized|not-coordinator|auth\/(user-disabled|invalid-credential|wrong-password|user-not-found|too-many-requests)/.test(code);
        block(network ? 'offline' : denied && lastPolicy && trustedNow() >= lastPolicy.expiresAt ? 'expired' : blocked ? 'blocked' : 'unavailable', code);
      }
    })();
    running = task;
    task.finally(() => { if (running === task) running = null; });
    return task;
  }
  function start() {
    if (!firebaseEnabled || !auth || !db || !credentials?.email || !credentials?.password ||
      !['sismorcego-50b25', 'demo-sismorcego-spark'].includes(projectId)) {
      block('unavailable', 'unsupported-build'); return;
    }
    unsubscribe = sdk.onIdTokenChanged(auth, user => {
      if (!active) return;
      initialized = true;
      const changed = observedUid !== user?.uid; observedUid = user?.uid; watchControl(user);
      if (!changingAuth) { if (changed) block('checking'); revalidate(); }
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
