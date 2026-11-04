import AsyncStorage from '@react-native-async-storage/async-storage';
import { DeviceEventEmitter } from 'react-native';
import { auth } from './firebase';
import { addToQueue, loadQueue } from './offlineQueue';
import { carregarHistorico, carregarLocais } from './historico';
import { syncPendingRegistros } from './syncRegistros';
import { toRecordView, toStoredRecord } from './registroAdapter';
import { editStoredRecord, removeOrCancelStoredRecord, acceptRemoteRecordVersion } from './recordMutations';
import { getRecordDraftIdentity } from './recordDraftIdentity';
import { saveLocalProfilePhoto } from './accountProfile';
import { LOCAL_TEST_MODE, LOCAL_TEST_USER } from './debugTestSession';

const requireUser = () => {
  if (LOCAL_TEST_MODE) return LOCAL_TEST_USER;
  if (!auth?.currentUser) throw new Error('Faça login para continuar.');
  return auth.currentUser;
};
const keyFor = name => `@sismorcego:${requireUser().uid}:${name}`;

// Somente as duas amostras exatas do HTML são descartadas. Outros registros
// dessa versão são migrados uma vez para a fila criptografada, sem apagar PII.
export function isRedesignSample(record) {
  const empty = !record.gps && !record.photo && !Object.values(record.details || {}).some(Boolean);
  return empty && record.reporter === 'Agente de Saúde (Você)' && (
    (record.id === 1 && record.victimKey === 'humano' && record.city === 'Curuçá' && record.date === '26/10/2026' && !record.community) ||
    (record.id === 2 && record.victimKey === 'producao' && record.city === 'Marapanim' && record.community === 'Vila Silva' && record.date === '19/10/2026')
  );
}
let migration;
async function migrateHtmlRecords() {
  const uid = requireUser().uid;
  if (migration?.uid === uid) return migration.promise;
  const promise = (async () => {
    const raw = await AsyncStorage.getItem('@sismorcego:html_records_v1');
    if (!raw) return;
    const records = JSON.parse(raw);
    if (!Array.isArray(records)) throw new Error('O histórico da versão anterior está inválido. A cópia original foi preservada.');
    for (const record of records.filter(r => !isRedesignSample(r))) {
      // ID determinístico: uma interrupção na migração não duplica registros.
      const stored = toStoredRecord({ ...record, id: `html-${record.id}` }, uid);
      const existing = await carregarLocais();
      if (!existing.some(r => r.recordId === stored.recordId)) await addToQueue(stored, { returnQueue: false });
    }
    await AsyncStorage.removeItem('@sismorcego:html_records_v1');
  })();
  migration = { uid, promise };
  try { await promise; } catch (error) { migration = null; throw error; }
}

export async function loadRecordsFromStorage(role, options) {
  if (LOCAL_TEST_MODE) return (await loadQueue({ uid: LOCAL_TEST_USER.uid })).map(toRecordView);
  await migrateHtmlRecords();
  return (await carregarHistorico(role, options)).map(toRecordView);
}

export async function addNewRecordToStorage(record) {
  const user = requireUser();
  const identity = await getRecordDraftIdentity(user.uid);
  const id = record.id || identity.id;
  const stored = toStoredRecord({ ...record, id, _raw: { createdAt: identity.createdAt } }, user.uid);
  await addToQueue(stored, { returnQueue: false });
  DeviceEventEmitter.emit('registros:changed');
  return toRecordView(stored);
}
export const updateRecordInStorage = editStoredRecord;
export const acceptRemoteRecordInStorage = acceptRemoteRecordVersion;
export const deleteRecordFromStorage = removeOrCancelStoredRecord;
export async function loadPendingCount() {
  if (LOCAL_TEST_MODE) return (await loadQueue({ uid: LOCAL_TEST_USER.uid })).filter(item => item.status !== 'synced').length;
  return (await carregarLocais()).filter(item => item.status !== 'synced').length;
}
export const triggerSyncRecords = () => LOCAL_TEST_MODE
  ? Promise.resolve({ reason: 'no-user', synced: 0, failed: 0 })
  : syncPendingRegistros();

export async function loadReporterName() {
  const key = keyFor('reporter');
  const saved = await AsyncStorage.getItem(key);
  if (saved) return saved;
  if (LOCAL_TEST_MODE) return LOCAL_TEST_USER.displayName;
  const legacy = await AsyncStorage.getItem('@sismorcego:html_reporter_v1');
  if (legacy && !['Agente de Saúde', 'Agente de Saúde (Você)'].includes(legacy)) {
    await AsyncStorage.setItem(key, legacy);
    await AsyncStorage.removeItem('@sismorcego:html_reporter_v1');
    return legacy;
  }
  return requireUser().displayName || '';
}
export async function saveReporterNameToStorage(name) {
  if (!name.trim()) throw new Error('Informe o responsável pelo registro.');
  await AsyncStorage.setItem(keyFor('reporter'), name.trim());
}
export async function loadAccountProfile() {
  const user = requireUser();
  const photoKey = keyFor('profilePhoto');
  let photoUri = await AsyncStorage.getItem(photoKey);
  if (!photoUri && !LOCAL_TEST_MODE) {
    const oldAccount = await AsyncStorage.getItem('@sismorcego:html_account_v1');
    const legacyPhoto = await AsyncStorage.getItem('profilePhoto');
    let accountPhoto = null;
    try { accountPhoto = oldAccount ? JSON.parse(oldAccount)?.photoUri : null; } catch { /* Não altera uma cópia inválida. */ }
    photoUri = legacyPhoto || accountPhoto;
    if (photoUri) {
      await AsyncStorage.setItem(photoKey, photoUri);
      await AsyncStorage.removeItem('profilePhoto');
      if (oldAccount) await AsyncStorage.removeItem('@sismorcego:html_account_v1');
    }
  }
  return { username: user.displayName || '', email: user.email || '', photoUri: photoUri || user.photoURL || null };
}
// Nome, email e senha são atualizados pelo useAuth, nunca por este cache.
export async function saveAccountProfile(profile) {
  await saveLocalProfilePhoto(requireUser().uid, profile.photoUri);
}
