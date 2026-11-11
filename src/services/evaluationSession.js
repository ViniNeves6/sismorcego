import { getIdTokenResult, onIdTokenChanged, signInAnonymously, signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { doc, getDocFromServer, onSnapshot, setDoc } from 'firebase/firestore';
import { evaluationPeriod } from './evaluationPolicy';

export const EVALUATION_UID = 'sismorcego-teste-coordenadores';
const LEASE_MS = 60000;
const failure = code => Object.assign(new Error('Não foi possível validar a avaliação.'), { code });
const fatalAuth = error => /user-disabled|user-token-expired|invalid-user-token|user-not-found/.test(error?.code || '');
const monotonicClock = () => global.performance.now();
const tokenValid = (token, serverTime) => Number.isFinite(Date.parse(token?.expirationTime)) && Date.parse(token.expirationTime) > serverTime;

// Which profile a Firebase user is trying to open: anonymous = ACS; an e-mail
// account = Coordenador, which still has to be proven by usuarios/{uid}.role.
export function evaluationProfileOf(user) {
  if (!user) return null;
  return user.isAnonymous ? 'acs' : 'coordenador';
}
// Training accounts (anonymous ACS and the shared evaluation coordinator) follow
// the global evaluation period; real coordinator accounts do not.
export const isTrainingAccount = user => Boolean(user && (user.isAnonymous || user.uid === EVALUATION_UID));

export function assertEvaluationToken(user, token, serverTime) {
  if (user?.uid !== EVALUATION_UID || user.isAnonymous || token?.claims?.sismorcegoEvaluationAccount !== true ||
    !tokenValid(token, serverTime)) throw failure('evaluation/unauthorized-session');
}

export function assertCoordinatorToken(user, token, serverTime) {
  if (!user?.uid || user.isAnonymous || !tokenValid(token, serverTime)) throw failure('evaluation/unauthorized-session');
}

export function assertAcsToken(user, token, serverTime) {
  if (!user?.uid || user.isAnonymous !== true || !tokenValid(token, serverTime)) throw failure('evaluation/unauthorized-session');
}

// Firebase Auth + Firestore only. No custom-token issuer or installation setup.
// Two training profiles share the global evaluation period:
// - ACS: anonymous Firebase account per device, profile usuarios/{uid}.role = "acs".
// - Coordenador: any e-mail account whose usuarios/{uid}.role is "coordenador"
//   (promoted only in the Firebase console), including the shared evaluation account.
// The local clock never authorizes access: a forced Firebase token refresh gives
// an issuance-time reference; a server-only profile read must pass the rules.
export function createEvaluationSession({ auth, db, projectId, firebaseEnabled,
  sdk = { getIdTokenResult, onIdTokenChanged, signInAnonymously, signInWithEmailAndPassword, signOut, doc, getDocFromServer, onSnapshot, setDoc },
  online = async () => true, clock = monotonicClock }) {
  let state = { status: 'checking', user: null, role: null, reason: null };
  let active = true, initialized = false, changingAuth = false, paused = false, revision = 0;
  let running, followup, unsubscribe, leaseTimer, leaseDeadline = 0, lastPolicy, observedUid;
  let unsubscribeControl, watchedUid;
  const listeners = new Set();
  const emit = patch => { if (active) { state = { ...state, ...patch }; listeners.forEach(fn => fn(state)); } };
  const current = ticket => active && revision === ticket;
  const usable = () => Boolean(firebaseEnabled && auth && db && ['sismorcego-50b25', 'demo-sismorcego-spark'].includes(projectId));
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
    if (!isTrainingAccount(user) || !sdk.onSnapshot) return;
    unsubscribeControl = sdk.onSnapshot(sdk.doc(db, 'configuracoes', 'avaliacaoCoordenadores'), { includeMetadataChanges: true }, snapshot => {
      if (!active || snapshot.metadata?.fromCache || auth.currentUser?.uid !== user.uid) return;
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
  // Server profile for the chosen evaluation role. A new anonymous ACS creates
  // its own profile; the rules only allow role "acs" on creation.
  async function loadRole(user, profile) {
    const ref = sdk.doc(db, 'usuarios', user.uid);
    const snapshot = await bounded(sdk.getDocFromServer(ref));
    if (snapshot.exists()) return snapshot.data()?.role;
    if (profile !== 'acs') return null;
    await bounded(sdk.setDoc(ref, { email: null, role: 'acs' }));
    return 'acs';
  }
  function armLease(remaining) {
    clearTimeout(leaseTimer);
    leaseTimer = setTimeout(() => {
      if (!active) return;
      block(trustedNow() >= lastPolicy.expiresAt ? 'expired' : 'checking'); revalidate();
    }, remaining);
  }
  function revalidate(force = false) {
    if (!active || paused || !initialized || !usable()) return Promise.resolve();
    if (running) {
      // A policy/network change during an in-flight read needs one fresh pass.
      if (force && !followup) followup = running.catch(() => {}).then(() => { followup = null; return revalidate(); });
      return followup || running;
    }
    const ticket = ++revision;
    if (state.status === 'ready' && leaseDeadline <= clock()) block('checking');
    const task = (async () => {
      let profile = null;
      try {
        const user = auth.currentUser;
        // Without a session the user chooses ACS or Coordenador on the login screen.
        if (!user) { if (state.status !== 'signed-out') block('signed-out'); return; }
        profile = evaluationProfileOf(user);
        if (!profile) { await resetFirebase(); if (current(ticket)) block('signed-out', 'evaluation/not-coordinator'); return; }
        if (!await online()) throw failure('network/offline');
        let startedAt = clock(), token;
        try { token = await bounded(sdk.getIdTokenResult(user, true)); }
        catch (error) {
          if (!fatalAuth(error) || error.code === 'auth/user-disabled') throw error;
          // Lost or revoked session: the user signs in again on the login screen.
          await resetFirebase(); if (current(ticket)) block('signed-out', 'evaluation/session-ended'); return;
        }
        if (!current(ticket)) return;
        const issuedAt = Date.parse(token.issuedAtTime);
        if (!Number.isFinite(issuedAt)) throw failure('evaluation/invalid-server-time');
        // JWT issuance is rounded to seconds. Add a second and the full round
        // trip conservatively; the profile read below is the final authority.
        const serverTime = issuedAt + 1000 + Math.max(0, clock() - startedAt), receivedAt = clock();
        const training = isTrainingAccount(user);
        if (profile === 'acs') assertAcsToken(user, token, serverTime);
        else if (user.uid === EVALUATION_UID) assertEvaluationToken(user, token, serverTime);
        else assertCoordinatorToken(user, token, serverTime);
        let policy;
        if (training) {
          const snapshot = await bounded(sdk.getDocFromServer(sdk.doc(db, 'configuracoes', 'avaliacaoCoordenadores')));
          if (!current(ticket)) return;
          policy = evaluationPeriod(snapshot.exists() ? snapshot.data() : null, serverTime + Math.max(0, clock() - receivedAt));
        } else policy = { state: 'active', enabled: true, startAt: -Infinity, expiresAt: Infinity };
        lastPolicy = { ...policy, serverTime, receivedAt };
        if (policy.state !== 'active') { block(policy.state); return; }
        // This request is evaluated with request.time by Firestore, including
        // the global evaluation guard and the existing ownership/role rules.
        const role = await loadRole(user, profile);
        if (!current(ticket)) return;
        if (role !== profile) {
          // An e-mail account that is not a coordinator goes back to the login
          // screen with an explanation; training-account mismatches are blocked.
          if (!training) { await resetFirebase(); if (current(ticket)) block('signed-out', 'evaluation/not-coordinator'); return; }
          throw failure(profile === 'acs' ? 'evaluation/not-acs' : 'evaluation/not-coordinator');
        }
        const remaining = Math.min(LEASE_MS, policy.expiresAt - trustedNow(), Date.parse(token.expirationTime) - trustedNow());
        if (remaining <= 0) { block(trustedNow() >= policy.expiresAt ? 'expired' : 'offline'); return; }
        leaseDeadline = clock() + remaining; armLease(remaining);
        emit({ status: 'ready', user, role: profile, reason: null });
      } catch (error) {
        if (!current(ticket)) return;
        const code = error?.code || '';
        const network = /network|timeout|offline|unavailable|deadline-exceeded/.test(code);
        if (network && state.status === 'ready' && clock() < leaseDeadline) return;
        if (network && ['expired', 'suspended', 'not-started', 'blocked'].includes(state.status)) return;
        const denied = code === 'permission-denied';
        const blocked = denied || /evaluation\/unauthorized|not-coordinator|not-acs|auth\/(user-disabled|invalid-credential|wrong-password|user-not-found|too-many-requests)/.test(code);
        block(network ? 'offline' : denied && lastPolicy && trustedNow() >= lastPolicy.expiresAt ? 'expired' : blocked ? 'blocked' : 'unavailable', code);
      }
    })();
    running = task;
    task.finally(() => { if (running === task) running = null; });
    return task;
  }
  // Sign-in calls only open the Firebase session; onIdTokenChanged then runs the
  // same server validation as a restored session before any screen is revealed.
  async function enter(signIn) {
    if (!active) return;
    if (!usable()) throw failure('evaluation/unsupported-build');
    if (!await online()) throw failure('network/offline');
    if (state.reason) emit({ reason: null });
    await bounded(signIn());
  }
  function start() {
    if (!usable()) { block('unavailable', 'unsupported-build'); return; }
    unsubscribe = sdk.onIdTokenChanged(auth, user => {
      if (!active) return;
      initialized = true;
      const changed = observedUid !== user?.uid; observedUid = user?.uid; watchControl(user);
      if (!changingAuth) { if (changed && user) block('checking'); revalidate(); }
    }, () => { initialized = true; block('unavailable'); });
  }
  return { start, revalidate, getState: () => state,
    signInAcs: () => enter(() => sdk.signInAnonymously(auth)),
    signInCoordinator: (email, password) => enter(() => sdk.signInWithEmailAndPassword(auth, String(email || '').trim(), password || '')),
    async signOut() {
      if (!active) return;
      revision++;
      if (auth?.currentUser) await resetFirebase();
      block('signed-out');
    },
    setForeground(value) {
      paused = !value;
      // Galeria, câmera e diálogos do sistema colocam o app em segundo plano por
      // instantes. Na volta, uma verificação ainda válida (lease) mantém a tela;
      // o servidor é consultado em seguida e só então pode bloquear.
      if (paused) { revision++; running = null; clearTimeout(leaseTimer); return; }
      const remaining = leaseDeadline - clock();
      if (state.status === 'ready' && remaining > 0) armLease(remaining);
      else if (auth?.currentUser) block('checking');
      revalidate(true);
    },
    subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); },
    dispose() { active = false; revision++; clearTimeout(leaseTimer); unsubscribe?.(); unsubscribeControl?.(); listeners.clear(); },
  };
}
