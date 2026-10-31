import { doc, getDoc } from 'firebase/firestore';
import { db } from './firebase';
import { toRecordView } from './registroAdapter';
import { parseRegistroDate } from './registroDate';

const text = value => typeof value === 'string' && value.trim() ? value.trim() : '';
export const alertRecordKey = alert => alert.uidAcs && alert.registroId !== null && alert.registroId !== undefined && String(alert.registroId).trim()
  ? `${alert.uidAcs}/${alert.registroId}` : null;
export const findAlertRecord = (alert, records) => {
  const key = alertRecordKey(alert);
  return key ? records.find(record => `${record.uid || record._raw?.uid}/${record.id || record.recordId}` === key) : null;
};

export function formatAlertDate(value) {
  const date = parseRegistroDate(value);
  if (!date) return 'Data não informada';
  const day = `${String(date.getDate()).padStart(2, '0')}/${String(date.getMonth() + 1).padStart(2, '0')}/${date.getFullYear()}`;
  const dateOnly = typeof value === 'string' && /^(\d{4}-\d{2}-\d{2}|\d{2}\/\d{2}\/\d{4})$/.test(value);
  return dateOnly ? day : `${day} às ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

export function toCoordinatorAlert(notification, record) {
  const details = record?.details || {};
  const prefix = ({ humano: 'hv', canino: 'cf', aves: 'av', producao: 'pr' })[record?.victimKey];
  const summary = text(notification.summary) || text(notification.resumo) || text(record?._raw?.resumo)
    || text(record?._raw?.descricaoOcorrencia) || text(details[`${prefix}-circ-desc`]) || text(details[`${prefix}-circ`]);
  return {
    ...notification,
    title: record?.title || ({ humano: 'Humano', caninoFelino: 'Canino / Felino', canino: 'Canino / Felino', aves: 'Aves', producao: 'Animal de produção' })[notification.tipoVitima] || '',
    city: record?.city || text(notification.municipio),
    community: record?.community || text(notification.localidade),
    summary,
    date: notification.serverReceivedAt || notification.receivedAt || notification.createdAt || notification.dataHora
      ? formatAlertDate(notification.serverReceivedAt || notification.receivedAt || notification.createdAt || notification.dataHora) : '',
    occurrenceDate: record?.isoDate || null,
    lifecycleStatus: record?.lifecycleStatus || record?._raw?.lifecycleStatus || null,
    reporter: record?.reporter || text(notification.nomeAcs),
  };
}

async function fetchAlertRecord(alert) {
  if (!db) throw new Error('Banco de dados indisponível.');
  const snap = await getDoc(doc(db, 'registros', alert.uidAcs, 'itens', String(alert.registroId)));
  if (!snap.exists()) return null;
  return toRecordView({ ...snap.data(), id: snap.id, recordId: snap.id, uid: alert.uidAcs, status: 'synced', _origin: 'cloud' });
}

// Cache apenas da sessão: a lista e os detalhes compartilham consultas em voo.
export function createAlertRecordResolver(fetchRecord = fetchAlertRecord) {
  const cache = new Map();
  return async (alert, records, { fresh = false } = {}) => {
    const key = alertRecordKey(alert);
    if (!key) throw new Error('O alerta não contém a identificação completa da ocorrência.');
    const loaded = findAlertRecord(alert, records);
    if (loaded && !fresh) return loaded;
    if (fresh) cache.delete(key);
    if (!cache.has(key)) {
      const pending = Promise.resolve().then(() => fetchRecord(alert)).catch(error => {
        cache.delete(key);
        if (String(error.code).includes('permission-denied')) throw new Error('Você não tem permissão para consultar esta ocorrência.');
        if (fresh && loaded && /unavailable|network-request-failed/.test(String(error.code))) return loaded;
        throw error;
      });
      cache.set(key, pending);
    }
    return cache.get(key);
  };
}
