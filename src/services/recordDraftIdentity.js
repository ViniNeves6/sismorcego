import AsyncStorage from '@react-native-async-storage/async-storage';
import CryptoJS from 'crypto-js';

const locks = new Map();
const key = uid => `@sismorcego:${uid}:recordDraftIdentity`;
export const newRecordId = () => `r-${CryptoJS.lib.WordArray.random(16).toString()}`;
export function withRecordLock(identity, action) {
  const pending = (locks.get(identity) || Promise.resolve()).catch(() => {}).then(action);
  locks.set(identity, pending);
  return pending.finally(() => { if (locks.get(identity) === pending) locks.delete(identity); });
}
export function getRecordDraftIdentity(uid) {
  if (!uid) return Promise.reject(new Error('Faça login para registrar uma ocorrência.'));
  return withRecordLock(key(uid), async () => {
    const saved = await AsyncStorage.getItem(key(uid));
    if (saved) return JSON.parse(saved);
    const identity = { id: newRecordId(), createdAt: new Date().toISOString() };
    await AsyncStorage.setItem(key(uid), JSON.stringify(identity));
    return identity;
  });
}
export function completeRecordDraft(uid, id) {
  return withRecordLock(key(uid), async () => {
    const saved = await AsyncStorage.getItem(key(uid));
    if (saved && JSON.parse(saved).id === id) await AsyncStorage.removeItem(key(uid));
  });
}
