import fs from 'fs';
import { initializeTestEnvironment } from '@firebase/rules-unit-testing';
import { initializeApp, deleteApp } from 'firebase/app';
import { getAuth, connectAuthEmulator, createUserWithEmailAndPassword, updateProfile, signOut } from 'firebase/auth';
import { getFirestore, connectFirestoreEmulator, collection, doc, setDoc, getDoc, getDocs, disableNetwork, enableNetwork, terminate, setLogLevel } from 'firebase/firestore';
import { addToQueue, loadQueue, updateQueueItemIfRevision } from '../src/services/offlineQueue';
import { editStoredRecord, removeOrCancelStoredRecord } from '../src/services/recordMutations';
import { syncPendingRegistros } from '../src/services/syncRegistros';
import { toRecordView } from '../src/services/registroAdapter';
import { buildOccurrenceInbox } from '../src/services/coordinatorInbox';
import { loadRecordAudit } from '../src/services/recordAudit';
import { clear as clearSqlite, close as closeSqlite } from './sqliteBoundary.cjs';

jest.mock('react-native', () => ({ DeviceEventEmitter: { emit: jest.fn() } }));
jest.mock('@react-native-community/netinfo', () => ({ __esModule:true,default:{ fetch:async()=>({isConnected:mockOnline,isInternetReachable:mockOnline}) } }));
jest.mock('../src/services/debugTestSession', () => ({ LOCAL_TEST_MODE:false }));
jest.mock('../src/services/firebase', () => ({ get auth(){return mockSession?.auth;},get db(){return mockSession?.db;} }));
jest.mock('../src/database/db', () => require('./sqliteBoundary.cjs'));
jest.mock('@react-native-async-storage/async-storage', () => ({ getItem:async()=>null,setItem:async()=>{},removeItem:async()=>{} }));

const projectId='demo-sismorcego-spark';
if(process.env.FIRESTORE_EMULATOR_HOST!=='127.0.0.1:8088'||process.env.FIREBASE_AUTH_EMULATOR_HOST!=='127.0.0.1:9099')throw new Error('Somente Firebase Emulator Suite local é permitido.');
let env, users={}, mockSession, mockOnline=true;
const ref=(db,uid,id='case')=>doc(db,'registros',uid,'itens',id);
const raw=(uid,id='case')=>({uid,recordId:id,lifecycleVersion:2,localRevision:`create-${id}`,baseServerRevision:0,
  createdAt:'2026-10-29T00:00:00Z',dataRegistro:'2026-10-29T00:00:00Z',dataAgressao:'2026-10-28',
  tipoVitima:'aves',nomeAcs:'Autor original',notificadorTipo:'acs',municipio:'Belém',detalhes:{especie:'galinha'},status:'pending'});
const choose=name=>{mockSession=users[name];return mockSession;};
async function createCase(id='case'){
  const uid=mockSession.auth.currentUser.uid;
  await addToQueue(raw(uid,id),{returnQueue:false});
  expect((await syncPendingRegistros()).synced).toBe(1);
  return toRecordView((await loadQueue({uid})).find(item=>item.recordId===id));
}
beforeAll(async()=>{
  setLogLevel('silent');
  env=await initializeTestEnvironment({projectId,firestore:{host:'127.0.0.1',port:8088,rules:fs.readFileSync('firestore.rules','utf8')}});
  for(const name of ['acs','other','coord','coord2']){
    const app=initializeApp({projectId,apiKey:'fake-emulator-key',appId:'local-test'},`ownership-${name}-${Date.now()}`);
    const auth=getAuth(app);connectAuthEmulator(auth,'http://127.0.0.1:9099',{disableWarnings:true});
    const db=getFirestore(app);connectFirestoreEmulator(db,'127.0.0.1',8088);
    await createUserWithEmailAndPassword(auth,`${name}-${Date.now()}@example.invalid`,'Emulador123!');
    await updateProfile(auth.currentUser,{displayName:'Autor original'});
    users[name]={app,auth,db,role:name.startsWith('coord')?'coordenador':'acs'};
  }
});
beforeEach(async()=>{
  mockOnline=true;await env.clearFirestore();
  for(const user of Object.values(users))await env.withSecurityRulesDisabled(ctx=>setDoc(doc(ctx.firestore(),'usuarios',user.auth.currentUser.uid),{role:user.role}));
  choose('acs');
  // Inicializa o esquema antes de limpar, inclusive na primeira execução.
  await loadQueue();clearSqlite();
});
afterAll(async()=>{
  // Encerra também a renovação automática de tokens criada pelo AuthInterop.
  for(const user of Object.values(users)){await terminate(user.db);await signOut(user.auth);await deleteApp(user.app);}
  await env?.cleanup();closeSqlite();
});

test.each(['acs','coord'])('real Auth + SQLite + Firestore: %s edits/cancels offline and synchronizes one record with complete audit',async name=>{
  const session=choose(name),uid=session.auth.currentUser.uid;
  const original=await createCase();
  const before=(await getDoc(ref(session.db,uid))).data();
  const inboxBefore=buildOccurrenceInbox(users.coord2.auth.currentUser.uid,[toRecordView(before)]);
  await disableNetwork(session.db);mockOnline=false;
  const edited=await editStoredRecord({...original,city:'Curuçá'});
  expect(edited.id).toBe(original.id);
  expect((await syncPendingRegistros()).reason).toBe('offline');
  const pending=(await loadQueue({uid}))[0];
  expect(pending.auditEvents[0]).toMatchObject({action:'edit',actorUid:uid,changes:{municipio:{before:'Belém',after:'Curuçá'}}});
  expect((await getDoc(ref(users.coord2.db,uid))).data().municipio).toBe('Belém');
  mockOnline=true;await enableNetwork(session.db);expect((await syncPendingRegistros()).synced).toBe(1);
  // Reproduz uma consulta antiga terminando após a confirmação da edição.
  const confirmed = (await loadQueue({uid}))[0];
  expect(await updateQueueItemIfRevision(confirmed.recordId, confirmed.localRevision,
    {...before,status:'synced'}, {uid,cloudRefresh:true})).toBe(false);
  const synced=toRecordView((await loadQueue({uid}))[0]);
  await disableNetwork(session.db);mockOnline=false;
  await expect(removeOrCancelStoredRecord(synced,' \t ')).rejects.toThrow('motivo');
  const cancelled=await removeOrCancelStoredRecord(synced,'Duplicidade documentada');
  expect(cancelled.lifecycleStatus).toBe('cancelled');
  expect((await syncPendingRegistros()).reason).toBe('offline');
  await expect(editStoredRecord(synced)).rejects.toThrow(/cancelad/);
  mockOnline=true;await enableNetwork(session.db);expect((await syncPendingRegistros()).synced).toBe(1);
  const remote=(await getDoc(ref(session.db,uid))).data();
  expect(remote).toMatchObject({uid,recordId:'case',municipio:'Curuçá',serverRevision:3,lifecycleStatus:'cancelled',cancellation:{actorUid:uid,reason:'Duplicidade documentada'}});
  expect(remote.createdAt).toBe(before.createdAt);expect(remote.serverReceivedAt.isEqual(before.serverReceivedAt)).toBe(true);
  const history=await loadRecordAudit(toRecordView(remote));
  expect(history.events.map(event=>event.action)).toEqual(['cancel','edit','create']);
  expect(history.events.every(event=>event.actorUid===uid)).toBe(true);
  expect(history.events[1].before.municipio).toBe('Belém');expect(history.events[1].after.municipio).toBe('Curuçá');
  mockOnline=false;const cachedHistory=await loadRecordAudit(toRecordView(remote));mockOnline=true;
  expect(cachedHistory.offline).toBe(true);expect(cachedHistory.events).toHaveLength(3);
  const cases=await getDocs(collection(session.db,'registros',uid,'itens'));expect(cases.size).toBe(1);
  const inboxAfter=buildOccurrenceInbox(users.coord2.auth.currentUser.uid,[toRecordView(remote)]);
  expect(inboxAfter).toHaveLength(1);expect(inboxAfter[0].id).toBe(inboxBefore[0].id);
});

test.each([['other','acs'],['coord','acs'],['coord','coord2']])('services reject %s changes to %s, including forged view UID and author names',async(attacker,owner)=>{
  const session=choose(owner),original=await createCase();
  choose(attacker);
  for(const view of [original,{...original,uid:mockSession.auth.currentUser.uid,reporter:'Autor original'}]){
    await expect(editStoredRecord({...view,city:'Ataque'})).rejects.toThrow('próprios');
    await expect(removeOrCancelStoredRecord(view,'Ataque')).rejects.toThrow('próprios');
  }
  expect((await getDoc(ref(session.db,session.auth.currentUser.uid))).data().serverRevision).toBe(1);
});

test('a cancelled unsent case remains local and syncs its cancellation without creating an occurrence alert',async()=>{
  const {auth,db}=choose('coord'),uid=auth.currentUser.uid;
  await addToQueue(raw(uid),{returnQueue:false});mockOnline=false;
  await removeOrCancelStoredRecord(toRecordView(raw(uid)),'Cancelada antes do envio');
  expect((await loadQueue({uid}))[0].lifecycleStatus).toBe('cancelled');
  mockOnline=true;expect((await syncPendingRegistros()).synced).toBe(1);
  const remote=(await getDoc(ref(db,uid))).data();
  expect(remote.lifecycleStatus).toBe('cancelled');
  expect(buildOccurrenceInbox(users.coord2.auth.currentUser.uid,[toRecordView(remote)])).toHaveLength(0);
  expect((await getDocs(collection(db,'registros',uid,'itens','case','alteracoes'))).docs[0].data().action).toBe('cancel');
});

test('conflicting offline coordinator edit remains queued and never silently overwrites the newer server revision',async()=>{
  const {auth,db}=choose('coord'),uid=auth.currentUser.uid,original=await createCase();
  const {writeRecordTransaction}=require('../src/services/recordSyncProtocol');
  const before=(await getDoc(ref(db,uid))).data();
  await writeRecordTransaction(db,{...before,hasServerCopy:true,baseServerRevision:1,localRevision:'another-phone',municipio:'Marapanim'},uid);
  mockOnline=false;await editStoredRecord({...original,city:'Curuçá'});
  mockOnline=true;expect((await syncPendingRegistros()).failed).toBe(1);
  expect((await getDoc(ref(db,uid))).data().municipio).toBe('Marapanim');
  const queued=(await loadQueue({uid}))[0];
  expect(queued.municipio).toBe('Curuçá');expect(queued.syncConflict.serverRecord.serverRevision).toBe(2);
  expect(queued.lastError).toContain('Nenhum dado do servidor foi sobrescrito');
});
