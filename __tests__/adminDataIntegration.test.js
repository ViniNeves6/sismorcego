import { filterPanelRecords, panelKpis, panelChart, recordGpsPoint } from '../src/services/adminPanelData';
import { toRecordView } from '../src/services/registroAdapter';
import { parseRegistroDate } from '../src/services/registroDate';

const raw = (id, tipoVitima, extra = {}) => ({ recordId: id, uid: 'acs-a', tipoVitima,
  municipio: 'Curuçá', dataMordedura: '2026-10-28', ...extra });
const now = new Date(2026, 9, 28, 12);

test('real adapter coordinates populate the heatmap and all GPS counters use the same valid records', () => {
  const records = [
    toRecordView(raw('r1', 'humano', { location: { latitude: -1.4, longitude: -48.4 } })),
    toRecordView(raw('r2', 'caninoFelino')),
    toRecordView(raw('r3', 'aves', { location: { latitude: 91, longitude: 2 } })),
    toRecordView(raw('r4', 'producao', { location: { latitude: 0, longitude: 0 } })),
  ];
  const points = records.map(recordGpsPoint).filter(Boolean);
  expect(points).toHaveLength(2);
  expect(points[0]).toMatchObject({ latitude: -1.4, longitude: -48.4 });
  expect(points[1]).toMatchObject({ latitude: 0, longitude: 0 });
  expect(records.length - points.length).toBe(2);
  expect(panelKpis(records)).toEqual({ total: 4, humanos: 1, animais: 3, caninoFelino: 1, aves: 1, producao: 1 });
});

test.each([
  [{ gps: { latitude: -1, longitude: -48 } }, true],
  [{ location: { latitude: '-1.2', longitude: '-48.3' } }, true],
  [{ latitude: -1, longitude: -48 }, true],
  [{ gps: { lat: null, lng: null } }, false],
  [{ gps: { lat: '', lng: '' } }, false],
  [{ gps: { lat: false, lng: true } }, false],
  [{ gps: { lat: NaN, lng: -48 } }, false],
  [{ gps: { lat: -1, lng: 181 } }, false],
  [{ gps: { lat: Infinity, lng: 0 } }, false],
])('legacy GPS is validated without inventing coordinates: %j', (record, expected) => {
  expect(Boolean(recordGpsPoint(record))).toBe(expected);
});

test('city, victim and period filters agree with the counters, map and trend', () => {
  const records = [
    toRecordView(raw('today', 'caninoFelino', { location: { latitude: -1.4, longitude: -48.4 } })),
    toRecordView(raw('first-day', 'caninoFelino', { dataMordedura: '2026-10-22' })),
    toRecordView(raw('outside', 'caninoFelino', { dataMordedura: '2026-10-21' })),
    toRecordView(raw('future', 'caninoFelino', { dataMordedura: '2026-10-29' })),
    toRecordView(raw('missing', 'caninoFelino', { dataMordedura: null, createdAt: now })),
    toRecordView(raw('invalid', 'caninoFelino', { dataMordedura: '2026-02-31' })),
    toRecordView(raw('other-city', 'caninoFelino', { municipio: 'Belém' })),
    toRecordView(raw('other-type', 'humano')),
  ];
  const filtered = filterPanelRecords(records, { city: 'Curuçá', period: '7', victim: 'canino' }, now);
  expect(filtered.map(record => record.id)).toEqual(['today', 'first-day']);
  expect(panelKpis(filtered)).toMatchObject({ total: 2, humanos: 0, caninoFelino: 2 });
  expect(filtered.map(recordGpsPoint).filter(Boolean)).toHaveLength(1);
  // Day mode intentionally shows five days; month mode includes both filtered dates.
  expect(panelChart(filtered, 'day', now).sum).toBe(1);
  expect(panelChart(filtered, 'month', now).sum).toBe(2);
});

test('daily and monthly buckets handle date-only values, Firestore timestamps, leap days and year boundaries', () => {
  const rows = [
    { isoDate: '2026-01-01' }, { isoDate: '2025-12-31' },
    { dataMordedura: { toDate: () => new Date(2025, 11, 31, 14) } },
    { date: '2025-02-30' }, { date: null },
  ];
  const day = panelChart(rows, 'day', now);
  expect(day.buckets.map(bucket => bucket.caption)).toEqual(['28/12', '29/12', '30/12', '31/12', '01/01']);
  expect(day.values).toEqual([0, 0, 0, 2, 1]);
  expect(panelChart(rows, 'month', now).values).toEqual([0, 0, 0, 2, 1]);
  expect(parseRegistroDate('2024-02-29')).not.toBeNull();
  expect(parseRegistroDate('2025-02-29')).toBeNull();
  expect(parseRegistroDate('2026-02-31T10:00:00Z')).toBeNull();
  expect(parseRegistroDate({ seconds: 0, nanoseconds: 0 }).getTime()).toBe(0);
  expect(parseRegistroDate({ toDate: () => { throw new Error('invalid timestamp'); } })).toBeNull();
});

test('empty or undated histories never invent cases, victims or dated chart values', () => {
  const empty = panelChart([], 'day', now);
  expect(empty.values).toEqual([0, 0, 0, 0, 0]);
  expect(empty.sum).toBe(0);
  expect(panelKpis([{ victimKey: 'desconhecido' }])).toMatchObject({ total: 1, humanos: 0, animais: 0 });
  expect(panelChart([{ date: 'inválida' }], 'day', now).sum).toBe(0);
});
