import { assertEvaluationToken, createEvaluationSession, EVALUATION_UID } from '../src/services/evaluationSession';
jest.mock('firebase/auth', () => ({}));
jest.mock('firebase/firestore', () => ({}));
jest.mock('../src/services/appEnvironment', () => ({ EVALUATION_ACCESS_URL: '' }));

const base = Date.parse('2026-11-06T15:00:00Z'), user = { uid: EVALUATION_UID, isAnonymous: false };
let session, auth, sdk, api, token, authEvent, online, elapsed, period, blocked;
const settle = async () => { for (let i = 0; i < 25; i++) await Promise.resolve(); };
const snapshot = () => ({ version: 1, state: blocked || (!period.enabled ? 'suspended' : base + elapsed >= period.expiresAt ? 'expired' : 'active'),
  serverTime: base + elapsed, startAt: base - 1000, expiresAt: period.expiresAt, leaseMs: 60000 });
const options = () => ({ auth, db: {}, projectId: 'demo-sismorcego-spark', backendEnabled: true, sdk, api, online, clock: () => elapsed });
const start = async () => { session.start(); authEvent(auth.currentUser); await session.revalidate(); };
const advance = async ms => { elapsed += ms; await jest.advanceTimersByTimeAsync(ms); await settle(); };
beforeEach(() => {
  jest.useFakeTimers({ now: base }); elapsed = 0; blocked = null;
  period = { enabled: true, expiresAt: base + 30 * 86400000 }; auth = { currentUser: null };
  token = { claims: { sismorcegoEvaluationAccount: true }, expirationTime: new Date(base + 3600000).toISOString() };
  online = jest.fn().mockResolvedValue(true);
  api = { status: jest.fn(async () => snapshot()), issue: jest.fn(async () => ({ ...snapshot(), uid: EVALUATION_UID, customToken: 'server-issued-token' })) };
  sdk = { onIdTokenChanged: jest.fn((_, fn) => { authEvent = fn; return jest.fn(); }),
    doc: jest.fn((_, ...parts) => parts.join('/')),
    getDocFromServer: jest.fn(async () => ({ exists: () => true, data: () => ({ role: 'coordenador' }) })),
    signInWithCustomToken: jest.fn(async () => { auth.currentUser = user; authEvent(user); return { user }; }),
    getIdTokenResult: jest.fn(async () => token),
    signOut: jest.fn(async () => { auth.currentUser = null; authEvent(null); }),
  };
  session = createEvaluationSession(options());
});
afterEach(() => { session.dispose(); jest.clearAllTimers(); jest.useRealTimers(); });

test('clean install signs in automatically through the server and requires a real coordinator profile', async () => {
  await start();
  expect(api.issue).toHaveBeenCalledTimes(1);
  expect(sdk.signInWithCustomToken).toHaveBeenCalledWith(auth, 'server-issued-token');
  expect(sdk.getDocFromServer).toHaveBeenCalledWith(`usuarios/${EVALUATION_UID}`);
  expect(session.getState()).toMatchObject({ status: 'ready', user, role: 'coordenador' });
  expect(session.provision).toBeUndefined(); expect(session.getState().installationId).toBeUndefined();
});
test('reopening reuses persisted Firebase Auth without another custom token or local approval marker', async () => {
  await start(); session.dispose(); session = createEvaluationSession(options()); await start();
  expect(session.getState().status).toBe('ready'); expect(api.issue).toHaveBeenCalledTimes(1);
});
test.each(['expired', 'suspended', 'blocked', 'not-started'])('%s blocks a clean install without requesting a token', async status => {
  blocked = status; await start(); expect(api.issue).not.toHaveBeenCalled();
  expect(session.getState()).toMatchObject({ status, user: null, role: null });
});
test('expiration blocks at the server deadline; extension reuses the session without reinstalling', async () => {
  period.expiresAt = base + 1000; await start(); await advance(1001);
  expect(session.getState()).toMatchObject({ status: 'expired', user: null });
  expect(auth.currentUser).toBe(user); expect(sdk.signOut).not.toHaveBeenCalled();
  period.expiresAt += 30 * 86400000; await session.revalidate();
  expect(session.getState().status).toBe('ready'); expect(api.issue).toHaveBeenCalledTimes(1);
});
test('suspension survives offline errors; reactivation restores without clearing Firebase persistence', async () => {
  await start(); period.enabled = false; await session.revalidate();
  expect(session.getState().status).toBe('suspended'); online.mockResolvedValue(false); await session.revalidate();
  expect(session.getState().user).toBeNull(); expect(sdk.signOut).not.toHaveBeenCalled();
  online.mockResolvedValue(true); period.enabled = true; await session.revalidate();
  expect(session.getState().status).toBe('ready'); expect(api.issue).toHaveBeenCalledTimes(1);
});
test('ID-token refresh events during reactivation cannot erase the fresh server lease', async () => {
  await start(); period.enabled = false; await session.revalidate(); period.enabled = true;
  sdk.getIdTokenResult.mockImplementationOnce(async () => { authEvent(user); return token; });
  await session.revalidate(true); expect(session.getState().status).toBe('ready');
});
test('cached policy snapshots cannot grant/block access; matching first server snapshot preserves the initial screen', async () => {
  let control;
  sdk.onSnapshot = jest.fn((_, options, callback) => { control = callback; return jest.fn(); });
  await start(); const calls = api.status.mock.calls.length;
  const data = enabled => ({ enabled, startAt: { toMillis: () => base - 1000 }, expiresAt: { toMillis: () => period.expiresAt } });
  control({ metadata: { fromCache: true }, exists: () => true, data: () => data(false) });
  control({ metadata: { fromCache: false }, exists: () => true, data: () => data(true) });
  await settle(); expect(session.getState().status).toBe('ready'); expect(api.status).toHaveBeenCalledTimes(calls);
  period.enabled = false;
  control({ metadata: { fromCache: false }, exists: () => true, data: () => data(false) });
  await session.revalidate(); expect(session.getState().status).toBe('suspended');
  period.enabled = true; period.expiresAt += 30 * 86400000;
  control({ metadata: { fromCache: false }, exists: () => true, data: () => data(true) });
  await session.revalidate(); expect(session.getState().status).toBe('ready'); expect(api.issue).toHaveBeenCalledTimes(1);
});
test('cold offline launch never opens cached protected screens', async () => {
  auth.currentUser = user; online.mockResolvedValue(false); await start();
  expect(session.getState()).toMatchObject({ status: 'offline', user: null }); expect(api.issue).not.toHaveBeenCalled();
});
test('network loss allows at most the remaining server lease and cannot extend a known expiration', async () => {
  await start(); online.mockResolvedValue(false); await session.revalidate(); expect(session.getState().status).toBe('ready');
  await advance(60001); expect(session.getState()).toMatchObject({ status: 'offline', user: null });
  expect(auth.currentUser).toBe(user);
  online.mockResolvedValue(true); await session.revalidate(); expect(session.getState().status).toBe('ready');
});
test('device wall clock changes cannot grant time or hide a server-side suspension', async () => {
  await start(); jest.setSystemTime(base - 365 * 86400000); period.enabled = false; await session.revalidate();
  expect(session.getState().status).toBe('suspended');
});
test('foreground always rechecks the server, even when the monotonic timer did not advance during sleep', async () => {
  await start(); session.setForeground(false); blocked = 'expired'; session.setForeground(true); await session.revalidate();
  expect(session.getState()).toMatchObject({ status: 'expired', user: null });
});
test('loss of the local session triggers automatic recovery instead of a login or setup screen', async () => {
  await start(); auth.currentUser = null; authEvent(null); await session.revalidate();
  expect(session.getState().status).toBe('ready'); expect(api.issue).toHaveBeenCalledTimes(2);
});
test('revoked refresh token can be re-established only when the server authorizes issuance', async () => {
  await start(); sdk.getIdTokenResult.mockRejectedValueOnce(Object.assign(new Error(), { code: 'auth/user-token-expired' }));
  await session.revalidate(true); expect(session.getState().status).toBe('ready');
  expect(sdk.signOut).toHaveBeenCalledTimes(1); expect(api.issue).toHaveBeenCalledTimes(2);
});
test('disabled shared account is blocked by the server without repeated token issuance', async () => {
  await start(); blocked = 'blocked'; await session.revalidate(true);
  expect(session.getState().status).toBe('blocked'); expect(api.issue).toHaveBeenCalledTimes(1);
});
test.each(['uid', 'anonymous', 'claim', 'role'])('%s mismatch cannot enter the coordinator interface', async kind => {
  if (kind === 'uid') sdk.signInWithCustomToken.mockImplementation(async () => ({ user: { ...user, uid: 'other' } }));
  if (kind === 'anonymous') sdk.signInWithCustomToken.mockImplementation(async () => ({ user: { ...user, isAnonymous: true } }));
  if (kind === 'claim') token.claims.sismorcegoEvaluationAccount = false;
  if (kind === 'role') sdk.getDocFromServer.mockResolvedValue({ exists: () => true, data: () => ({ role: 'acs' }) });
  await start(); expect(session.getState().user).toBeNull(); expect(session.getState().role).toBeNull();
});
test('forced renewal is not swallowed by an already running cached-token check', async () => {
  await start(); let finish;
  sdk.getIdTokenResult.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
  const a = session.revalidate(); await settle(); const b = session.revalidate(true); finish(token); await a; await b;
  expect(sdk.getIdTokenResult).toHaveBeenLastCalledWith(user, true);
});
test('a suspension occurring while a token is being requested is applied before SDK sign-in', async () => {
  api.issue.mockResolvedValue({ ...snapshot(), state: 'suspended' }); await start();
  expect(session.getState().status).toBe('suspended'); expect(sdk.signInWithCustomToken).not.toHaveBeenCalled();
});
test('disposed and background requests cannot reopen protected screens', async () => {
  let finish; api.status.mockImplementation(() => new Promise(resolve => { finish = resolve; }));
  session.start(); authEvent(null); await settle(); session.dispose(); finish(snapshot()); await settle();
  expect(session.getState().user).toBeNull(); expect(sdk.signInWithCustomToken).not.toHaveBeenCalled();
});
test('an unsupported build never enables local fake authentication or public access', () => {
  session.dispose(); session = createEvaluationSession({ ...options(), backendEnabled: false }); session.start();
  expect(session.getState()).toMatchObject({ status: 'unavailable', user: null, reason: 'unsupported-build' });
  expect(api.issue).not.toHaveBeenCalled();
});
test('expired ID token never passes validation even during a valid evaluation', () => {
  expect(() => assertEvaluationToken(user, token, base + 3600001)).toThrow();
});
