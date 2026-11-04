import CryptoJS from 'crypto-js';

export const recordIdentity = record => `${record.uid || record._raw?.uid}/${record.recordId || record.id}`;
export const isCancelledRecord = record => record?.lifecycleStatus === 'cancelled' || record?._raw?.lifecycleStatus === 'cancelled';
export const isActiveRecord = record => !isCancelledRecord(record) && (record.syncAction || record._raw?.syncAction) !== 'delete';
export const hasServerCopy = record => {
  const raw = record._raw || record;
  return Boolean(raw.hasServerCopy || raw.serverWriteAttempted || raw.serverReceivedAt || raw.syncAction === 'delete' || raw._origin === 'cloud'
    || (raw.recordId && raw.lifecycleVersion !== 2)
    || raw.status === 'synced' || raw.status === 'syncing' || record.status === 'synced');
};
// UID original do documento, conservado pelo adaptador que lê o caminho no
// Firestore. Metadados contraditórios e identidades adulteradas falham fechados.
export function recordOwnerUid(record) {
  if (!record) return null;
  const raw = record._raw || record;
  const uid = raw.uid || record.uid;
  if (typeof uid !== 'string' || !uid || (record.uid && record.uid !== uid)) return null;
  const ids = [record.id, record.recordId, raw.recordId].filter(value => value != null).map(String);
  if (!ids.length || ids.some(id => id !== ids[0])) return null;
  return uid;
}
export const isRecordOwner = (record, authenticatedUid) => Boolean(authenticatedUid && recordOwnerUid(record) === authenticatedUid);
export const canModifyRecord = (record, authenticatedUid) => isRecordOwner(record, authenticatedUid)
  && !isCancelledRecord(record) && (record._raw || record).syncConflict?.serverRecord?.lifecycleStatus !== 'cancelled';
export function assertRecordOwner(record, uid) {
  if (!isRecordOwner(record, uid)) throw new Error('Você só pode modificar seus próprios registros. A identidade original deve ser preservada.');
  if (!(record.recordId || record.id)) throw new Error('Registro sem identificação.');
  if (record._raw?.recordId && String(record.id || record.recordId) !== String(record._raw.recordId)) throw new Error('O identificador original do registro não pode ser alterado.');
}
export function assertCanModifyRecord(record, uid) {
  assertRecordOwner(record, uid);
  if (!canModifyRecord(record, uid)) throw new Error('Uma ocorrência cancelada está disponível somente para consulta.');
}

const auditSnapshot = record => {
  const fields = ['tipoVitima', 'nomeAcs', 'nomeNotificador', 'dataAgressao', 'dataMordedura', 'municipio', 'localidade', 'detalhes',
    'location', 'lifecycleStatus', 'cancellation'];
  const result = Object.fromEntries(fields.map(key => [key, record[key] ?? null]));
  // Conteúdo de fotografias é identificado pelo hash; não repetir base64 no histórico.
  result.photo = record.photoBase64 ? { sha256: CryptoJS.SHA256(record.photoBase64).toString(), mime: record.photoMime || null } : null;
  return result;
};
export function appendRecordAudit(before, after, actor, action, reason) {
  const previous = auditSnapshot(before);
  const next = auditSnapshot(after);
  const changes = Object.fromEntries(Object.keys(next).filter(key => JSON.stringify(previous[key]) !== JSON.stringify(next[key]))
    .map(key => [key, { before: previous[key], after: next[key] }]));
  const event = { id: after.localRevision, action, actorUid: actor.uid, actorName: actor.displayName || null,
    clientAt: after.updatedAtLocal, localRevision: after.localRevision, baseServerRevision: before.baseServerRevision || before.serverRevision || 0,
    changes, ...(reason ? { reason } : {}) };
  return { ...after, auditEvents: [...(before.auditEvents || []), event] };
}
