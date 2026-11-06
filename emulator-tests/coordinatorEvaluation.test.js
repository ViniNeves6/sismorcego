import { initializeApp, deleteApp } from 'firebase/app';
import { getAuth, connectAuthEmulator, signOut } from 'firebase/auth';
import { getFirestore, connectFirestoreEmulator, doc, getDocFromServer, getDocsFromServer, collectionGroup, setDoc, updateDoc, terminate, setLogLevel } from 'firebase/firestore';
import { initializeApp as initializeAdmin, deleteApp as deleteAdmin } from 'firebase-admin/app';
import { getAuth as adminAuth } from 'firebase-admin/auth';
import { getFirestore as adminFirestore, Timestamp } from 'firebase-admin/firestore';
import { createEvaluationSession, EVALUATION_UID } from '../src/services/evaluationSession';
import { createEvaluationApi } from '../src/services/evaluationApi';
jest.mock('../src/services/appEnvironment', () => ({ EVALUATION_ACCESS_URL: '' }));
if (process.env.FIREBASE_AUTH_EMULATOR_HOST !== '127.0.0.1:9099' || process.env.FIRESTORE_EMULATOR_HOST !== '127.0.0.1:8088') throw new Error('Local demo emulators only.');
const projectId = 'demo-sismorcego-spark', url = 'http://127.0.0.1:5001/demo-sismorcego-spark/southamerica-east1/evaluationAccess';
let admin, config, devices, controllers, record;
beforeAll(() => { setLogLevel('silent'); admin = initializeAdmin({ projectId }, 'evaluation-admin-local'); });
beforeEach(async () => {
  devices = []; controllers = [];
  await adminAuth(admin).createUser({ uid: EVALUATION_UID, displayName: 'Sismorcego Teste' });
  await adminAuth(admin).setCustomUserClaims(EVALUATION_UID, { sismorcegoEvaluationAccount: true });
  await adminFirestore(admin).doc(`usuarios/${EVALUATION_UID}`).set({ role: 'coordenador' });
  config = adminFirestore(admin).doc('configuracoes/avaliacaoCoordenadores');
  await config.set({ enabled: true, startAt: Timestamp.fromMillis(Date.now() - 86400000), expiresAt: Timestamp.fromMillis(Date.now() + 30 * 86400000) });
  record = adminFirestore(admin).doc(`registros/ordinary-acs/itens/local-evaluation-${Date.now()}`);
  await record.set({ uid: 'ordinary-acs', nomeAcs: 'Responsável fictício', updatedAt: Timestamp.now() });
});
afterEach(async () => {
  controllers.forEach(session => session.dispose());
  for (const client of devices) { await terminate(client.db); await signOut(client.auth).catch(() => {}); await deleteApp(client.app); }
  await adminAuth(admin).deleteUser(EVALUATION_UID);
  await adminFirestore(admin).doc(`usuarios/${EVALUATION_UID}`).delete(); await config.delete(); await record.delete();
});
afterAll(async () => { await deleteAdmin(admin); });
const waitFor = (session, status) => new Promise((resolve, reject) => {
  if (session.getState().status === status) { resolve(); return; }
  const timer = setTimeout(() => { stop(); reject(new Error(`Expected ${status}, got ${session.getState().status}`)); }, 18000);
  const stop = session.subscribe(state => { if (state.status === status) { clearTimeout(timer); stop(); resolve(); } });
});
async function device(name, extra = {}) {
  const app = initializeApp({ projectId, apiKey: 'fake-emulator-key' }, 'evaluation-' + name + '-' + Date.now());
  const auth = getAuth(app), db = getFirestore(app);
  connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true }); connectFirestoreEmulator(db, '127.0.0.1', 8088);
  const api = createEvaluationApi({ url }); api.issue = jest.fn(api.issue);
  const options = { auth, db, projectId, backendEnabled: true, api, ...extra };
  const session = createEvaluationSession(options); devices.push({ app, auth, db }); controllers.push(session);
  session.start(); await waitFor(session, 'ready');
  return { app, auth, db, session, options, api };
}

test('two clean installations automatically authenticate through the real local HTTP function and SDKs without provisioning', async () => {
  const a = await device('A'), b = await device('B');
  expect(a.auth.currentUser.uid).toBe(EVALUATION_UID); expect(b.auth.currentUser.uid).toBe(EVALUATION_UID);
  expect((await getDocsFromServer(collectionGroup(a.db,'itens'))).empty).toBe(false);
  await expect(setDoc(doc(a.db,'usuarios',EVALUATION_UID,'dispositivos','A'),{token:'fake',enabled:true})).rejects.toMatchObject({code:'permission-denied'});
  a.session.dispose(); const restored = createEvaluationSession(a.options); controllers.push(restored); restored.start(); await waitFor(restored,'ready');
  expect(a.api.issue).toHaveBeenCalledTimes(1); expect(b.session.getState().status).toBe('ready');
});
test('server-time expiration denies records even with a valid ID token, and remote extension restores the existing session', async () => {
  const a = await device('expiry');
  await config.update({ expiresAt: Timestamp.fromMillis(Date.now() - 1000) }); await a.session.revalidate();
  expect(a.session.getState().status).toBe('expired'); expect(a.auth.currentUser.uid).toBe(EVALUATION_UID);
  await expect(getDocsFromServer(collectionGroup(a.db,'itens'))).rejects.toMatchObject({code:'permission-denied'});
  await expect(updateDoc(doc(a.db,'usuarios',EVALUATION_UID),{email:'fake@example.invalid'})).rejects.toMatchObject({code:'permission-denied'});
  await config.update({ expiresAt: Timestamp.fromMillis(Date.now() + 60 * 86400000) }); await a.session.revalidate();
  expect(a.session.getState().status).toBe('ready'); expect(a.api.issue).toHaveBeenCalledTimes(1);
  expect((await getDocsFromServer(collectionGroup(a.db,'itens'))).empty).toBe(false);
});
test('suspension denies data and cannot be changed by the evaluator; reactivation is automatic', async () => {
  const a = await device('suspension');
  expect((await getDocFromServer(doc(a.db,'configuracoes','avaliacaoCoordenadores'))).exists()).toBe(true);
  await expect(updateDoc(doc(a.db,'configuracoes','avaliacaoCoordenadores'),{enabled:true})).rejects.toMatchObject({code:'permission-denied'});
  await config.update({enabled:false}); await a.session.revalidate(); expect(a.session.getState().status).toBe('suspended');
  await expect(getDocsFromServer(collectionGroup(a.db,'itens'))).rejects.toMatchObject({code:'permission-denied'});
  await config.update({enabled:true}); await a.session.revalidate(); expect(a.session.getState().status).toBe('ready');
});
test.each(['disabled','role','claim'])('server %s revocation prevents automatic token issuance and recovers after administrative reauthorization', async kind => {
  const a = await device(kind);
  if(kind==='disabled')await adminAuth(admin).updateUser(EVALUATION_UID,{disabled:true});
  if(kind==='role')await adminFirestore(admin).doc(`usuarios/${EVALUATION_UID}`).update({role:'acs'});
  if(kind==='claim')await adminAuth(admin).setCustomUserClaims(EVALUATION_UID,{});
  await a.session.revalidate(true); expect(a.session.getState().status).toBe('blocked');
  const response = await fetch(url,{method:'POST',headers:{'Content-Type':'application/json'},body:'{"version":1}'});
  expect((await response.json()).customToken).toBeUndefined();
  await adminAuth(admin).updateUser(EVALUATION_UID,{disabled:false});
  await adminFirestore(admin).doc(`usuarios/${EVALUATION_UID}`).update({role:'coordenador'});
  await adminAuth(admin).setCustomUserClaims(EVALUATION_UID,{sismorcegoEvaluationAccount:true});
  await a.session.revalidate(true); expect(a.session.getState().status).toBe('ready');
});
test('loss of a local Firebase session is recovered automatically while another installation stays connected', async () => {
  const a = await device('lost'), b = await device('other'); await signOut(a.auth);
  await waitFor(a.session,'ready');
  expect(a.auth.currentUser.uid).toBe(EVALUATION_UID); expect(a.api.issue).toHaveBeenCalledTimes(2);
  expect(b.session.getState().status).toBe('ready');
});
test('offline lease expiration hides protected UI without deleting the Firebase session; reconnect restores it', async () => {
  let online = true, elapsed = 0;
  const a = await device('offline',{online:async()=>online,clock:()=>elapsed}); online=false; elapsed=61000;
  await a.session.revalidate(); expect(a.session.getState().status).toBe('offline'); expect(a.auth.currentUser.uid).toBe(EVALUATION_UID);
  online=true; await a.session.revalidate(); expect(a.session.getState().status).toBe('ready');
});
