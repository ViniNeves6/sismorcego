import { assertEvaluationToken, createEvaluationSession, EVALUATION_UID } from '../src/services/evaluationSession';
jest.mock('firebase/auth', () => ({}));
jest.mock('firebase/firestore', () => ({}));
jest.mock('../src/services/appEnvironment', () => ({ EVALUATION_CREDENTIALS: null }));

const base = Date.parse('2026-11-07T01:00:00Z'), user = { uid: EVALUATION_UID, isAnonymous: false };
const credentials = { email: 'evaluation@example.invalid', password: 'local-only-evaluation-2026' };
let session, auth, sdk, token, authEvent, online, elapsed, period, role;
const settle = async () => { for (let i = 0; i < 25; i++) await Promise.resolve(); };
const data = () => ({ ...period, startAt: { toMillis: () => period.startAt }, expiresAt: { toMillis: () => period.expiresAt } });
const options = () => ({ auth, db: {}, projectId: 'demo-sismorcego-spark', firebaseEnabled: true, credentials, sdk, online, clock: () => elapsed });
const start = async () => { session.start(); authEvent(auth.currentUser); await session.revalidate(); };
beforeEach(() => {
  jest.useFakeTimers({ now: base }); elapsed = 0; role = 'coordenador';
  period = { enabled: true, startAt: base - 10000, expiresAt: base + 30 * 86400000 }; auth = { currentUser: null };
  token = { claims: { sismorcegoEvaluationAccount: true }, issuedAtTime: new Date(base).toUTCString(), expirationTime: new Date(base + 3600000).toISOString() };
  online = jest.fn().mockResolvedValue(true);
  sdk = { onIdTokenChanged: jest.fn((_, fn) => { authEvent = fn; return jest.fn(); }),
    doc: jest.fn((_, ...parts) => parts.join('/')),
    getDocFromServer: jest.fn(async path => ({ exists: () => true, data: () => path.startsWith('configuracoes/') ? data() : { role } })),
    signInWithEmailAndPassword: jest.fn(async () => { auth.currentUser = user; authEvent(user); return { user }; }),
    getIdTokenResult: jest.fn(async () => ({ ...token, issuedAtTime: new Date(base + elapsed).toUTCString() })),
    signOut: jest.fn(async () => { auth.currentUser = null; authEvent(null); }),
  };
  session = createEvaluationSession(options());
});
afterEach(() => { session.dispose(); jest.clearAllTimers(); jest.useRealTimers(); });

test('clean installation signs in directly with the shared password and passes server-only configuration/profile checks', async () => {
  await start();
  expect(sdk.signInWithEmailAndPassword).toHaveBeenCalledWith(auth, credentials.email, credentials.password);
  expect(sdk.getIdTokenResult).toHaveBeenCalledWith(user, true);
  expect(sdk.getDocFromServer).toHaveBeenCalledWith('configuracoes/avaliacaoCoordenadores');
  expect(sdk.getDocFromServer).toHaveBeenCalledWith('usuarios/' + EVALUATION_UID);
  expect(session.getState()).toMatchObject({ status: 'ready', user, role: 'coordenador' });
  expect(session.provision).toBeUndefined();
});
test('reopening reuses encrypted Firebase persistence without another password sign-in', async () => {
  await start(); session.dispose(); session = createEvaluationSession(options()); await start();
  expect(session.getState().status).toBe('ready'); expect(sdk.signInWithEmailAndPassword).toHaveBeenCalledTimes(1);
});
test.each(['expired','suspended','not-started','unavailable'])('%s does not query the protected profile or open the Shell', async status => {
  if (status === 'expired') period.expiresAt = base - 1;
  if (status === 'suspended') period.enabled = false;
  if (status === 'not-started') period.startAt = base + 60000;
  if (status === 'unavailable') period.enabled = 'yes';
  await start(); expect(session.getState().status).toBe(status);
  expect(sdk.getDocFromServer).not.toHaveBeenCalledWith('usuarios/' + EVALUATION_UID);
});
test('expiration hides data, preserves Auth, and extension restores the same session without a new APK', async () => {
  period.expiresAt = base + 2000; await start(); elapsed = 2001; await jest.advanceTimersByTimeAsync(2001); await settle();
  expect(session.getState().status).toBe('expired'); expect(auth.currentUser).toBe(user);
  period.expiresAt += 30 * 86400000; await session.revalidate();
  expect(session.getState().status).toBe('ready'); expect(sdk.signInWithEmailAndPassword).toHaveBeenCalledTimes(1);
});
test('a known suspension survives network failure and recovers when re-enabled', async () => {
  await start(); period.enabled = false; await session.revalidate();
  expect(session.getState().status).toBe('suspended'); online.mockResolvedValue(false); await session.revalidate();
  expect(session.getState().status).toBe('suspended'); expect(sdk.signOut).not.toHaveBeenCalled();
  online.mockResolvedValue(true); period.enabled = true; await session.revalidate(); expect(session.getState().status).toBe('ready');
});
test('server snapshots revalidate changes, ignore cache and keep a matching initial screen mounted', async () => {
  let control; sdk.onSnapshot = jest.fn((_, config, callback) => { control = callback; return jest.fn(); });
  await start(); const calls = sdk.getDocFromServer.mock.calls.length;
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
  await start();
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
  await start(); expect(session.getState()).toMatchObject({ status: 'blocked', user: null });
});
test('cold offline launch never uses a persisted session to reveal protected data', async () => {
  auth.currentUser = user; online.mockResolvedValue(false); await start();
  expect(session.getState().status).toBe('offline'); expect(sdk.getDocFromServer).not.toHaveBeenCalled();
});
test('network loss retains only the remaining lease; reconnection restores access without deleting Auth', async () => {
  await start(); online.mockResolvedValue(false); await session.revalidate(); expect(session.getState().status).toBe('ready');
  elapsed = 61000; await jest.advanceTimersByTimeAsync(61000); await settle();
  expect(session.getState().status).toBe('offline'); expect(auth.currentUser).toBe(user);
  online.mockResolvedValue(true); await session.revalidate(); expect(session.getState().status).toBe('ready');
});
test('changing the device wall clock cannot extend an expired evaluation', async () => {
  await start(); jest.setSystemTime(base - 365 * 86400000); period.expiresAt = base - 1;
  await session.revalidate(); expect(session.getState().status).toBe('expired');
});
test('foreground invalidates a pre-sleep lease and rechecks the server', async () => {
  await start(); session.setForeground(false); period.enabled = false; session.setForeground(true); await session.revalidate();
  expect(session.getState().status).toBe('suspended');
});
test('lost Firebase session is automatically restored with password sign-in', async () => {
  await start(); auth.currentUser = null; authEvent(null); await session.revalidate();
  expect(session.getState().status).toBe('ready'); expect(sdk.signInWithEmailAndPassword).toHaveBeenCalledTimes(2);
});
test('revoked refresh token is recovered automatically with the configured password', async () => {
  await start(); sdk.getIdTokenResult.mockRejectedValueOnce(Object.assign(new Error(), { code: 'auth/user-token-expired' }));
  await session.revalidate(); expect(session.getState().status).toBe('ready'); expect(sdk.signOut).toHaveBeenCalledTimes(1);
  expect(sdk.signInWithEmailAndPassword).toHaveBeenCalledTimes(2);
});
test('disabled account blocks without attempting to bypass the administrative decision', async () => {
  await start(); sdk.getIdTokenResult.mockRejectedValueOnce(Object.assign(new Error(), { code: 'auth/user-disabled' }));
  await session.revalidate(); expect(session.getState().status).toBe('blocked'); expect(sdk.signInWithEmailAndPassword).toHaveBeenCalledTimes(1);
});
test.each(['uid','anonymous','claim','role','time'])('%s mismatch never enters the coordinator interface', async kind => {
  if (kind === 'uid') sdk.signInWithEmailAndPassword.mockResolvedValue({ user: { ...user, uid: 'other' } });
  if (kind === 'anonymous') sdk.signInWithEmailAndPassword.mockResolvedValue({ user: { ...user, isAnonymous: true } });
  if (kind === 'claim') token.claims.sismorcegoEvaluationAccount = false;
  if (kind === 'role') role = 'acs';
  if (kind === 'time') sdk.getIdTokenResult.mockResolvedValue({ ...token, issuedAtTime: 'invalid' });
  await start(); expect(session.getState().user).toBeNull();
});
test('forced token-refresh events during reactivation cannot clear the fresh lease or loop', async () => {
  await start(); period.enabled = false; await session.revalidate(); period.enabled = true;
  sdk.getIdTokenResult.mockImplementationOnce(async () => { authEvent(user); return token; });
  await session.revalidate(true); expect(session.getState().status).toBe('ready');
});
test('disposal prevents in-flight authentication from opening protected screens', async () => {
  let finish; sdk.signInWithEmailAndPassword.mockImplementation(() => new Promise(resolve => { finish = resolve; }));
  session.start(); authEvent(null); await settle(); session.dispose(); finish({ user }); await settle();
  expect(session.getState().user).toBeNull();
});
test('unsupported builds or missing credentials never fall back to another identity', () => {
  session.dispose(); session = createEvaluationSession({ ...options(), firebaseEnabled: false }); session.start();
  expect(session.getState()).toMatchObject({ status: 'unavailable', user: null, reason: 'unsupported-build' });
  expect(sdk.signInWithEmailAndPassword).not.toHaveBeenCalled();
});
test('expired ID token does not pass validation', () => {
  expect(() => assertEvaluationToken(user, token, base + 3600001)).toThrow();
});
