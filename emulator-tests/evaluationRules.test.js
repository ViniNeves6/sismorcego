import fs from 'fs';
import { initializeTestEnvironment, assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import { doc, getDoc, getDocs, collection, collectionGroup, setDoc, updateDoc, Timestamp, setLogLevel } from 'firebase/firestore';
if(process.env.FIRESTORE_EMULATOR_HOST!=='127.0.0.1:8088')throw new Error('Local demo only.');
const uid='sismorcego-teste-coordenadores';let env;
const seed=(path,data)=>env.withSecurityRulesDisabled(ctx=>setDoc(doc(ctx.firestore(),path),data));
const db=(id,claims={})=>env.authenticatedContext(id,claims).firestore();
beforeAll(async()=>{setLogLevel('silent');env=await initializeTestEnvironment({projectId:'demo-sismorcego-spark',firestore:{host:'127.0.0.1',port:8088,rules:fs.readFileSync('firestore.rules','utf8')}});});
beforeEach(async()=>{await env.clearFirestore();await seed('usuarios/'+uid,{role:'coordenador'});await seed('usuarios/normal-coord',{role:'coordenador'});await seed('usuarios/normal-acs',{role:'acs'});await seed('registros/normal-acs/itens/sample',{uid:'normal-acs',nomeAcs:'Fictitious'});});
afterAll(async()=>{await env.cleanup();});
const config=patch=>seed('configuracoes/avaliacaoCoordenadores',{enabled:true,startAt:Timestamp.fromMillis(Date.now()-100000),expiresAt:Timestamp.fromMillis(Date.now()+86400000),...patch});
test.each(['missing','expired','suspended','future','malformed'])('%s configuration denies only the shared evaluation UID',async kind=>{
  if(kind!=='missing')await config(kind==='expired'?{expiresAt:Timestamp.fromMillis(Date.now()-1000)}:kind==='suspended'?{enabled:false}:kind==='future'?{startAt:Timestamp.fromMillis(Date.now()+100000)}:{expiresAt:'tomorrow'});
  await assertFails(getDocs(collectionGroup(db(uid,{sismorcegoEvaluationAccount:true}),'itens')));
  // A missing/forged claim cannot exempt the fixed evaluation UID.
  await assertFails(getDoc(doc(db(uid),'usuarios',uid)));
  await assertSucceeds(getDocs(collectionGroup(db('normal-coord',{sismorcegoEvaluationAccount:true}),'itens')));
  await assertSucceeds(getDoc(doc(db('normal-acs'),'registros','normal-acs','itens','sample')));
  await assertSucceeds(updateDoc(doc(db('normal-acs'),'usuarios','normal-acs'),{email:'acs@example.invalid'}));
});
test('active evaluation permits existing coordinator reads; expiry/re-enable changes are effective without replacing the ID token',async()=>{
  const shared=db(uid,{sismorcegoEvaluationAccount:true});await config({});
  await assertSucceeds(getDocs(collectionGroup(shared,'itens')));
  await config({enabled:false});await assertFails(getDocs(collectionGroup(shared,'itens')));
  await config({});await assertSucceeds(getDocs(collectionGroup(shared,'itens')));
});
test('only the shared UID can get the status; no client can list or edit the policy',async()=>{
  await config({});
  for(const database of [env.unauthenticatedContext().firestore(),db(uid),db('normal-coord'),db('normal-acs')]){
    const ref=doc(database,'configuracoes','avaliacaoCoordenadores');
    await assertFails(getDocs(collection(database,'configuracoes')));
    await assertFails(updateDoc(ref,{enabled:true,expiresAt:Timestamp.fromMillis(Date.now()+99999999)}));
  }
  await assertSucceeds(getDoc(doc(db(uid),'configuracoes','avaliacaoCoordenadores')));
  for(const database of [env.unauthenticatedContext().firestore(),db('normal-coord'),db('normal-acs')])await assertFails(getDoc(doc(database,'configuracoes','avaliacaoCoordenadores')));
});
