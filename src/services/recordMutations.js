import { DeviceEventEmitter } from 'react-native';
import { doc,getDoc } from 'firebase/firestore';
import { auth,db } from './firebase';
import { LOCAL_TEST_MODE, LOCAL_TEST_USER } from './debugTestSession';
import { addToQueue, loadQueue } from './offlineQueue';
import { toRecordView, toStoredRecord } from './registroAdapter';
import { appendRecordAudit, assertRecordOwner, assertCanModifyRecord, hasServerCopy, isCancelledRecord, recordIdentity } from './recordLifecycle';
import { newRecordId, withRecordLock } from './recordDraftIdentity';
import { hasRecordEditChanges } from './editChanges';

const actor = () => LOCAL_TEST_MODE ? LOCAL_TEST_USER : auth?.currentUser;
const assertActiveActor = user => {
  if (!user?.uid || actor()?.uid !== user.uid) throw new Error('Sua sessão mudou. Abra o registro novamente.');
};
async function currentRecord(record, user) {
  assertRecordOwner(record, user?.uid);
  const id = String(record.id || record.recordId);
  const saved = (await loadQueue({ uid: user.uid })).find(item => item.uid === user.uid && String(item.recordId) === id);
  assertActiveActor(user);
  if (!saved && !hasServerCopy(record)) throw new Error('Este registro local foi excluído ou não está mais disponível.');
  const current = saved || record._raw || record;
  assertRecordOwner(current, user.uid);
  return current;
}
export function editStoredRecord(record) {
  const user = actor();
  return withRecordLock(recordIdentity(record), async () => {
    const current = await currentRecord(record, user);
    assertCanModifyRecord(current, user.uid);
    const originalReporter = current.nomeNotificador ?? current.nomeAcs ?? '';
    if (record.reporter !== undefined && record.reporter !== originalReporter) throw new Error('O responsável original da ocorrência não pode ser alterado.');
    // Salvar pelo editor, após o aviso de conflito, é a confirmação explícita
    // para reaplicar os campos revisados sobre a base remota consultada.
    const remote = current.syncConflict?.serverRecord;
    const before = remote ? { ...current, ...remote, hasServerCopy:true, baseServerRevision:remote.serverRevision || 0,
      serverRevision:remote.serverRevision || 0, syncConflict:null, auditEvents:current.auditEvents || [] } : current;
    if (isCancelledRecord(before)) throw new Error('Um registro cancelado está disponível somente para consulta.');
    const edited = toStoredRecord({ ...record, id: String(before.recordId), _raw: before }, user.uid);
    if (!hasRecordEditChanges(toRecordView(before), toRecordView(edited))) return toRecordView(current);
    const next = appendRecordAudit(before, { ...edited,
      hasServerCopy: hasServerCopy(before), lifecycleStatus: 'active', syncConflict:null }, user, 'edit');
    await addToQueue(next, { returnQueue: false });
    DeviceEventEmitter.emit('registros:changed');
    return toRecordView(next);
  });
}
export function removeOrCancelStoredRecord(record, reason) {
  const user = actor();
  return withRecordLock(recordIdentity(record), async () => {
    const before = await currentRecord(record, user);
    assertCanModifyRecord(before, user.uid);
    const cancellationReason = String(reason || '').trim();
    if (!cancellationReason) throw new Error('Informe o motivo do cancelamento.');
    if (cancellationReason.length > 2000) throw new Error('A justificativa deve ter no máximo 2000 caracteres.');
    const at = new Date().toISOString();
    const next = appendRecordAudit(before, { ...before, hasServerCopy: hasServerCopy(before), lifecycleStatus: 'cancelled', syncAction: 'upsert',
      cancellation: { actorUid: user.uid, actorName: user.displayName || null, clientAt: at, reason: cancellationReason },
      status: 'pending', lastError: null, retryCount: 0, localRevision: newRecordId(), updatedAtLocal: at }, user, 'cancel', cancellationReason);
    await addToQueue(next, { returnQueue: false });
    DeviceEventEmitter.emit('registros:changed');
    return toRecordView(next);
  });
}

export function acceptRemoteRecordVersion(record) {
  const user=actor();
  return withRecordLock(recordIdentity(record),async()=>{
    const current=await currentRecord(record,user);
    if (!current.syncConflict) throw new Error('Este registro não possui conflito pendente.');
    const snapshot=await getDoc(doc(db,'registros',user.uid,'itens',String(current.recordId)));
    assertActiveActor(user);
    if (!snapshot.exists()) throw new Error('A ocorrência não está disponível no servidor. A cópia local foi preservada.');
    const {conflictArchive=[],...localCopy}=current;
    const remote=snapshot.data();
    const restored={...remote,uid:user.uid,recordId:String(current.recordId),hasServerCopy:true,lifecycleVersion:2,
      baseServerRevision:remote.serverRevision || 0,localRevision:remote.lastMutationId || newRecordId(),
      status:'synced',lastError:null,syncConflict:null,auditEvents:[],
      conflictArchive:[...conflictArchive,{savedAt:new Date().toISOString(),record:localCopy}]};
    await addToQueue(restored,{returnQueue:false});
    DeviceEventEmitter.emit('registros:changed');
    return toRecordView(restored);
  });
}
