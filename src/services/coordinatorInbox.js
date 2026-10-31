import { collection, collectionGroup, doc, onSnapshot, orderBy, query, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore';
import { deterministicAlertId } from './alertContract';
import { toRecordView } from './registroAdapter';
import { toCoordinatorAlert, alertRecordKey } from './coordinatorAlerts';
import { parseRegistroDate } from './registroDate';

export const occurrenceReadStateId = (uidAcs, registroId) => {
  if (![uidAcs, registroId].every(v => typeof v === 'string' && v && !/[/:]/.test(v))) throw new Error('Identidade inválida da ocorrência.');
  return `${uidAcs}:${registroId}`;
};
export function buildOccurrenceInbox(uid, records, readStates = [], legacy = []) {
  const states = new Map(readStates.map(s => [`${s.uidAcs}/${s.registroId}`, s.lida]));
  const old = new Map();
  legacy.forEach(item => { const key = alertRecordKey(item); if (key) old.set(key, old.has(key) ? old.get(key) && !!item.lida : !!item.lida); });
  // Cancelar antes do primeiro envio preserva a ocorrência/auditoria, mas não
  // anuncia um caso ativo que nunca chegou à central. Cancelamentos posteriores
  // preservam o alerta e sua identidade/leitura existentes.
  const result = records.filter(record => {
    const raw = record._raw || {};
    return !(raw.lifecycleStatus === 'cancelled' && raw.serverRevision === 1 && raw.serverReceivedAt);
  }).map(record => {
    const key = `${record.uid}/${record.id}`;
    const raw = record._raw || {};
    const alert = { id: deterministicAlertId(uid, record.uid, String(record.id)), uidAcs: record.uid,
      registroId: String(record.id), recipientUid: uid, source: 'occurrence',
      lida: states.has(key) ? states.get(key) : old.get(key) || false,
      createdAt: raw.serverReceivedAt || raw.createdAt || raw.dataRegistro || null,
      serverReceivedAt: raw.serverReceivedAt || null };
    return toCoordinatorAlert(alert, record);
  });
  const represented = new Set(records.map(record => `${record.uid}/${record.id}`));
  legacy.forEach(item => {
    const key = alertRecordKey(item);
    if (!represented.has(key)) {
      represented.add(key);
      result.push(toCoordinatorAlert({ ...item,id:`legacy-${item.id}`,legacyId:item.id,source:'legacy' },null));
    }
  });
  return result.sort((a,b) => (parseRegistroDate(b.createdAt)?.getTime() || 0) - (parseRegistroDate(a.createdAt)?.getTime() || 0));
}

// Três listeners finitos pela sessão, sem criar alertas no cliente ou polling.
// A coleção de ocorrências é a fonte; o feed legado fornece só leitura anterior.
export function subscribeOccurrenceInbox(database, uid, onChange, onError) {
  let active = true;
  const state = { records: [], readStates: [], legacy: [], ready: new Set() };
  const listen = (key, target, convert) => onSnapshot(target, snapshot => {
    if (!active) return;
    if (key === 'readStates' && snapshot.metadata?.hasPendingWrites) return;
    state[key] = snapshot.docs.map(convert);
    state.ready.add(key);
    onChange({ ...state, ready: state.ready.size === 3 });
  }, error => { if (active) onError(error); });
  const stops = [
    listen('records', query(collectionGroup(database,'itens'),orderBy('updatedAt','desc')), item => {
      const parts = item.ref.path.split('/');
      return toRecordView({ ...item.data(), uid: parts[1], recordId: item.id, status:'synced', _origin:'cloud' });
    }),
    listen('readStates', collection(database,'usuarios',uid,'leiturasOcorrencias'), item => ({ ...item.data(), id:item.id })),
    listen('legacy', collection(database,'usuarios',uid,'notificacoes'), item => ({ ...item.data(), id:item.id })),
  ];
  return () => { active = false; stops.forEach(stop => stop()); };
}

export function writeOccurrenceReadState(database, coordinatorUid, alert, read) {
  if (alert.source === 'legacy' && alert.legacyId) return updateDoc(doc(database,'usuarios',coordinatorUid,'notificacoes',alert.legacyId),{lida:!!read});
  const id = occurrenceReadStateId(alert.uidAcs,String(alert.registroId));
  return setDoc(doc(database,'usuarios',coordinatorUid,'leiturasOcorrencias',id), {
    uidAcs:alert.uidAcs, registroId:String(alert.registroId), lida:!!read, updatedAt:serverTimestamp(),
  });
}
