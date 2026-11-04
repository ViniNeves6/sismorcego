import fs from 'fs';
import { initializeTestEnvironment, assertSucceeds, assertFails } from '@firebase/rules-unit-testing';
import { initializeApp, deleteApp } from 'firebase/app';
import { getAuth, connectAuthEmulator, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, updateProfile, sendPasswordResetEmail, confirmPasswordReset } from 'firebase/auth';
import { getFirestore, connectFirestoreEmulator, doc, setDoc, getDoc, getDocs, collection, collectionGroup, updateDoc, deleteDoc, query, where, orderBy, limit, writeBatch, serverTimestamp, terminate, setLogLevel } from 'firebase/firestore';
import { writeRecordTransaction, buildCloudPayload, recordAuditSnapshot } from '../src/services/recordSyncProtocol';
import { buildOccurrenceInbox, subscribeOccurrenceInbox, writeOccurrenceReadState } from '../src/services/coordinatorInbox';
import { toRecordView } from '../src/services/registroAdapter';
import { ensureAccountRole } from '../src/services/accountBootstrap';
// A base de produção do app não participa: todos os testes passam seu SDK
// conectado ao projeto demo e ao Firestore Emulator explicitamente.
jest.mock('../src/services/firebase',()=>({auth:null,db:null}));

const projectId = 'demo-sismorcego-spark';
if (process.env.FIRESTORE_EMULATOR_HOST !== '127.0.0.1:8088' || process.env.FIREBASE_AUTH_EMULATOR_HOST !== '127.0.0.1:9099') throw new Error('Testes bloqueados: apenas emuladores locais 127.0.0.1 e projeto demo são permitidos.');
let env;
const dbFor = uid => env.authenticatedContext(uid,{ email:`${uid}@example.invalid` }).firestore();
const refFor = (db,id='r1',uid='acs') => doc(db,'registros',uid,'itens',id);
const pending = (id='r1',uid='acs') => ({ recordId:id,uid,lifecycleVersion:2,localRevision:`create-${id}`,updatedAtLocal:'2026-10-29T00:00:00Z',createdAt:'2026-10-29T00:00:00Z',dataRegistro:'2026-10-29T00:00:00Z',dataAgressao:'2026-10-28',tipoVitima:'humano',nomeAcs:'Agente fictício',municipio:'Município fictício',detalhes:{ nomeAgredido:'Pessoa fictícia',idade:30 }, baseServerRevision:0 });
async function seed(path,data) { await env.withSecurityRulesDisabled(ctx => setDoc(doc(ctx.firestore(),path),data)); }
async function remote(db,id='r1') { return (await getDoc(refFor(db,id))).data(); }
async function forgedCommit(db,mutate,{existing=false,id='r1',auditMutate=a=>a}={}) {
  const before = existing ? await remote(db,id) : null;
  const base = buildCloudPayload(pending(id),'acs');
  const data = { ...base, serverReceivedAt:serverTimestamp(),serverRevision:1,lastMutationId:`attack-${id}`,lastAuditId:`attack-${id}` };
  data.clientRevision=data.lastMutationId;
  if (before) Object.assign(data,{ ...before,updatedAt:serverTimestamp(),serverRevision:before.serverRevision+1,lastMutationId:`attack-${id}`,lastAuditId:`attack-${id}`,clientRevision:`attack-${id}` });
  mutate(data);
  const audit = auditMutate({ actorUid:'acs',clientAt:'2026-10-29T00:00:00Z',receivedAt:serverTimestamp(),revision:data.serverRevision,mutationId:data.lastMutationId,
    action:data.lifecycleStatus==='cancelled' ? 'cancel' : existing ? 'edit' : 'create',before:before ? recordAuditSnapshot(before) : null,after:recordAuditSnapshot(data),localEventsJson:'[]' });
  const batch=writeBatch(db);
  batch.set(refFor(db,id),data);
  batch.set(doc(db,`registros/acs/itens/${id}/alteracoes/${data.lastAuditId}`),audit);
  return batch.commit();
}
beforeAll(async () => {
  setLogLevel('silent');
  env=await initializeTestEnvironment({ projectId,firestore:{host:'127.0.0.1',port:8088,rules:fs.readFileSync('firestore.rules','utf8')} });
});
beforeEach(async () => {
  await env.clearFirestore();
  await Promise.all(['acs','other','coord','coord2'].map(uid=>seed(`usuarios/${uid}`,{ role:uid.startsWith('coord')?'coordenador':'acs',email:`${uid}@example.invalid` })));
});
afterAll(async () => { await env?.cleanup(); });

test('actual Auth emulator: registration/name, ACS bootstrap, login/logout and password recovery',async()=>{
  const app=initializeApp({projectId,apiKey:'fake-emulator-key',appId:'test-emulator'},`auth-${Date.now()}`);
  const auth=getAuth(app); connectAuthEmulator(auth,'http://127.0.0.1:9099',{disableWarnings:true});
  const db=getFirestore(app); connectFirestoreEmulator(db,'127.0.0.1',8088);
  try {
    const email=`teste-${Date.now()}@example.invalid`;
    const cred=await createUserWithEmailAndPassword(auth,email,'senha123');
    await updateProfile(cred.user,{displayName:'Pessoa fictícia'});
    expect(await ensureAccountRole(db,cred.user.uid,email)).toBe('acs');
    const uid=cred.user.uid;
    await signOut(auth); expect(auth.currentUser).toBeNull();
    await signInWithEmailAndPassword(auth,email,'senha123');
    expect(auth.currentUser.uid).toBe(uid); expect(auth.currentUser.displayName).toBe('Pessoa fictícia');
    await sendPasswordResetEmail(auth,email);
    const response=await fetch(`http://127.0.0.1:9099/emulator/v1/projects/${projectId}/oobCodes`);
    const codes=await response.json();
    const code=codes.oobCodes.find(item=>item.email===email && item.requestType==='PASSWORD_RESET').oobCode;
    await confirmPasswordReset(auth,code,'outra456');
    await signOut(auth); await signInWithEmailAndPassword(auth,email,'outra456');
    expect(auth.currentUser.uid).toBe(uid);
  } finally { await terminate(db); await signOut(auth); await deleteApp(app); }
});

test('five offline payloads sync once, each coordinator sees five alerts and owns independent read/unread state',async()=>{
  const db=dbFor('acs'), coordinator=dbFor('coord'), coordinator2=dbFor('coord2');
  const payloads=Array.from({length:5},(_,i)=>({...pending(`r${i}`),tipoVitima:i%2?'aves':'humano',detalhes:i%2?{especie:'galinha'}:pending().detalhes}));
  for (const payload of payloads) { await writeRecordTransaction(db,payload,'acs'); await writeRecordTransaction(db,payload,'acs'); }
  const snap=await getDocs(query(collectionGroup(coordinator,'itens'),orderBy('updatedAt','desc')));
  expect(snap.size).toBe(5);
  const records=snap.docs.map(d=>toRecordView({...d.data(),_origin:'cloud'}));
  let inbox=buildOccurrenceInbox('coord',records);
  expect(inbox).toHaveLength(5); expect(new Set(inbox.map(a=>a.id)).size).toBe(5);
  await writeOccurrenceReadState(coordinator,'coord',inbox[0],true);
  let states=(await getDocs(collection(coordinator,'usuarios','coord','leiturasOcorrencias'))).docs.map(d=>d.data());
  expect(buildOccurrenceInbox('coord',records,states).filter(a=>a.lida)).toHaveLength(1);
  expect(buildOccurrenceInbox('coord2',records).filter(a=>a.lida)).toHaveLength(0);
  await writeOccurrenceReadState(coordinator,'coord',inbox[0],false);
  states=(await getDocs(collection(coordinator,'usuarios','coord','leiturasOcorrencias'))).docs.map(d=>d.data());
  expect(buildOccurrenceInbox('coord',records,states).every(a=>!a.lida)).toBe(true);
  await assertFails(writeOccurrenceReadState(coordinator2,'coord',inbox[0],true));
  await assertFails(writeOccurrenceReadState(db,'acs',inbox[0],true));
  await assertFails(setDoc(doc(db,'usuarios','acs','notificacoes','forged'),{lida:false}));
  await assertFails(setDoc(doc(coordinator,'usuarios','coord','notificacoes','forged'),{lida:false}));
});

test('edit and cancellation preserve identity, trusted audit, read history and cancelled details',async()=>{
  const db=dbFor('acs'), coord=dbFor('coord');
  await writeRecordTransaction(db,pending(),'acs');
  const original=await remote(db);
  await writeRecordTransaction(db,{...pending(),hasServerCopy:true,baseServerRevision:1,localRevision:'edit-1',municipio:'Correção fictícia'},'acs');
  const edited=await remote(db);
  const view=toRecordView({...edited,_origin:'cloud'});
  const alert=buildOccurrenceInbox('coord',[view])[0];
  await writeOccurrenceReadState(coord,'coord',alert,true);
  await writeRecordTransaction(db,{...edited,hasServerCopy:true,baseServerRevision:2,localRevision:'cancel-1',lifecycleStatus:'cancelled',cancellation:{actorUid:'acs',actorName:'Agente fictício',reason:'Duplicidade fictícia',clientAt:'2026-10-29T00:00:00Z'}},'acs');
  const cancelled=await remote(db);
  expect(cancelled.serverRevision).toBe(3);
  expect(cancelled.serverReceivedAt.isEqual(original.serverReceivedAt)).toBe(true);
  expect(cancelled.createdAt).toBe(original.createdAt);
  const audits=await getDocs(collection(db,'registros','acs','itens','r1','alteracoes'));
  expect(audits.size).toBe(3);
  const event=audits.docs.find(d=>d.id==='edit-1').data();
  expect(event.before.municipio).toBe('Município fictício'); expect(event.after.municipio).toBe('Correção fictícia');
  expect((await getDoc(refFor(coord))).data().lifecycleStatus).toBe('cancelled');
  const states=(await getDocs(collection(coord,'usuarios','coord','leiturasOcorrencias'))).docs.map(d=>d.data());
  expect(buildOccurrenceInbox('coord',[toRecordView(cancelled)],states)[0]).toMatchObject({id:alert.id,lida:true,lifecycleStatus:'cancelled'});
  await assertFails(deleteDoc(refFor(db))); await assertFails(deleteDoc(refFor(coord)));
  await assertFails(updateDoc(doc(db,'registros','acs','itens','r1','alteracoes','edit-1'),{actorUid:'other'}));
  await assertFails(deleteDoc(doc(db,'registros','acs','itens','r1','alteracoes','edit-1')));
  await expect(writeRecordTransaction(db,{...cancelled,hasServerCopy:true,baseServerRevision:3,localRevision:'reopen',lifecycleStatus:'active'},'acs')).rejects.toThrow('cancelada');
});

test('two phones cannot overwrite a newer revision; explicit review permits a new audited revision',async()=>{
  const db=dbFor('acs'); await writeRecordTransaction(db,pending(),'acs');
  const old=await remote(db);
  await writeRecordTransaction(db,{...old,hasServerCopy:true,baseServerRevision:1,localRevision:'phone-a',municipio:'Versão A'},'acs');
  const second={...old,hasServerCopy:true,baseServerRevision:1,localRevision:'phone-b',municipio:'Versão B'};
  await expect(writeRecordTransaction(db,second,'acs')).rejects.toMatchObject({code:'sync/conflict'});
  expect((await remote(db)).municipio).toBe('Versão A');
  await writeRecordTransaction(db,{...second,baseServerRevision:2,localRevision:'reviewed-b'},'acs');
  expect((await remote(db)).municipio).toBe('Versão B');
  expect((await getDoc(doc(db,'registros','acs','itens','r1','alteracoes','reviewed-b'))).data().before.municipio).toBe('Versão A');
});

test('legacy records and image fields remain readable; no new base64 image reaches Firestore',async()=>{
  const legacy={...pending(),photoBase64:'LEGACY_ONLY',photoMime:'image/jpeg',unknownLegacy:'preservar'};
  delete legacy.lifecycleVersion; delete legacy.localRevision; delete legacy.baseServerRevision;
  await seed('registros/acs/itens/r1',legacy);
  const db=dbFor('acs');
  await writeRecordTransaction(db,{...legacy,hasServerCopy:true,baseServerRevision:0,localRevision:'legacy-edit',photoBase64:'NEW_IMAGE_FORBIDDEN',municipio:'Correção'},'acs');
  const data=await remote(db);
  expect(data.photoBase64).toBe('LEGACY_ONLY'); expect(data.unknownLegacy).toBe('preservar'); expect(data.serverReceivedAt).toBeUndefined();
  await writeRecordTransaction(db,{...pending('new-photo'),photoBase64:'NEW_IMAGE_FORBIDDEN'},'acs');
  expect((await remote(db,'new-photo')).photoBase64).toBeUndefined();
  expect((await getDoc(refFor(dbFor('coord')))).exists()).toBe(true);
});

test('profiles are private; role escalation, demotion and arbitrary permission fields are denied',async()=>{
  const db=dbFor('acs');
  await assertSucceeds(getDoc(doc(db,'usuarios','acs')));
  await assertFails(getDoc(doc(dbFor('coord'),'usuarios','acs')));
  await assertFails(updateDoc(doc(db,'usuarios','acs'),{role:'coordenador'}));
  await assertFails(updateDoc(doc(dbFor('coord'),'usuarios','coord'),{role:'acs'}));
  await assertFails(updateDoc(doc(db,'usuarios','acs'),{isAdmin:true}));
  await assertFails(setDoc(doc(dbFor('new'),'usuarios','new'),{role:'coordenador'}));
  await assertSucceeds(setDoc(doc(dbFor('new'),'usuarios','new'),{role:'acs'}));
});

test('anonymous, other ACS and coordinator writes are denied; own and administrative queries work',async()=>{
  const db=dbFor('acs'); await writeRecordTransaction(db,pending(),'acs');
  await assertSucceeds(getDocs(query(collection(db,'registros','acs','itens'),orderBy('updatedAt','desc'))));
  await assertFails(getDoc(refFor(dbFor('other'))));
  await assertFails(getDocs(collectionGroup(dbFor('other'),'itens')));
  await assertFails(getDocs(collectionGroup(env.unauthenticatedContext().firestore(),'itens')));
  await assertFails(writeRecordTransaction(dbFor('other'),pending(),'acs'));
  await assertFails(updateDoc(refFor(dbFor('coord')),{municipio:'forjado'}));
});

test.each(['acs','coord'])('%s can create, edit and cancel only its own case, preserving audit and one inbox item',async uid=>{
  const db=dbFor(uid),ref=refFor(db,'mine',uid),supervisor=dbFor('coord2');
  await writeRecordTransaction(db,pending('mine',uid),uid);
  const created=(await getDoc(ref)).data();
  await writeRecordTransaction(db,{...created,hasServerCopy:true,baseServerRevision:1,localRevision:'own-edit',municipio:'Município corrigido'},uid);
  const edited=(await getDoc(ref)).data();
  await writeRecordTransaction(db,{...edited,hasServerCopy:true,baseServerRevision:2,localRevision:'own-cancel',lifecycleStatus:'cancelled',
    cancellation:{actorUid:uid,reason:'Justificativa válida',clientAt:'2026-10-29T00:00:00Z'}},uid);
  const cancelled=(await getDoc(ref)).data();
  const audits=await getDocs(query(collection(db,'registros',uid,'itens','mine','alteracoes'),orderBy('revision','asc')));
  expect(audits.docs.map(item=>item.data().action)).toEqual(['create','edit','cancel']);
  expect(audits.docs.map(item=>item.data().actorUid)).toEqual([uid,uid,uid]);
  expect(audits.docs[1].data()).toMatchObject({before:{municipio:created.municipio},after:{municipio:'Município corrigido'},revision:2});
  expect((await getDocs(collection(supervisor,'registros',uid,'itens','mine','alteracoes'))).size).toBe(3);
  const cases=await getDocs(collectionGroup(supervisor,'itens'));
  expect(buildOccurrenceInbox('coord2',cases.docs.map(item=>toRecordView(item.data())))).toHaveLength(1);
  expect(cancelled.createdAt).toBe(created.createdAt);
  expect(cancelled.serverReceivedAt.isEqual(created.serverReceivedAt)).toBe(true);
  await assertFails(updateDoc(ref,{municipio:'Reabertura'}));
  await assertFails(deleteDoc(ref));
});

test.each([['other','acs'],['coord','acs'],['coord','coord2']])('%s cannot edit or cancel %s cases, even with a complete matching audit',async(attacker,ownerUid)=>{
  const ownerDb=dbFor(ownerUid),db=dbFor(attacker),record=pending('protected',ownerUid);
  await writeRecordTransaction(ownerDb,record,ownerUid);
  const remoteRecord=(await getDoc(refFor(ownerDb,'protected',ownerUid))).data();
  await assertFails(writeRecordTransaction(db,{...remoteRecord,hasServerCopy:true,baseServerRevision:1,localRevision:'forged-edit',municipio:'Ataque'},ownerUid));
  await assertFails(writeRecordTransaction(db,{...remoteRecord,hasServerCopy:true,baseServerRevision:1,localRevision:'forged-cancel',lifecycleStatus:'cancelled',
    cancellation:{actorUid:ownerUid,reason:'Ataque',clientAt:'2026-10-29T00:00:00Z'}},ownerUid));
  expect((await getDoc(refFor(ownerDb,'protected',ownerUid))).data().serverRevision).toBe(1);
  expect((await getDocs(collection(ownerDb,'registros',ownerUid,'itens','protected','alteracoes'))).size).toBe(1);
});

test('coordinators can read all audit trails, while ACS cannot read another author history',async()=>{
  for(const uid of ['acs','other','coord','coord2'])await writeRecordTransaction(dbFor(uid),pending('r1',uid),uid);
  for(const uid of ['acs','other','coord','coord2']){
    await assertSucceeds(getDoc(refFor(dbFor('coord'),'r1',uid)));
    await assertSucceeds(getDocs(query(collection(dbFor('coord'),'registros',uid,'itens','r1','alteracoes'),orderBy('revision','desc'),limit(30))));
  }
  await assertFails(getDocs(collection(dbFor('acs'),'registros','other','itens','r1','alteracoes')));
  await assertFails(getDocs(collection(env.unauthenticatedContext().firestore(),'registros','acs','itens','r1','alteracoes')));
});

test.each(['uid','recordId','nomeAcs','notificadorTipo','createdAt','dataRegistro','ownerId','createdByUid'])('original identity/authorship %s cannot be replaced in an audited update',async field=>{
  const db=dbFor('acs'); await writeRecordTransaction(db,pending(),'acs');
  await assertFails(forgedCommit(db,data=>{data[field]='forged';},{existing:true}));
  expect((await remote(db)).serverRevision).toBe(1);
});

test('legacy cases without UID use their original path; contradictory original UID cannot be hijacked',async()=>{
  const legacy=pending(); delete legacy.uid; delete legacy.lifecycleVersion; delete legacy.localRevision;
  await seed('registros/acs/itens/r1',legacy);
  const db=dbFor('acs');
  await writeRecordTransaction(db,{...legacy,uid:'acs',hasServerCopy:true,baseServerRevision:0,localRevision:'legacy-owner',municipio:'Correção legítima'},'acs');
  expect((await remote(db)).uid).toBe('acs');
  await seed('registros/acs/itens/r1',{...(await remote(db)),uid:'other'});
  await assertFails(forgedCommit(db,data=>{data.uid='acs';},{existing:true}));
});

test.each([
  ['nome enorme',d=>{d.nomeAcs='x'.repeat(10000);}],
  ['campo arbitrário',d=>{d.isAdmin=true;}],
  ['base64 novo',d=>{d.photoBase64='AAAA';}],
  ['tipo inválido',d=>{d.tipoVitima=9;}],
  ['identidade forjada',d=>{d.uid='other';}],
  ['campo obrigatório removido',d=>{delete d.createdAt;}],
  ['detalhe enorme',d=>{d.detalhes={nomeAgredido:'x'.repeat(5000)};}],
  ['array em detalhe',d=>{d.detalhes={nomeAgredido:['x']};}],
  ['booleano em nome',d=>{d.detalhes={nomeAgredido:true};}],
  ['idade inválida',d=>{d.detalhes={idade:200};}],
  ['GPS fora do intervalo',d=>{d.location={latitude:200,longitude:0,isHighAccuracy:true};}],
  ['revisão negativa',d=>{d.serverRevision=-1;}],
  ['data de recepção forjada',d=>{d.serverReceivedAt='2020-01-01';}],
  ['estado inválido',d=>{d.lifecycleStatus='deleted';}],
  ['cancelamento sem motivo',d=>{d.lifecycleStatus='cancelled';d.cancellation={actorUid:'acs',reason:'',clientAt:'now',serverAt:serverTimestamp()};}],
  ['motivo só com espaços',d=>{d.lifecycleStatus='cancelled';d.cancellation={actorUid:'acs',reason:' \t\n',clientAt:'now',serverAt:serverTimestamp()};}],
])('security: rejects %s even with a matching atomic audit',async(_,mutate)=>{
  await assertFails(forgedCommit(dbFor('acs'),mutate));
});

test.each([
  ['data imutável',d=>{d.createdAt='2000-01-01';}],
  ['identidade',d=>{d.recordId='hijacked';}],
  ['base64 substituído',d=>{d.photoBase64='replacement';}],
  ['pulo de revisão',d=>{d.serverRevision=100;}],
  ['campo inválido',d=>{d.detalhes={especie:[]};}],
  ['remoção de campo obrigatório',d=>{delete d.uid;}],
  ['reutilização de evento',d=>{d.lastAuditId='create-r1';d.lastMutationId='create-r1';d.clientRevision='create-r1';}],
])('security: update cannot bypass %s',async(_,mutate)=>{
  const db=dbFor('acs'); await writeRecordTransaction(db,pending(),'acs');
  await assertFails(forgedCommit(db,mutate,{existing:true}));
  expect((await remote(db)).serverRevision).toBe(1);
});

test('audit cannot be omitted, forged, detached from parent or replayed',async()=>{
  const db=dbFor('acs');
  await assertFails(setDoc(refFor(db),{...buildCloudPayload(pending(),'acs'),serverRevision:1,lastAuditId:'missing',lastMutationId:'missing',serverReceivedAt:serverTimestamp()}));
  await assertFails(forgedCommit(db,()=>{},{auditMutate:a=>({...a,actorUid:'other'})}));
  await assertFails(forgedCommit(db,()=>{},{auditMutate:a=>({...a,before:{forged:true}})}));
  await assertFails(setDoc(doc(db,'registros','acs','itens','missing','alteracoes','orphan'),{actorUid:'acs'}));
  await writeRecordTransaction(db,pending(),'acs');
  await assertFails(forgedCommit(db,()=>{},{existing:true,auditMutate:a=>({...a,after:{forged:true}})}));
});

test('questions remain private until coordinator publishes; actual application queries are authorized',async()=>{
  const db=dbFor('acs'),coord=dbFor('coord'),other=dbFor('other');
  const ref=doc(db,'duvidas','q1');
  await setDoc(ref,{userId:'acs',titulo:'Uma pergunta fictícia?',resposta:null,createdAt:serverTimestamp()});
  await assertSucceeds(getDocs(query(collection(db,'duvidas'),where('userId','==','acs'))));
  await assertFails(getDoc(doc(other,'duvidas','q1')));
  await assertFails(updateDoc(ref,{resposta:'forjada'}));
  await assertSucceeds(updateDoc(doc(coord,'duvidas','q1'),{resposta:'Resposta fictícia',publicada:true,respondidaEm:serverTimestamp()}));
  await assertSucceeds(getDocs(query(collection(other,'duvidas'),where('publicada','==',true))));
  await assertSucceeds(getDocs(collection(coord,'duvidas')));
  await assertFails(updateDoc(doc(coord,'duvidas','q1'),{userId:'other'}));
});

test('realtime central receives actual SDK snapshots and stops after unsubscribe',async()=>{
  const db=dbFor('acs');
  let stop;
  const received=await new Promise((resolve,reject)=>{
    const timer=setTimeout(()=>reject(new Error('Listener não recebeu ocorrência')),15000);
    stop=subscribeOccurrenceInbox(dbFor('coord'),'coord',value=>{if(value.ready && value.records.length===1){clearTimeout(timer);resolve(value);}},reject);
    writeRecordTransaction(db,pending(),'acs').catch(reject);
  });
  expect(received.records[0].id).toBe('r1');
  stop();
});

test('complete human form with GPS can be created, edited and cancelled within rule evaluation limits',async()=>{
  const db=dbFor('acs');
  const detalhes={nomeAgredido:'Pessoa fictícia',apelido:'Teste',idade:35,sexo:'M',ocupacaoProfissao:'Teste',circunstancia:'outro',
    circunstanciaPraiaQual:null,circunstanciaOutraDescricao:'Relato fictício',buscouAtendimento:'nao',naoBuscouMotivo:'outro',
    abrigoMorcego:'sim',abrigoTipo:'outro',abrigoDescricao:'Exemplo fictício'};
  const record={...pending(),detalhes,location:{latitude:-1.4,longitude:-48.4,accuracy:8,source:'gps',isHighAccuracy:true}};
  await writeRecordTransaction(db,record,'acs');
  await writeRecordTransaction(db,{...record,hasServerCopy:true,baseServerRevision:1,localRevision:'complete-edit',detalhes:{...detalhes,idade:36}},'acs');
  const latest=await remote(db);
  await writeRecordTransaction(db,{...latest,hasServerCopy:true,baseServerRevision:2,localRevision:'complete-cancel',lifecycleStatus:'cancelled',cancellation:{actorUid:'acs',actorName:'Agente fictício',reason:'Teste completo',clientAt:'2026-10-29T00:00:00Z'}},'acs');
  expect((await remote(db)).lifecycleStatus).toBe('cancelled');
});

test('legacy feeds cannot be forged, deleted or read by ACS; devices remain disabled and state paths cannot escape scope',async()=>{
  const coord=dbFor('coord'),acs=dbFor('acs');
  await seed('usuarios/coord/notificacoes/old',{uidAcs:'acs',registroId:'r1',lida:false,createdAt:'legacy'});
  await seed('usuarios/acs/notificacoes/old',{lida:false});
  await assertFails(getDoc(doc(acs,'usuarios','acs','notificacoes','old')));
  await assertSucceeds(updateDoc(doc(coord,'usuarios','coord','notificacoes','old'),{lida:true}));
  await assertFails(updateDoc(doc(coord,'usuarios','coord','notificacoes','old'),{uidAcs:'other'}));
  await assertFails(deleteDoc(doc(coord,'usuarios','coord','notificacoes','old')));
  await assertFails(setDoc(doc(coord,'usuarios','coord','dispositivos','fake'),{token:'fake-token',enabled:true}));
  await assertFails(setDoc(doc(coord,'usuarios','coord','leiturasOcorrencias','bad'),{uidAcs:'../acs',registroId:'r1',lida:true,updatedAt:serverTimestamp()}));
});
