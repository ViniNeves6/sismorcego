import { isValidGpsCoordinates } from './gpsCoordinates';
import { parseRegistroDate } from './registroDate';
import { isActiveRecord } from './recordLifecycle';

const VICTIM_KEYS = { humano: 'humano', canino: 'canino', caninoFelino: 'canino', canino_felino: 'canino', aves: 'aves', producao: 'producao' };
export const recordVictimKey = record => VICTIM_KEYS[record.victimKey || record.tipoVitima || record.tipo || record._raw?.tipoVitima] || null;
export const recordOccurrenceDate = record => parseRegistroDate(record.isoDate || record.date || record.dataMordedura || record.dataAgressao || record.dataRegistro
  || record._raw?.dataMordedura || record._raw?.dataAgressao || record._raw?.dataRegistro);

const coordinate = value => typeof value === 'number' ? value
  : typeof value === 'string' && value.trim() ? Number(value) : NaN;
export function recordGpsPoint(record) {
  const sources = [record.gps, record.location, record._raw?.location, record];
  for (const source of sources) {
    if (!source) continue;
    const latitude = coordinate(source.lat ?? source.latitude);
    const longitude = coordinate(source.lng ?? source.longitude);
    if (isValidGpsCoordinates(latitude, longitude)) {
      return { latitude, longitude, weight: 1, id: `${record.uid || ''}/${record.id || record.recordId}`, title: record.title, city: record.city };
    }
  }
  return null;
}

export function filterPanelRecords(records, { city = 'all', period = 'all', victim = 'all' } = {}, now = new Date()) {
  const end = new Date(now);
  end.setHours(23, 59, 59, 999);
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - (Number(period) - 1));
  return records.filter(record => {
    if (!isActiveRecord(record)) return false;
    if (city !== 'all' && (record.city || record.municipio) !== city) return false;
    if (victim !== 'all' && recordVictimKey(record) !== victim) return false;
    if (period !== 'all') {
      const date = recordOccurrenceDate(record);
      if (!date || date < start || date > end) return false;
    }
    return true;
  });
}

export function panelKpis(records) {
  records = records.filter(isActiveRecord);
  const counts = { humano: 0, canino: 0, aves: 0, producao: 0 };
  records.forEach(record => {
    const key = recordVictimKey(record);
    if (key) counts[key] += 1;
  });
  return { total: records.length, humanos: counts.humano, animais: counts.canino + counts.aves + counts.producao,
    caninoFelino: counts.canino, aves: counts.aves, producao: counts.producao };
}

export function panelChart(records, mode, now = new Date()) {
  const dates = records.filter(isActiveRecord).map(recordOccurrenceDate).filter(Boolean);
  const latest = dates.length ? new Date(Math.max(...dates.map(date => date.getTime()))) : now;
  const monthNames = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
  const keyFor = date => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}${mode === 'day' ? `-${String(date.getDate()).padStart(2, '0')}` : ''}`;
  const buckets = Array.from({ length: 5 }, (_, i) => {
    const date = mode === 'day' ? new Date(latest.getFullYear(), latest.getMonth(), latest.getDate() - (4 - i))
      : new Date(latest.getFullYear(), latest.getMonth() - (4 - i), 1);
    return { key: keyFor(date), caption: mode === 'day' ? `${String(date.getDate()).padStart(2, '0')}/${String(date.getMonth() + 1).padStart(2, '0')}` : monthNames[date.getMonth()], dateObj: date };
  });
  const counts = new Map();
  dates.forEach(date => counts.set(keyFor(date), (counts.get(keyFor(date)) || 0) + 1));
  const values = buckets.map(({ key }) => counts.get(key) || 0);
  return { buckets, values, sum: values.reduce((a, b) => a + b, 0), max: Math.max(1, ...values),
    periodTitle: mode === 'day' ? 'Evolução nos últimos 5 dias' : 'Evolução nos últimos 5 meses' };
}
