/* eslint-env node, es2022 */
// Dados fictícios exclusivos da conferência Android. Nunca aceita projeto real.
const projectId='demo-sismorcego-spark';
if(process.env.FIRESTORE_EMULATOR_HOST!=='127.0.0.1:8088'||process.env.FIREBASE_AUTH_EMULATOR_HOST!=='127.0.0.1:9099'){
  throw new Error('Defina exclusivamente os dois emuladores locais 127.0.0.1 antes de preparar os dados fictícios.');
}
const {initializeApp,deleteApp}=require('firebase-admin/app');
const {getAuth}=require('firebase-admin/auth');
const {getFirestore,FieldValue}=require('firebase-admin/firestore');
const app=initializeApp({projectId});
const auth=getAuth(),db=getFirestore();
const snapshot=record=>Object.fromEntries(['tipoVitima','notificadorTipo','nomeAcs','dataAgressao','municipio','localidade','detalhes','location','lifecycleStatus','cancellation']
  .map(key=>[key,record[key]??null]));
(async()=>{
  const response=await fetch(`http://127.0.0.1:8088/emulator/v1/projects/${projectId}/databases/(default)/documents`,{method:'DELETE'});
  if(!response.ok)throw new Error('Não foi possível limpar os dados fictícios do projeto demo.');
  for(const [uid,email,role,name,id,community] of [
    ['coord-native','coordenador@local.invalid','coordenador','Coordenador local','native-owned','Própria'],
    ['acs-native','acs@local.invalid','acs','ACS local','native-acs','De outro ACS'],
    ['coord2-native','coordenador2@local.invalid','coordenador','Outro coordenador','native-coord2','De outro coordenador'],
  ]){
    try{await auth.getUser(uid);}catch(error){if(error.code!=='auth/user-not-found')throw error;
      await auth.createUser({uid,email,password:'Localtest123',displayName:name,emailVerified:true});}
    await db.doc(`usuarios/${uid}`).set({role,email});
    const record={recordId:id,uid,tipoVitima:'aves',notificadorTipo:role,nomeAcs:name,
      createdAt:'2026-10-29T12:00:00Z',dataRegistro:'2026-10-29T12:00:00Z',dataAgressao:'2026-10-28',
      municipio:'Belém',localidade:community,detalhes:{especie:'galinha',circunstancia:'no_galinheiro',avisouAdeparaOuMunicipio:'sim'},location:null,
      lifecycleStatus:'active',cancellation:null,clientRevision:'initial',status:'synced',updatedAt:FieldValue.serverTimestamp(),
      serverReceivedAt:FieldValue.serverTimestamp(),serverRevision:1,lastMutationId:'initial',lastAuditId:'initial'};
    const batch=db.batch();
    batch.set(db.doc(`registros/${uid}/itens/${id}`),record);
    batch.set(db.doc(`registros/${uid}/itens/${id}/alteracoes/initial`),{
      actorUid:uid,clientAt:record.createdAt,receivedAt:FieldValue.serverTimestamp(),revision:1,mutationId:'initial',action:'create',
      before:null,after:snapshot(record),localEventsJson:'[]',
    });
    await batch.commit();
  }
  console.log('Projeto demo preparado. Login local: coordenador@local.invalid / Localtest123. Nenhum projeto real foi acessado.');
  await db.terminate();await deleteApp(app);
})().catch(error=>{console.error(error.message);process.exitCode=1;});
