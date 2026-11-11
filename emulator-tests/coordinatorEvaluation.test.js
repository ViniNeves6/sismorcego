import { initializeApp, deleteApp } from 'firebase/app';
import { getAuth, connectAuthEmulator, signOut, signInAnonymously } from 'firebase/auth';
import { getFirestore, connectFirestoreEmulator, doc, getDocFromServer, getDocsFromServer, collectionGroup, setDoc, updateDoc, terminate, setLogLevel } from 'firebase/firestore';
import { initializeApp as initializeAdmin, deleteApp as deleteAdmin } from 'firebase-admin/app';
import { getAuth as adminAuth } from 'firebase-admin/auth';
import { getFirestore as adminFirestore, Timestamp } from 'firebase-admin/firestore';
import { createEvaluationSession, EVALUATION_UID } from '../src/services/evaluationSession';
if (process.env.FIREBASE_AUTH_EMULATOR_HOST !== '127.0.0.1:9099' || process.env.FIRESTORE_EMULATOR_HOST !== '127.0.0.1:8088') throw new Error('Local demo emulators only.');
const projectId = 'demo-sismorcego-spark';
const credentials = { email: 'evaluation@example.invalid', password: 'local-only-evaluation-2026' };
let admin, config, devices, controllers, record;
beforeAll(() => { setLogLevel('silent'); admin = initializeAdmin({ projectId }, 'evaluation-admin-local'); });
beforeEach(async () => {
  devices = []; controllers = [];
  await adminAuth(admin).createUser({ uid: EVALUATION_UID, displayName: 'Sismorcego Teste', ...credentials });
  await adminAuth(admin).setCustomUserClaims(EVALUATION_UID, { sismorcegoEvaluationAccount: true });
  await adminFirestore(admin).doc('usuarios/' + EVALUATION_UID).set({ role: 'coordenador' });
  config = adminFirestore(admin).doc('configuracoes/avaliacaoCoordenadores');
  await config.set({ enabled: true, startAt: Timestamp.fromMillis(Date.now() - 86400000), expiresAt: Timestamp.fromMillis(Date.now() + 30 * 86400000) });
  record = adminFirestore(admin).doc('registros/ordinary-acs/itens/local-password-' + Date.now());
  await record.set({ uid: 'ordinary-acs', nomeAcs: 'Responsável fictício', updatedAt: Timestamp.now() });
});
afterEach(async () => {
  controllers.forEach(session => session.dispose());
  for (const client of devices) { await terminate(client.db); await signOut(client.auth).catch(() => {}); await deleteApp(client.app); }
  await adminAuth(admin).deleteUser(EVALUATION_UID);
  await adminFirestore(admin).doc('usuarios/' + EVALUATION_UID).delete(); await config.delete(); await record.delete();
});
afterAll(async () => { await deleteAdmin(admin); });
const waitFor = (session, status) => new Promise((resolve, reject) => {
  if (session.getState().status === status) { resolve(); return; }
  const timer = setTimeout(() => { stop(); reject(new Error('Expected ' + status + ', got ' + session.getState().status)); }, 18000);
  const stop = session.subscribe(state => { if (state.status === status) { clearTimeout(timer); stop(); resolve(); } });
});
async function device(name, extra = {}) {
  const app = initializeApp({ projectId, apiKey: 'fake-emulator-key' }, 'password-' + name + '-' + Date.now());
  const auth = getAuth(app), db = getFirestore(app);
  connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true }); connectFirestoreEmulator(db, '127.0.0.1', 8088);
  const options = { auth, db, projectId, firebaseEnabled: true, ...extra };
  const session = createEvaluationSession(options); devices.push({ app, auth, db }); controllers.push(session);
  session.start(); await waitFor(session, 'signed-out');
  if (extra.acs) await session.signInAcs(); else await session.signInCoordinator(credentials.email, credentials.password);
  await waitFor(session, 'ready'); return { app, auth, db, session, options };
}

test('two clean clients sign in with the typed coordinator password and share the same UID without any custom backend', async () => {
  const a = await device('A'), b = await device('B');
  expect(a.auth.currentUser.uid).toBe(EVALUATION_UID); expect(b.auth.currentUser.uid).toBe(EVALUATION_UID);
  expect(a.auth.currentUser.providerData.some(p => p.providerId === 'password')).toBe(true);
  expect((await getDocsFromServer(collectionGroup(a.db,'itens'))).empty).toBe(false);
  await expect(setDoc(doc(a.db,'usuarios',EVALUATION_UID,'dispositivos','A'),{token:'fake',enabled:true})).rejects.toMatchObject({code:'permission-denied'});
  a.session.dispose(); const restored = createEvaluationSession(a.options); controllers.push(restored); restored.start(); await waitFor(restored,'ready');
  expect(b.session.getState().status).toBe('ready');
});
test('server-time expiry denies real SDK data reads while Auth stays signed in; extension restores automatically', async () => {
  const a = await device('expiry'); await config.update({expiresAt:Timestamp.fromMillis(Date.now()-1000)});
  await waitFor(a.session,'expired'); expect(a.auth.currentUser.uid).toBe(EVALUATION_UID);
  await expect(getDocsFromServer(collectionGroup(a.db,'itens'))).rejects.toMatchObject({code:'permission-denied'});
  await expect(updateDoc(doc(a.db,'usuarios',EVALUATION_UID),{email:'fake@example.invalid'})).rejects.toMatchObject({code:'permission-denied'});
  await config.update({expiresAt:Timestamp.fromMillis(Date.now()+60*86400000)}); await waitFor(a.session,'ready');
  expect((await getDocsFromServer(collectionGroup(a.db,'itens'))).empty).toBe(false);
});
test('suspension protects records, permits status reads, denies client edits and reactivates the same session', async () => {
  const a = await device('suspension');
  await expect(updateDoc(doc(a.db,'configuracoes','avaliacaoCoordenadores'),{enabled:true})).rejects.toMatchObject({code:'permission-denied'});
  await config.update({enabled:false}); await waitFor(a.session,'suspended');
  expect((await getDocFromServer(doc(a.db,'configuracoes','avaliacaoCoordenadores'))).exists()).toBe(true);
  await expect(getDocsFromServer(collectionGroup(a.db,'itens'))).rejects.toMatchObject({code:'permission-denied'});
  await config.update({enabled:true}); await waitFor(a.session,'ready');
});
test.each(['disabled','role','claim'])('%s blocks the shared session and later administrative restoration recovers automatically', async kind => {
  const a = await device(kind);
  if(kind==='disabled')await adminAuth(admin).updateUser(EVALUATION_UID,{disabled:true});
  if(kind==='role')await adminFirestore(admin).doc('usuarios/'+EVALUATION_UID).update({role:'acs'});
  if(kind==='claim')await adminAuth(admin).setCustomUserClaims(EVALUATION_UID,{});
  await a.session.revalidate(true); expect(a.session.getState().status).toBe('blocked');
  await adminAuth(admin).updateUser(EVALUATION_UID,{disabled:false});
  await adminFirestore(admin).doc('usuarios/'+EVALUATION_UID).update({role:'coordenador'});
  await adminAuth(admin).setCustomUserClaims(EVALUATION_UID,{sismorcegoEvaluationAccount:true});
  await a.session.revalidate(true); expect(a.session.getState().status).toBe('ready');
});
test('lost local Firebase session returns to login without disconnecting another client', async () => {
  const a = await device('lost'), b = await device('other'); await signOut(a.auth); await waitFor(a.session,'signed-out');
  expect(a.auth.currentUser).toBeNull(); expect(b.session.getState().status).toBe('ready');
});
test('ACS enters anonymously, gets its own acs profile, writes only its own data and cannot read other records', async () => {
  const a = await device('acs', { acs: true }); const uid = a.auth.currentUser.uid;
  expect(a.auth.currentUser.isAnonymous).toBe(true); expect(a.session.getState().role).toBe('acs');
  expect((await getDocFromServer(doc(a.db,'usuarios',uid))).data()).toEqual({ email: null, role: 'acs' });
  await expect(getDocsFromServer(collectionGroup(a.db,'itens'))).rejects.toMatchObject({code:'permission-denied'});
  await expect(updateDoc(doc(a.db,'usuarios',uid),{role:'coordenador'})).rejects.toMatchObject({code:'permission-denied'});
});
test('anonymous ACS access stops at the evaluation expiry, even with a direct SDK write', async () => {
  const a = await device('acs-expiry', { acs: true }); const uid = a.auth.currentUser.uid;
  await config.update({expiresAt:Timestamp.fromMillis(Date.now()-1000)}); await waitFor(a.session,'expired');
  await expect(getDocFromServer(doc(a.db,'usuarios',uid))).rejects.toMatchObject({code:'permission-denied'});
  const other = initializeApp({ projectId, apiKey: 'fake-emulator-key' }, 'acs-direct-' + Date.now());
  const otherAuth = getAuth(other), otherDb = getFirestore(other); devices.push({ app: other, auth: otherAuth, db: otherDb });
  connectAuthEmulator(otherAuth, 'http://127.0.0.1:9099', { disableWarnings: true }); connectFirestoreEmulator(otherDb, '127.0.0.1', 8088);
  const { user } = await signInAnonymously(otherAuth);
  await expect(setDoc(doc(otherDb,'usuarios',user.uid),{email:null,role:'acs'})).rejects.toMatchObject({code:'permission-denied'});
});
test('offline lease expiry hides protected UI but keeps Auth, and reconnect restores access', async () => {
  let online = true, elapsed = 0;
  const a = await device('offline',{online:async()=>online,clock:()=>elapsed}); online=false; elapsed=61000;
  await a.session.revalidate(); expect(a.session.getState().status).toBe('offline'); expect(a.auth.currentUser.uid).toBe(EVALUATION_UID);
  online=true; await a.session.revalidate(); expect(a.session.getState().status).toBe('ready');
});
