import { doc, runTransaction, serverTimestamp } from 'firebase/firestore';
import { gpsAccuracy, isValidGpsCoordinates } from './gpsCoordinates';

// A trilha confiável compara estes valores antes/depois da transação.
export const recordAuditSnapshot = record => ({
  tipoVitima: record.tipoVitima ?? null, notificadorTipo: record.notificadorTipo ?? null,
  nomeAcs: record.nomeAcs ?? null, dataAgressao: record.dataAgressao ?? null,
  municipio: record.municipio ?? null, localidade: record.localidade ?? null,
  detalhes: record.detalhes ?? null, location: record.location ?? null,
  lifecycleStatus: record.lifecycleStatus || 'active', cancellation: record.cancellation ?? null,
});

export function buildCloudPayload(registro, uid) {
  if (!registro?.recordId || !uid || registro.uid !== uid) throw new Error('Registro sem proprietário válido.');
  if (registro.location && !isValidGpsCoordinates(registro.location.latitude, registro.location.longitude)) {
    throw new Error('Coordenadas GPS inválidas. Atualize a localização do registro antes de sincronizar.');
  }
  // Nesta fase Spark, imagens novas permanecem no aparelho. Campos legados
  // já existentes no servidor não são enviados, removidos ou sobrescritos.
  return {
    recordId: String(registro.recordId), uid,
    tipoVitima: registro.tipoVitima ?? null, notificadorTipo: registro.notificadorTipo ?? null,
    nomeAcs: registro.nomeAcs !== undefined ? registro.nomeAcs : registro.nomeNotificador ?? null,
    dataRegistro: registro.dataRegistro ?? null,
    dataAgressao: registro.dataMordedura ?? registro.dataAgressao ?? null,
    municipio: registro.municipio ?? null, localidade: registro.localidade ?? null,
    detalhes: registro.detalhes ?? null,
    location: registro.location ? {
      latitude: registro.location.latitude, longitude: registro.location.longitude,
      accuracy: gpsAccuracy(registro.location.accuracy), isHighAccuracy: !!registro.location.isHighAccuracy,
      source: registro.location.source ?? null,
    } : null,
    lifecycleStatus: registro.lifecycleStatus || 'active', cancellation: registro.cancellation || null,
    clientRevision: String(registro.localRevision || registro.updatedAtLocal || ''),
    status: 'synced', createdAt: registro.createdAt ?? registro.dataRegistro ?? null, updatedAt: serverTimestamp(),
  };
}

function conflict(remote) {
  const error = new Error(remote?.lifecycleStatus === 'cancelled'
    ? 'Esta ocorrência foi cancelada no servidor. Use a versão do servidor; suas alterações locais serão preservadas no aparelho.'
    : 'Este registro mudou em outro aparelho. Abra Modificar, revise os campos e salve novamente para resolver o conflito. Nenhum dado do servidor foi sobrescrito.');
  error.code = 'sync/conflict';
  error.serverRecord = remote;
  return error;
}

export function writeRecordTransaction(database, registro, uid) {
  const ref = doc(database, 'registros', uid, 'itens', String(registro.recordId));
  return runTransaction(database, async transaction => {
    const existing = await transaction.get(ref);
    const remote = existing.exists() ? existing.data() : null;
    if (remote?.uid && remote.uid !== uid) throw new Error('O proprietário original da ocorrência não corresponde à sessão autenticada.');
    const mutationId = String(registro.localRevision || registro.updatedAtLocal || '');
    if (!mutationId || mutationId.includes('/')) throw new Error('Revisão local inválida. Abra e salve o registro novamente.');
    // Uma confirmação perdida pode ser reenviada sem escrever outra revisão/evento.
    if (remote?.lastMutationId === mutationId) return { serverRevision: remote.serverRevision, lastMutationId: mutationId };
    if (remote && registro.lifecycleVersion === 2 && !registro.hasServerCopy && !registro.serverRevision && !registro.baseServerRevision) throw conflict(remote);
    if (Number(registro.baseServerRevision ?? registro.serverRevision ?? 0) !== Number(remote?.serverRevision || 0)) throw conflict(remote);
    if (!remote && (registro.hasServerCopy || registro.baseServerRevision > 0)) throw new Error('A ocorrência original não está no servidor. A cópia local foi preservada.');
    if (remote?.lifecycleStatus === 'cancelled') throw conflict(remote);
    const payload = buildCloudPayload(registro, uid);
    if (remote) {
      for (const field of ['nomeAcs', 'notificadorTipo']) {
        if ((payload[field] ?? null) !== (remote[field] ?? null)) throw new Error('A autoria original da ocorrência não pode ser alterada.');
      }
    }
    if (!remote) payload.serverReceivedAt = serverTimestamp();
    if (remote?.createdAt !== undefined) payload.createdAt = remote.createdAt;
    if (remote?.dataRegistro !== undefined) payload.dataRegistro = remote.dataRegistro;
    if (payload.cancellation) payload.cancellation = { ...payload.cancellation, serverAt: serverTimestamp() };
    const revision = Number(remote?.serverRevision || 0) + 1;
    payload.serverRevision = revision;
    payload.lastMutationId = mutationId;
    payload.lastAuditId = mutationId;
    const eventsJson = JSON.stringify(registro.auditEvents || []);
    if (eventsJson.length > 60000) throw new Error('Há muitas alterações pendentes neste registro. A cópia local foi preservada para revisão.');
    const audit = {
      actorUid: uid, clientAt: String(registro.updatedAtLocal || registro.createdAt || new Date().toISOString()),
      receivedAt: serverTimestamp(), revision, mutationId,
      action: payload.lifecycleStatus === 'cancelled' ? 'cancel' : remote ? 'edit' : 'create',
      before: remote ? recordAuditSnapshot(remote) : null, after: recordAuditSnapshot(payload),
      // Eventos locais são contexto declarado pelo aparelho; before/after acima
      // são vinculados à mudança efetiva pelas regras, sem base64.
      localEventsJson: eventsJson,
    };
    transaction.set(ref, payload, { mergeFields: Object.keys(payload) });
    transaction.set(doc(database, 'registros', uid, 'itens', String(registro.recordId), 'alteracoes', mutationId), audit);
    return { serverRevision: revision, lastMutationId: mutationId };
  });
}
