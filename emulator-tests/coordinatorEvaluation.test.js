import fs from 'fs';
import path from 'path';
import os from 'os';
import { initializeApp, deleteApp } from 'firebase/app';
import { getAuth, connectAuthEmulator, getIdTokenResult, signOut } from 'firebase/auth';
import { getFirestore, connectFirestoreEmulator, doc, setDoc, terminate, setLogLevel } from 'firebase/firestore';
import { initializeApp as initializeAdmin, deleteApp as deleteAdmin } from 'firebase-admin/app';
import { getAuth as adminAuth } from 'firebase-admin/auth';
import { getFirestore as adminFirestore } from 'firebase-admin/firestore';
import { createEvaluationSession } from '../src/services/evaluationSession';
const { provision } = require('../scripts/provision-coordinator-device.cjs');
jest.mock('../src/services/firebase', () => ({ auth: null, db: null }));
jest.mock('../src/services/pushDevices', () => ({ detachPushDevice: async () => {} }));
jest.mock('../src/services/recordDraftIdentity', () => ({ newRecordId: () => 'not-used-in-tests-1234567890' }));
if (process.env.FIREBASE_AUTH_EMULATOR_HOST !== '127.0.0.1:9099' || process.env.FIRESTORE_EMULATOR_HOST !== '127.0.0.1:8088') throw new Error('Local demo emulators only.');
const projectId = 'demo-sismorcego-spark';
let admin, uid, folder, devices, controllers;
beforeAll(() => { setLogLevel('silent'); admin = initializeAdmin({ projectId }, 'evaluation-admin-local'); });
beforeEach(async () => {
  devices = []; controllers = [];
  folder = fs.mkdtempSync(path.join(os.tmpdir(), 'sismorcego-evaluation-local-'));
  uid = `evaluation-${Date.now()}`;
  await adminAuth(admin).createUser({ uid, displayName: 'Sismorcego Teste' });
  await adminAuth(admin).setCustomUserClaims(uid, { sismorcegoEvaluationAccount: true });
  await adminFirestore(admin).doc(`usuarios/${uid}`).set({ role: 'coordenador' });
});
afterEach(async () => {
  controllers.forEach(session => session.dispose());
  for (const client of devices) { await terminate(client.db); await signOut(client.auth).catch(() => {}); await deleteApp(client.app); }
  await adminAuth(admin).deleteUser(uid);
  for (const name of fs.readdirSync(folder)) fs.unlinkSync(path.join(folder, name));
  fs.rmdirSync(folder);
});
afterAll(async () => { await deleteAdmin(admin); });
async function device(name) {
  const installationId = `evaluation-device-${name}-1234567890`;
  const output = path.join(folder, `${name}.json`);
  await provision({ emulator: true, project: projectId, uid, installation: installationId, output });
  const app = initializeApp({ projectId, apiKey: 'fake-emulator-key', appId: 'evaluation-local' }, `${uid}-${name}`);
  const auth = getAuth(app), db = getFirestore(app);
  connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true }); connectFirestoreEmulator(db, '127.0.0.1', 8088);
  const values = new Map();
  const storage = { getItem: async key => values.get(key) || null, setItem: async (key, value) => { values.set(key, value); }, removeItem: async key => { values.delete(key); } };
  const options = { auth, db, projectId, backendEnabled: true, emulator: true, storage, makeId: () => installationId, detach: async () => {} };
  const session = createEvaluationSession(options);
  devices.push({ app, auth, db }); controllers.push(session);
  await session.start(); await session.provision(fs.readFileSync(output, 'utf8'));
  return { app, auth, db, session, options };
}
const blocked = session => new Promise((resolve, reject) => {
  if (session.getState().status === 'needs-configuration') { resolve(); return; }
  const timer = setTimeout(() => reject(new Error('Session was not blocked')), 10000);
  const stop = session.subscribe(state => { if (state.status === 'needs-configuration') { clearTimeout(timer); stop(); resolve(); } });
});

test('the real local Auth SDK provisions two installations for the same coordinator, refreshes and restores without passwords', async () => {
  const a = await device('A'), b = await device('B');
  expect(a.auth.currentUser.uid).toBe(uid); expect(b.auth.currentUser.uid).toBe(uid);
  expect(a.session.getState().role).toBe('coordenador'); expect(b.session.getState().role).toBe('coordenador');
  const token = await getIdTokenResult(a.auth.currentUser, true);
  expect(token.claims.evaluationInstallation).toBe('evaluation-device-A-1234567890');
  expect(token.claims.sismorcegoEvaluationAccount).toBe(true);
  // Push backend is deliberately disabled in the current app/rules. Do not
  // weaken those rules just to make this test write fake tokens successfully.
  await expect(setDoc(doc(a.db, 'usuarios', uid, 'dispositivos', 'A'), { token: 'fictitious-A', enabled: true })).rejects.toMatchObject({ code: 'permission-denied' });
  await expect(setDoc(doc(b.db, 'usuarios', uid, 'dispositivos', 'B'), { token: 'fictitious-B', enabled: true })).rejects.toMatchObject({ code: 'permission-denied' });
  a.session.dispose();
  const restored = createEvaluationSession(a.options); controllers.push(restored);
  await restored.start(); await restored.revalidate();
  expect(restored.getState().status).toBe('ready');
  await signOut(a.auth); await blocked(restored);
  expect(b.session.getState().status).toBe('ready');
  expect((await getIdTokenResult(b.auth.currentUser, true)).claims.sismorcegoEvaluationAccount).toBe(true);
});

test('a server-side role removal blocks the installed session without a login fallback', async () => {
  const a = await device('role-change');
  await adminFirestore(admin).doc(`usuarios/${uid}`).update({ role: 'acs' });
  await blocked(a.session);
  expect(a.session.getState().user).toBeNull(); expect(a.session.getState().role).toBeNull();
});

test('a disabled Auth user cannot renew the session and is blocked', async () => {
  const a = await device('disabled');
  await adminAuth(admin).updateUser(uid, { disabled: true });
  await a.session.revalidate(true); await blocked(a.session);
  expect(a.session.getState().user).toBeNull();
});
