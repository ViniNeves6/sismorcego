import NetInfo from '@react-native-community/netinfo';
import { collection, getDocs, limit, orderBy, query, startAfter } from 'firebase/firestore';
import { auth, db } from './firebase';
import { LOCAL_TEST_MODE, LOCAL_TEST_USER } from './debugTestSession';
import { loadQueue, updateQueueItemIfRevision } from './offlineQueue';
import { isRecordOwner, recordOwnerUid, recordIdentity } from './recordLifecycle';
import { withRecordLock } from './recordDraftIdentity';

const actor = () => LOCAL_TEST_MODE ? LOCAL_TEST_USER : auth?.currentUser;
const assertSession = uid => { if (!uid || actor()?.uid !== uid) throw new Error('Sua sessão mudou. Consulte o histórico novamente.'); };
const eventId = event => event.mutationId || event.id;
export function mergeRecordAudit(serverEvents = [], localEvents = []) {
  const confirmed = new Set(serverEvents.map(eventId));
  return [
    ...localEvents.filter(event => !confirmed.has(eventId(event))).map(event => ({ ...event, pending: true })),
    ...serverEvents.map(event => ({ ...event, pending: false })),
  ].sort((a, b) => a.pending !== b.pending ? Number(b.pending) - Number(a.pending)
    : a.pending ? String(b.clientAt).localeCompare(String(a.clientAt)) : b.revision - a.revision);
}

export async function loadRecordAudit(record, { cursor } = {}) {
  const uid = actor()?.uid;
  assertSession(uid);
  const ownerUid = recordOwnerUid(record);
  if (!ownerUid) throw new Error('Identidade original da ocorrência inválida.');
  const id = String(record.id || record.recordId);
  const own = isRecordOwner(record, uid);
  const local = own ? (await loadQueue({ uid })).find(item => recordIdentity(item) === recordIdentity(record)) : null;
  assertSession(uid);
  const net = LOCAL_TEST_MODE ? null : await NetInfo.fetch();
  assertSession(uid);
  if (LOCAL_TEST_MODE || !net.isConnected || net.isInternetReachable === false) {
    if (!own) throw new Error('Conecte-se para consultar o histórico desta ocorrência.');
    return { events: mergeRecordAudit(local?.serverAuditEvents, local?.auditEvents), offline: true, cursor: null, hasMore: false };
  }
  // A autorização de leitura de terceiros é decidida pelas regras, usando o
  // papel protegido em usuarios/{UID}; nenhum papel informado pelo formulário.
  const source = collection(db, 'registros', ownerUid, 'itens', id, 'alteracoes');
  const snapshot = await getDocs(query(source, orderBy('revision', 'desc'), ...(cursor ? [startAfter(cursor)] : []), limit(30)));
  assertSession(uid);
  const events = snapshot.docs.map(item => ({ ...item.data(), id: item.id }));
  if (own && !cursor) await withRecordLock(recordIdentity(record), async () => {
    assertSession(uid);
    const current = (await loadQueue({ uid })).find(item => recordIdentity(item) === recordIdentity(record));
    assertSession(uid);
    if (current) await updateQueueItemIfRevision(id, current.localRevision || current.updatedAtLocal,
      { serverAuditEvents: events }, { uid, preserveLocalTime: true });
  });
  assertSession(uid);
  return { events: mergeRecordAudit(events, cursor ? [] : local?.auditEvents), offline: false,
    cursor: snapshot.docs.at(-1) || null, hasMore: snapshot.docs.length === 30 };
}
