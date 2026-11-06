import { getIdTokenResult, onIdTokenChanged, signInWithCustomToken, signOut } from 'firebase/auth';
import { doc, getDocFromServer, onSnapshot } from 'firebase/firestore';
import { secureEvaluationStorage } from './secureEvaluationStorage';
import { newRecordId } from './recordDraftIdentity';
import { detachPushDevice } from './pushDevices';

const INSTALLATION_KEY = '@sismorcego:evaluation:installation:v1';
const markerKey = project => `@sismorcego:evaluation:approved:v1:${project}`;
const failure = code => Object.assign(new Error('Não foi possível validar a configuração deste aparelho.'), { code });
const networkError = error => /network|timeout|unavailable|offline/.test(error?.code || '');
const fatalError = error => /user-disabled|user-token-expired|invalid-user-token|user-not-found|permission-denied|evaluation\//.test(error?.code || '');

export function parseEvaluationConfiguration(raw, { projectId, installationId, emulator = false, now = Date.now() }) {
  let packet;
  try { packet = typeof raw === 'string' && raw.length <= 65536 ? JSON.parse(raw.replace(/^\uFEFF/, '')) : null; } catch { /* Untrusted document is data only. */ }
  if (!packet || packet.version !== 1 || packet.projectId !== projectId || packet.installationId !== installationId ||
    typeof packet.uid !== 'string' || !packet.uid || packet.uid.length > 128 ||
    typeof packet.customToken !== 'string' || !(emulator && projectId === 'demo-sismorcego-spark'
      ? /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]*$/ : /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/).test(packet.customToken) ||
    packet.customToken.length > 12000 || !Number.isFinite(packet.expiresAt) || packet.expiresAt <= now || packet.expiresAt > now + 65 * 60000) {
    throw failure('evaluation/invalid-configuration');
  }
  return packet;
}

export function assertEvaluationToken(user, result, marker, installationId, now = Date.now()) {
  const expiresAt = Date.parse(result?.expirationTime);
  if (!user?.uid || user.isAnonymous || user.uid !== marker?.uid || marker.installationId !== installationId ||
    result?.claims?.sismorcegoEvaluationAccount !== true || result?.claims?.evaluationInstallation !== installationId ||
    !Number.isFinite(expiresAt) || expiresAt <= now) throw failure('evaluation/unauthorized-session');
  return expiresAt;
}

// The SDK remains the authenticator; this controller restricts this evaluation
// UI to a provisioned installation + the server-authorized shared coordinator.
export function createEvaluationSession({ auth, db, projectId, backendEnabled, emulator = false, storage = secureEvaluationStorage,
  sdk = { getIdTokenResult, onIdTokenChanged, signInWithCustomToken, signOut, doc, getDocFromServer, onSnapshot },
  online = async () => true, now = Date.now, makeId = newRecordId, detach = detachPushDevice }) {
  let state = { status: 'checking', user: null, role: null, installationId: '', reason: null };
  const listeners = new Set();
  let active = true, version = 0, running, runningForced = false, forcedFollowup, provisioning = false, observedUid;
  let unsubscribeAuth, unsubscribeRole, watchedUid, expiryTimer, lastVerified;
  const emit = patch => { if (active) { state = { ...state, ...patch }; listeners.forEach(fn => fn(state)); } };
  const stopRole = () => { unsubscribeRole?.(); unsubscribeRole = null; watchedUid = null; };
  const bounded = promise => {
    let timer;
    return Promise.race([promise, new Promise((_, reject) => { timer = setTimeout(() => reject(failure('network/timeout')), 15000); })])
      .finally(() => clearTimeout(timer));
  };
  const current = (ticket, user) => active && ticket === version && auth?.currentUser?.uid === user?.uid;
  const installation = async () => {
    let id = await storage.getItem(INSTALLATION_KEY);
    if (!id) { id = makeId(); await storage.setItem(INSTALLATION_KEY, id); }
    if (!/^[A-Za-z0-9_-]{20,128}$/.test(id)) throw failure('evaluation/storage');
    return id;
  };
  const marker = async () => {
    try { return JSON.parse(await storage.getItem(markerKey(projectId)) || 'null'); } catch { return null; }
  };
  async function invalidate(reason, removeSession = true) {
    version += 1; running = null; lastVerified = null; clearTimeout(expiryTimer); stopRole();
    emit({ status: 'needs-configuration', user: null, role: null, reason });
    if (removeSession) {
      await storage.removeItem(markerKey(projectId)).catch(() => {});
      const uid = auth?.currentUser?.uid;
      if (uid) {
        // This disables only the current installation, never the other devices.
        await bounded(detach(uid)).catch(() => {});
        await sdk.signOut(auth).catch(() => {});
      }
    }
  }
  function watchRole(user) {
    if (watchedUid === user.uid) return;
    stopRole(); watchedUid = user.uid;
    unsubscribeRole = sdk.onSnapshot(sdk.doc(db, 'usuarios', user.uid), { includeMetadataChanges: true }, snapshot => {
      if (active && auth.currentUser?.uid === user.uid && !snapshot.metadata?.fromCache &&
        (!snapshot.exists() || snapshot.data()?.role !== 'coordenador')) invalidate('authorization-changed');
    }, error => { if (active && auth.currentUser?.uid === user.uid && fatalError(error)) invalidate('authorization-changed'); });
  }
  function ready(user, expiresAt) {
    lastVerified = { uid: user.uid, expiresAt };
    clearTimeout(expiryTimer);
    expiryTimer = setTimeout(() => revalidate(true), Math.max(1, expiresAt - now()));
    emit({ status: 'ready', user, role: 'coordenador', reason: null });
    watchRole(user);
  }
  async function checkRole(user) {
    const snapshot = await bounded(sdk.getDocFromServer(sdk.doc(db, 'usuarios', user.uid)));
    if (!snapshot.exists() || snapshot.data()?.role !== 'coordenador') throw failure('evaluation/not-coordinator');
  }
  function revalidate(force = false) {
    if (!active || provisioning || !backendEnabled || !auth) return Promise.resolve();
    if (running) {
      // A foreground/revocation check must not be swallowed by an in-flight
      // cached-token check. Coalesce one forced follow-up, preserving its await.
      if (force && !runningForced) {
        if (!forcedFollowup) forcedFollowup = running.catch(() => {}).then(() => { forcedFollowup = null; return revalidate(true); });
        return forcedFollowup;
      }
      return running;
    }
    const user = auth.currentUser;
    if (!user) { emit({ status: 'needs-configuration', user: null, role: null, reason: state.reason || 'not-provisioned' }); return Promise.resolve(); }
    const ticket = ++version;
    if (lastVerified?.uid !== user.uid || lastVerified.expiresAt <= now()) emit({ status: 'checking', user: null, role: null });
    const task = (async () => {
      try {
        const [id, approved] = await Promise.all([installation(), marker()]);
        if (!current(ticket, user)) return;
        if (!approved?.verified || approved.projectId !== projectId || approved.uid !== user.uid) throw failure('evaluation/not-provisioned');
        const result = await bounded(sdk.getIdTokenResult(user, force));
        if (!current(ticket, user)) return;
        const expiresAt = assertEvaluationToken(user, result, approved, id, now());
        if (await online()) {
          try { await checkRole(user); } catch (error) { if (!networkError(error)) throw error; }
        }
        if (current(ticket, user)) ready(user, expiresAt);
      } catch (error) {
        if (!current(ticket, user)) return;
        if (networkError(error) && lastVerified?.uid === user.uid && lastVerified.expiresAt > now()) return;
        await invalidate(fatalError(error) ? 'session-invalid' : 'connection-required', fatalError(error));
      }
    })();
    running = task;
    runningForced = force;
    task.finally(() => { if (running === task) running = null; });
    return task;
  }
  async function provision(raw) {
    if (!backendEnabled || !auth || !db || provisioning) throw failure('evaluation/unavailable');
    const id = await installation();
    const packet = parseEvaluationConfiguration(raw, { projectId, installationId: id, emulator, now: now() });
    provisioning = true; version += 1; running = null; stopRole(); clearTimeout(expiryTimer);
    emit({ status: 'checking', user: null, role: null, reason: null });
    const ticket = version;
    try {
      const result = await bounded(sdk.signInWithCustomToken(auth, packet.customToken));
      if (!current(ticket, result.user)) throw failure('evaluation/interrupted');
      const token = await bounded(sdk.getIdTokenResult(result.user));
      const expiresAt = assertEvaluationToken(result.user, token, packet, id, now());
      await checkRole(result.user);
      if (!current(ticket, result.user)) throw failure('evaluation/interrupted');
      await storage.setItem(markerKey(projectId), JSON.stringify({ uid: result.user.uid, projectId, installationId: id, verified: true }));
      if (!current(ticket, result.user)) throw failure('evaluation/interrupted');
      observedUid = result.user.uid;
      ready(result.user, expiresAt);
    } catch (error) {
      if (active && ticket === version) await invalidate('configuration-rejected');
      throw failure(networkError(error) ? 'network/unavailable' : 'evaluation/configuration-rejected');
    } finally { provisioning = false; }
  }
  async function start() {
    try {
      const id = await installation();
      if (!active) return;
      emit({ installationId: id });
      if (!backendEnabled || !auth || !db || !projectId) { emit({ status: 'needs-configuration', reason: 'unsupported-build' }); return; }
      observedUid = auth.currentUser?.uid;
      unsubscribeAuth = sdk.onIdTokenChanged(auth, user => {
        if (!active || provisioning) return;
        if (observedUid !== user?.uid) { observedUid = user?.uid; version += 1; running = null; stopRole(); lastVerified = null;
          emit({ status: 'checking', user: null, role: null }); }
        revalidate();
      }, () => invalidate('session-invalid'));
    } catch { emit({ status: 'needs-configuration', reason: 'secure-storage-unavailable' }); }
  }
  return {
    start, provision, revalidate,
    getState: () => state,
    subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); },
    dispose() { active = false; version += 1; clearTimeout(expiryTimer); stopRole(); unsubscribeAuth?.(); listeners.clear(); },
  };
}
