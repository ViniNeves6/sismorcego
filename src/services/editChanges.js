import { registroIsoDate } from './registroDate';

export const normalizeName = value => String(value || '').normalize('NFC').trim().replace(/\s+/g, ' ');
export const normalizeEmail = value => String(value || '').trim().toLowerCase();
export function normalizedProfile(value = {}) {
  return { username: normalizeName(value?.username), email: normalizeEmail(value?.email), photoUri: value?.photoUri || null };
}
export const hasProfileChanges = (before, after) =>
  JSON.stringify(normalizedProfile(before)) !== JSON.stringify(normalizedProfile(after));

// Ignore empty optional fields, key ordering and surrounding whitespace; keep
// meaningful values such as false, zero, paragraph breaks and letter case.
export function canonicalEditValue(value) {
  if (value === undefined || value === null || value === '') return null;
  if (typeof value === 'string') return value.normalize('NFC').trim() || null;
  if (Array.isArray(value)) return value.map(canonicalEditValue);
  if (typeof value !== 'object') return value;
  return Object.fromEntries(Object.keys(value).sort().flatMap(key => {
    const next = canonicalEditValue(value[key]);
    return next === null || (typeof next === 'object' && !Array.isArray(next) && !Object.keys(next).length) ? [] : [[key, next]];
  }));
}
function recordEditValues(record = {}) {
  const gps = record.gps;
  return canonicalEditValue({
    victimKey: record.victimKey || 'humano', city: record.city, community: record.community,
    date: registroIsoDate(record.isoDate || record.date) || String(record.date || '').trim(),
    details: record.details || {},
    gps: gps ? { lat: Number(gps.lat), lng: Number(gps.lng), accuracy: gps.accuracy ?? null, isHighAccuracy: gps.isHighAccuracy ?? null } : null,
  });
}
const photoIdentity = record => record?.photo?.dataUrl || record?.photo?.uri || record?.photo?.localUri || null;
export const hasRecordEditChanges = (before, after) =>
  photoIdentity(before) !== photoIdentity(after) ||
  JSON.stringify(recordEditValues(before)) !== JSON.stringify(recordEditValues(after));
