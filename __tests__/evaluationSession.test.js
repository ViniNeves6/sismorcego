import { assertAcsToken, assertEvaluationToken, createEvaluationSession, EVALUATION_UID } from '../src/services/evaluationSession';
jest.mock('firebase/auth', () => ({}));
jest.mock('firebase/firestore', () => ({}));

const base = Date.parse('2026-11-07T01:00:00Z'), user = { uid: EVALUATION_UID, isAnonymous: false };
const acs = { uid: 'anon-device-1', isAnonymous: true };
const credentials = { email: 'evaluation@example.invalid', password: 'local-only-evaluation-2026' };
let session, auth, sdk, token, authEvent, online, elapsed, period, role, profiles;
const settle = async () => { for (let i = 0; i < 25; i++) await Promise.resolve(); };
const data = () => ({ ...period, startAt: { toMillis: () => period.startAt }, expiresAt: { toMillis: () => period.expiresAt } });
const options = () => ({ auth, db: {}, projectId: 'demo-sismorcego-spark', firebaseEnabled: true, sdk, online, clock: () => elapsed });
const start = async () => { session.start(); authEvent(auth.currentUser); await session.revalidate(); };
// Fresh install: login screen first, then the coordinator types the shared credentials.
const login = async () => { await start(); await session.signInCoordinator(credentials.email, credentials.password); await session.revalidate(); };
beforeEach(() => {
  jest.useFakeTimers({ now: base }); elapsed = 0; role = 'coordenador'; profiles = {};
  period = { enabled: true, startAt: base - 10000, expiresAt: base + 30 * 86400000 }; auth = { currentUser: null };
  token = { claims: { sismorcegoEvaluationAccount: true }, issuedAtTime: new Date(base).toUTCString(), expirationTime: new Date(base + 3600000).toISOString() };
  online = jest.fn().mockResolvedValue(true);
  sdk = { onIdTokenChanged: jest.fn((_, fn) => { authEvent = fn; return jest.fn(); }),
    doc: jest.fn((_, ...parts) => parts.join('/')),
    getDocFromServer: jest.fn(async path => {
      if (path.startsWith('configuracoes/')) return { exists: () => true, data };
      if (path === 'usuarios/' + EVALUATION_UID) return { exists: () => true, data: () => ({ role }) };
      return { exists: () => Boolean(profiles[path]), data: () => profiles[path] };
    }),
    setDoc: jest.fn(async (path, value) => { profiles[path] = value; }),
    signInWithEmailAndPassword: jest.fn(async () => { auth.currentUser = user; authEvent(user); return { user }; }),
    signInAnonymously: jest.fn(async () => { auth.currentUser = acs; authEvent(acs); return { user: acs }; }),
    getIdTokenResult: jest.fn(async () => ({ ...token, issuedAtTime: new Date(base + elapsed).toUTCString() })),
    signOut: jest.fn(async () => { auth.currentUser = null; authEvent(null); }),
  };
  session = createEvaluationSession(options());
});
afterEach(() => { session.dispose(); jest.clearAllTimers(); jest.useRealTimers(); });

test('clean installation waits on the login screen without signing in by itself', async () => {
  await start();
  expect(session.getState()).toMatchObject({ status: 'signed-out', user: null, role: null });
  expect(sdk.signInWithEmailAndPassword).not.toHaveBeenCalled(); expect(sdk.signInAnonymously).not.toHaveBeenCalled();
  expect(sdk.getDocFromServer).not.toHaveBeenCalled();
});
test('coordinator types the shared password and passes server-only configuration/profile checks', async () => {
  await login();
  expect(sdk.signInWithEmailAndPassword).toHaveBeenCalledWith(auth, credentials.email, credentials.password);
  expect(sdk.getIdTokenResult).toHaveBeenCalledWith(user, true);
  expect(sdk.getDocFromServer).toHaveBeenCalledWith('configuracoes/avaliacaoCoordenadores');
  expect(sdk.getDocFromServer).toHaveBeenCalledWith('usuarios/' + EVALUATION_UID);
  expect(session.getState()).toMatchObject({ status: 'ready', user, role: 'coordenador' });
  expect(session.provision).toBeUndefined();
});
test('reopening reuses encrypted Firebase persistence without another password sign-in', async () => {
  await login(); session.dispose(); session = createEvaluationSession(options()); await start();
  expect(session.getState().status).toBe('ready'); expect(sdk.signInWithEmailAndPassword).toHaveBeenCalledTimes(1);
});
test.each(['expired','suspended','not-started','unavailable'])('%s does not query the protected profile or open the Shell', async status => {
  if (status === 'expired') period.expiresAt = base - 1;
  if (status === 'suspended') period.enabled = false;
  if (status === 'not-started') period.startAt = base + 60000;
  if (status === 'unavailable') period.enabled = 'yes';
  auth.currentUser = user; await start(); expect(session.getState().status).toBe(status);
  expect(sdk.getDocFromServer).not.toHaveBeenCalledWith('usuarios/' + EVALUATION_UID);
});
test('expiration hides data, preserves Auth, and extension restores the same session without a new APK', async () => {
  period.expiresAt = base + 2000; auth.currentUser = user; await start(); elapsed = 2001; await jest.advanceTimersByTimeAsync(2001); await settle();
  expect(session.getState().status).toBe('expired'); expect(auth.currentUser).toBe(user);
  period.expiresAt += 30 * 86400000; await session.revalidate();
  expect(session.getState().status).toBe('ready'); expect(sdk.signInWithEmailAndPassword).not.toHaveBeenCalled();
});
test('a known suspension survives network failure and recovers when re-enabled', async () => {
  auth.currentUser = user; await start(); period.enabled = false; await session.revalidate();
  expect(session.getState().status).toBe('suspended'); online.mockResolvedValue(false); await session.revalidate();
  expect(session.getState().status).toBe('suspended'); expect(sdk.signOut).not.toHaveBeenCalled();
  online.mockResolvedValue(true); period.enabled = true; await session.revalidate(); expect(session.getState().status).toBe('ready');
});
test('server snapshots revalidate changes, ignore cache and keep a matching initial screen mounted', async () => {
  let control; sdk.onSnapshot = jest.fn((_, config, callback) => { control = callback; return jest.fn(); });
  auth.currentUser = user; await start(); const calls = sdk.getDocFromServer.mock.calls.length;
  control({ metadata: { fromCache: true }, exists: () => true, data: () => ({ ...data(), enabled: false }) });
  control({ metadata: { fromCache: false }, exists: () => true, data });
  await settle(); expect(session.getState().status).toBe('ready'); expect(sdk.getDocFromServer).toHaveBeenCalledTimes(calls);
  period.enabled = false; control({ metadata: { fromCache: false }, exists: () => true, data });
  await session.revalidate(); expect(session.getState().status).toBe('suspended');
  period.enabled = true; control({ metadata: { fromCache: false }, exists: () => true, data });
  await session.revalidate(); expect(session.getState().status).toBe('ready');
});
test('policy suspension invalidates a stale in-flight successful profile response', async () => {
  let control, finish;
  sdk.onSnapshot = jest.fn((_, config, callback) => { control = callback; return jest.fn(); });
  auth.currentUser = user; await start();
  sdk.getDocFromServer.mockImplementationOnce(async () => ({ exists: () => true, data }))
    .mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
  const pending = session.revalidate(); await settle(); period.enabled = false;
  control({ metadata: { fromCache: false }, exists: () => true, data });
  finish({ exists: () => true, data: () => ({ role }) }); await pending; await session.revalidate();
  expect(session.getState()).toMatchObject({ status: 'suspended', user: null });
});
test('server profile denial is authoritative even if configuration and client time claim the evaluation is active', async () => {
  sdk.getDocFromServer.mockImplementation(async path => {
    if(path.startsWith('usuarios/'))throw Object.assign(new Error(),{code:'permission-denied'});
    return { exists: () => true, data };
  });
  auth.currentUser = user; await start(); expect(session.getState()).toMatchObject({ status: 'blocked', user: null });
});
test('cold offline launch never uses a persisted session to reveal protected data', async () => {
  auth.currentUser = user; online.mockResolvedValue(false); await start();
  expect(session.getState().status).toBe('offline'); expect(sdk.getDocFromServer).not.toHaveBeenCalled();
});
test('network loss retains only the remaining lease; reconnection restores access without deleting Auth', async () => {
  auth.currentUser = user; await start(); online.mockResolvedValue(false); await session.revalidate(); expect(session.getState().status).toBe('ready');
  elapsed = 61000; await jest.advanceTimersByTimeAsync(61000); await settle();
  expect(session.getState().status).toBe('offline'); expect(auth.currentUser).toBe(user);
  online.mockResolvedValue(true); await session.revalidate(); expect(session.getState().status).toBe('ready');
});
test('changing the device wall clock cannot extend an expired evaluation', async () => {
  auth.currentUser = user; await start(); jest.setSystemTime(base - 365 * 86400000); period.expiresAt = base - 1;
  await session.revalidate(); expect(session.getState().status).toBe('expired');
});
test('a short trip to the gallery keeps the screen ready while the server is rechecked', async () => {
  auth.currentUser = user; await start(); const states = [];
  session.subscribe(state => states.push(state.status));
  session.setForeground(false); elapsed = 20000; session.setForeground(true);
  expect(session.getState().status).toBe('ready'); await session.revalidate();
  expect(states).not.toContain('checking'); expect(session.getState().status).toBe('ready');
});
test('returning after the lease expired rechecks before showing protected data', async () => {
  auth.currentUser = user; await start();
  session.setForeground(false); elapsed = 61000; session.setForeground(true);
  expect(session.getState().status).toBe('checking'); await session.revalidate();
  expect(session.getState().status).toBe('ready');
});
test('foreground invalidates a pre-sleep lease and rechecks the server', async () => {
  auth.currentUser = user; await start(); session.setForeground(false); period.enabled = false; session.setForeground(true); await session.revalidate();
  expect(session.getState().status).toBe('suspended');
});
test('lost Firebase session returns to the login screen instead of signing in with a stored password', async () => {
  await login(); auth.currentUser = null; authEvent(null); await session.revalidate();
  expect(session.getState()).toMatchObject({ status: 'signed-out', user: null }); expect(sdk.signInWithEmailAndPassword).toHaveBeenCalledTimes(1);
});
test('revoked refresh token signs out and asks for the password again', async () => {
  await login(); sdk.getIdTokenResult.mockRejectedValueOnce(Object.assign(new Error(), { code: 'auth/user-token-expired' }));
  await session.revalidate(); expect(session.getState()).toMatchObject({ status: 'signed-out', reason: 'evaluation/session-ended' });
  expect(sdk.signOut).toHaveBeenCalledTimes(1); expect(sdk.signInWithEmailAndPassword).toHaveBeenCalledTimes(1);
});
test('wrong password is reported to the form and keeps the login screen', async () => {
  await start(); sdk.signInWithEmailAndPassword.mockRejectedValueOnce(Object.assign(new Error(), { code: 'auth/invalid-credential' }));
  await expect(session.signInCoordinator('x@example.invalid', 'bad')).rejects.toMatchObject({ code: 'auth/invalid-credential' });
  expect(session.getState().status).toBe('signed-out');
});
test.each([['acs'], [undefined]])('an e-mail account with role %s is signed out and never enters as coordinator', async otherRole => {
  const other = { uid: 'ordinary-account', isAnonymous: false };
  if (otherRole) profiles['usuarios/ordinary-account'] = { role: otherRole };
  sdk.signInWithEmailAndPassword.mockImplementationOnce(async () => { auth.currentUser = other; authEvent(other); return { user: other }; });
  await start(); await session.signInCoordinator('other@example.invalid', 'secret'); await session.revalidate();
  expect(sdk.signOut).toHaveBeenCalled();
  expect(session.getState()).toMatchObject({ status: 'signed-out', user: null, reason: 'evaluation/not-coordinator' });
});
test('a real coordinator account (role in Firestore) enters without the evaluation claim or period', async () => {
  const coord = { uid: 'real-coordinator', isAnonymous: false };
  profiles['usuarios/real-coordinator'] = { role: 'coordenador' }; period.expiresAt = base - 1; token.claims = {};
  sdk.signInWithEmailAndPassword.mockImplementationOnce(async () => { auth.currentUser = coord; authEvent(coord); return { user: coord }; });
  await start(); await session.signInCoordinator('coord@example.invalid', 'secret'); await session.revalidate();
  expect(session.getState()).toMatchObject({ status: 'ready', user: coord, role: 'coordenador' });
  expect(sdk.getDocFromServer).not.toHaveBeenCalledWith('configuracoes/avaliacaoCoordenadores');
  expect(sdk.setDoc).not.toHaveBeenCalled();
});
test('ACS enters directly with an anonymous account and creates its own acs profile', async () => {
  await start(); await session.signInAcs(); await session.revalidate();
  expect(sdk.signInAnonymously).toHaveBeenCalledWith(auth);
  expect(sdk.setDoc).toHaveBeenCalledWith('usuarios/' + acs.uid, { email: null, role: 'acs' });
  expect(session.getState()).toMatchObject({ status: 'ready', user: acs, role: 'acs' });
  session.dispose(); session = createEvaluationSession(options()); await start();
  expect(session.getState()).toMatchObject({ status: 'ready', role: 'acs' }); expect(sdk.setDoc).toHaveBeenCalledTimes(1);
});
test('ACS training access follows the same global evaluation period', async () => {
  period.expiresAt = base - 1; auth.currentUser = acs; await start();
  expect(session.getState().status).toBe('expired'); expect(sdk.setDoc).not.toHaveBeenCalled();
});
test('an anonymous account whose profile is not acs never opens the Shell', async () => {
  profiles['usuarios/' + acs.uid] = { role: 'coordenador' }; auth.currentUser = acs; await start();
  expect(session.getState()).toMatchObject({ status: 'blocked', user: null });
});
test('ACS sign-in offline reports the network and does not call Firebase', async () => {
  await start(); online.mockResolvedValue(false);
  await expect(session.signInAcs()).rejects.toMatchObject({ code: 'network/offline' }); expect(sdk.signInAnonymously).not.toHaveBeenCalled();
});
test('sign out returns to profile choice', async () => {
  await login(); await session.signOut();
  expect(session.getState()).toMatchObject({ status: 'signed-out', user: null }); expect(auth.currentUser).toBeNull();
});
test('disabled account blocks without attempting to bypass the administrative decision', async () => {
  auth.currentUser = user; await start(); sdk.getIdTokenResult.mockRejectedValueOnce(Object.assign(new Error(), { code: 'auth/user-disabled' }));
  await session.revalidate(); expect(session.getState().status).toBe('blocked');
  expect(sdk.signInWithEmailAndPassword).not.toHaveBeenCalled(); expect(sdk.signOut).not.toHaveBeenCalled();
});
test.each(['claim','role','time'])('%s mismatch never enters the coordinator interface', async kind => {
  if (kind === 'claim') token.claims.sismorcegoEvaluationAccount = false;
  if (kind === 'role') role = 'acs';
  if (kind === 'time') sdk.getIdTokenResult.mockResolvedValue({ ...token, issuedAtTime: 'invalid' });
  await login(); expect(session.getState().user).toBeNull();
});
test('forced token-refresh events during reactivation cannot clear the fresh lease or loop', async () => {
  auth.currentUser = user; await start(); period.enabled = false; await session.revalidate(); period.enabled = true;
  sdk.getIdTokenResult.mockImplementationOnce(async () => { authEvent(user); return token; });
  await session.revalidate(true); expect(session.getState().status).toBe('ready');
});
test('disposal prevents in-flight authentication from opening protected screens', async () => {
  let finish; sdk.signInWithEmailAndPassword.mockImplementation(() => new Promise(resolve => { finish = resolve; }));
  session.start(); authEvent(null); await settle(); session.signInCoordinator('a@b.c', 'x').catch(() => {}); await settle();
  session.dispose(); auth.currentUser = user; authEvent(user); finish({ user }); await settle();
  expect(session.getState().user).toBeNull();
});
test('unsupported builds never fall back to another identity', () => {
  session.dispose(); session = createEvaluationSession({ ...options(), firebaseEnabled: false }); session.start();
  expect(session.getState()).toMatchObject({ status: 'unavailable', user: null, reason: 'unsupported-build' });
  expect(sdk.signInWithEmailAndPassword).not.toHaveBeenCalled();
});
test('expired ID token does not pass validation', () => {
  expect(() => assertEvaluationToken(user, token, base + 3600001)).toThrow();
  expect(() => assertAcsToken(acs, token, base + 3600001)).toThrow();
  expect(() => assertAcsToken(user, token, base)).toThrow();
});
