import CryptoJS from 'crypto-js';

export const PRIVATE_PUSH_TITLE = 'Sismorcego — Nova ocorrência recebida';
export const PRIVATE_PUSH_BODY = 'Toque para consultar a ocorrência.';
export function deterministicAlertId(coordinatorUid, ownerUid, recordId) {
  if (![coordinatorUid, ownerUid, recordId].every(value => typeof value === 'string' && value.trim())) throw new Error('Identidade incompleta do alerta.');
  return CryptoJS.SHA256(JSON.stringify([coordinatorUid, ownerUid, recordId])).toString();
}
// Contrato puro para implementação futura no servidor. Não grava nem dispara push.
export function buildAlertContract(coordinatorUid, record, receivedAt) {
  const registroId = String(record.recordId || record.id || '');
  return { id: deterministicAlertId(coordinatorUid, record.uid, registroId), recipientUid: coordinatorUid, uidAcs: record.uid,
    registroId, tipoVitima: record.tipoVitima || null, municipio: record.municipio || null,
    localidade: record.localidade || null, nomeAcs: record.nomeAcs || null,
    serverReceivedAt: receivedAt, createdAt: receivedAt, lida: false };
}
export function occurrencePushTarget(data) {
  if (data?.type !== 'occurrence' || ![data.recipientUid, data.uidAcs, data.registroId].every(value => typeof value === 'string' && value.trim() && !value.includes('/'))) return null;
  return { recipientUid: data.recipientUid, uidAcs: data.uidAcs, registroId: data.registroId,
    ...(typeof data.alertId === 'string' ? { alertId: data.alertId } : {}) };
}
