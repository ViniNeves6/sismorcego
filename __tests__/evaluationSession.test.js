import { assertEvaluationToken, createEvaluationSession, parseEvaluationConfiguration } from '../src/services/evaluationSession';
jest.mock('firebase/auth', () => ({}));
jest.mock('firebase/firestore', () => ({}));
jest.mock('../src/services/pushDevices', () => ({ detachPushDevice: jest.fn() }));
jest.mock('../src/services/recordDraftIdentity', () => ({ newRecordId: () => 'installation-1234567890123456' }));
jest.mock('../src/services/firebase', () => ({ auth: null, db: null }));

const id = 'installation-1234567890123456', projectId = 'demo-sismorcego-spark';
const user = { uid: 'shared-coordinator', isAnonymous: false };
let session, auth, sdk, saved, storage, token, authEvent, roleEvent, online;
const packet = changes => JSON.stringify({ version: 1, projectId, uid: user.uid, installationId: id,
  customToken: 'header.payload.signature', expiresAt: Date.now() + 3600000, ...changes });
const settle = async () => { for (let i = 0; i < 12; i++) await Promise.resolve(); };
beforeEach(() => {
  jest.useFakeTimers({ now: new Date('2026-11-06T12:00:00Z') });
  saved = new Map(); online = jest.fn().mockResolvedValue(true); auth = { currentUser: null };
  storage = { getItem: jest.fn(async key => saved.get(key) || null), setItem: jest.fn(async (key, value) => saved.set(key, value)), removeItem: jest.fn(async key => saved.delete(key)) };
  token = { claims: { sismorcegoEvaluationAccount: true, evaluationInstallation: id }, expirationTime: new Date(Date.now() + 3600000).toISOString() };
  sdk = { doc: jest.fn((_, ...path) => path.join('/')),
    onIdTokenChanged: jest.fn((_, fn) => { authEvent = fn; return jest.fn(); }),
    getIdTokenResult: jest.fn(async () => token),
    signInWithCustomToken: jest.fn(async () => { auth.currentUser = user; authEvent?.(user); return { user }; }),
    signOut: jest.fn(async () => { auth.currentUser = null; authEvent?.(null); }),
    getDocFromServer: jest.fn(async () => ({ exists: () => true, data: () => ({ role: 'coordenador' }) })),
    onSnapshot: jest.fn((_, options, fn) => { roleEvent = fn; return jest.fn(); }),
  };
  session = createEvaluationSession({ auth, db: {}, projectId, backendEnabled: true, storage, sdk, online, makeId: () => id, detach: jest.fn().mockResolvedValue() });
});
afterEach(() => { session.dispose(); jest.useRealTimers(); });

test('missing session stays blocked without signing in, fabricating a user or assigning an ACS/coordinator role', async () => {
  await session.start(); authEvent(null); await settle();
  expect(session.getState()).toMatchObject({ status: 'needs-configuration', user: null, role: null, installationId: id });
  expect(sdk.signInWithCustomToken).not.toHaveBeenCalled(); expect(sdk.getDocFromServer).not.toHaveBeenCalled();
});

test('provisioning exchanges a short-lived token and requires both signed claims and the server coordinator role', async () => {
  await session.start(); await session.provision(packet());
  expect(sdk.signInWithCustomToken).toHaveBeenCalledWith(auth, 'header.payload.signature');
  expect(sdk.getDocFromServer).toHaveBeenCalledWith(`usuarios/${user.uid}`);
  expect(session.getState()).toMatchObject({ status: 'ready', user, role: 'coordenador' });
  const metadata = [...saved.values()].find(value => value.includes('verified'));
  expect(metadata).not.toContain('header.payload.signature');
});

test('reopening restores a previously provisioned SDK session without another credential exchange', async () => {
  await session.start(); await session.provision(packet()); session.dispose();
  session = createEvaluationSession({ auth, db: {}, projectId, backendEnabled: true, storage, sdk, online, makeId: () => id });
  await session.start(); authEvent(user); await settle(); await session.revalidate();
  expect(session.getState().status).toBe('ready'); expect(sdk.signInWithCustomToken).toHaveBeenCalledTimes(1);
});

test.each(['account-claim', 'installation', 'role', 'anonymous'])('%s mismatch never opens the coordinator interface', async kind => {
  await session.start();
  if (kind === 'account-claim') token.claims.sismorcegoEvaluationAccount = false;
  if (kind === 'installation') token.claims.evaluationInstallation = 'another-installation';
  if (kind === 'role') sdk.getDocFromServer.mockResolvedValue({ exists: () => true, data: () => ({ role: 'acs' }) });
  if (kind === 'anonymous') sdk.signInWithCustomToken.mockImplementation(async () => { auth.currentUser = { ...user, isAnonymous: true }; return { user: auth.currentUser }; });
  await expect(session.provision(packet())).rejects.toMatchObject({ code: 'evaluation/configuration-rejected' });
  expect(session.getState()).toMatchObject({ status: 'needs-configuration', user: null, role: null });
  expect(sdk.signOut).toHaveBeenCalled();
});

test('revoked refresh credentials clear approval and block access instead of reopening login', async () => {
  await session.start(); await session.provision(packet());
  sdk.getIdTokenResult.mockRejectedValue(Object.assign(new Error(), { code: 'auth/user-token-expired' }));
  await session.revalidate(true);
  expect(session.getState()).toMatchObject({ status: 'needs-configuration', user: null, role: null });
  expect([...saved.values()].some(value => value.includes('verified'))).toBe(false);
});

test('a forced revocation check arriving during a cached check is awaited and never dropped', async () => {
  await session.start(); await session.provision(packet());
  let finishCached;
  sdk.getIdTokenResult.mockImplementationOnce(() => new Promise(resolve => { finishCached = resolve; }))
    .mockRejectedValueOnce(Object.assign(new Error(), { code: 'auth/user-disabled' }));
  const cached = session.revalidate(); await settle();
  const forced = session.revalidate(true);
  finishCached(token); await cached; await forced;
  expect(sdk.getIdTokenResult).toHaveBeenLastCalledWith(user, true);
  expect(session.getState().user).toBeNull(); expect(sdk.signOut).toHaveBeenCalled();
});

test('offline access uses an already verified session only until the token expires', async () => {
  await session.start(); await session.provision(packet()); online.mockResolvedValue(false);
  await session.revalidate(); expect(session.getState().status).toBe('ready');
  sdk.getIdTokenResult.mockRejectedValue(Object.assign(new Error(), { code: 'auth/network-request-failed' }));
  await jest.advanceTimersByTimeAsync(3600001);
  expect(session.getState()).toMatchObject({ status: 'needs-configuration', user: null, role: null, reason: 'connection-required' });
});

test('server role revocation blocks the shared session; cached role snapshots cannot grant access', async () => {
  await session.start(); await session.provision(packet());
  roleEvent({ metadata: { fromCache: true }, exists: () => true, data: () => ({ role: 'acs' }) });
  expect(session.getState().status).toBe('ready');
  roleEvent({ metadata: { fromCache: false }, exists: () => true, data: () => ({ role: 'acs' }) });
  await settle(); expect(session.getState().user).toBeNull(); expect(sdk.signOut).toHaveBeenCalled();
});

test('an arbitrary persisted Firebase user without installation approval is rejected', async () => {
  auth.currentUser = user; await session.start(); authEvent(user); await settle(); await session.revalidate();
  expect(session.getState().user).toBeNull(); expect(sdk.signOut).toHaveBeenCalled();
});

test.each([{ projectId: 'foreign-project' }, { installationId: 'another-installation' }, { uid: '' },
  { expiresAt: 1 }, { customToken: 'invalid' }, { customToken: 'header.payload.' }])('invalid provisioning document %j is rejected before SDK access', async patch => {
  await session.start(); await expect(session.provision(packet(patch))).rejects.toMatchObject({ code: 'evaluation/invalid-configuration' });
  expect(sdk.signInWithCustomToken).not.toHaveBeenCalled();
});

test('unsigned emulator tokens are accepted for parsing only in the explicitly local demo mode', () => {
  expect(() => parseEvaluationConfiguration(packet({ customToken: 'header.payload.' }), { projectId, installationId: id })).toThrow();
  expect(parseEvaluationConfiguration(packet({ customToken: 'header.payload.' }), { projectId, installationId: id, emulator: true })).toBeTruthy();
  expect(() => assertEvaluationToken({ ...user, uid: 'other' }, token, { uid: user.uid, installationId: id }, id)).toThrow();
});
