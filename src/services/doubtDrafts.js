import EncryptedStorage from 'react-native-encrypted-storage';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { auth } from './firebase';
import { LOCAL_TEST_MODE, LOCAL_TEST_USER } from './debugTestSession';

const key = () => {
  if (LOCAL_TEST_MODE) return "sismorcego-doubt-drafts-" + LOCAL_TEST_USER.uid;
  if (!auth?.currentUser?.uid) throw new Error('Faça login para acessar seus rascunhos.');
  return `sismorcego-doubt-drafts-${auth.currentUser.uid}`;
};
export async function loadDoubtDrafts() {
  const storageKey = key();
  const current = JSON.parse(await EncryptedStorage.getItem(storageKey) || '[]');
  const legacy = await AsyncStorage.getItem('@sismorcego:html_doubts_v1');
  if (LOCAL_TEST_MODE || !legacy) return current;
  const old = JSON.parse(legacy);
  if (!Array.isArray(old)) throw new Error('Os rascunhos antigos estão inválidos. A cópia original foi preservada.');
  const merged = [...current];
  old.filter(item => item.question?.trim()).forEach(item => {
    const id = `draft-${item.id}`;
    if (!merged.some(draft => draft.id === id)) merged.push({ ...item, id, draft: true, answer: '', userId: auth.currentUser.uid });
  });
  await EncryptedStorage.setItem(storageKey, JSON.stringify(merged));
  await AsyncStorage.removeItem('@sismorcego:html_doubts_v1');
  return merged;
}
export async function removeDoubtDraft(id) {
  const drafts = await loadDoubtDrafts();
  const next = drafts.filter(item => item.id !== id);
  await EncryptedStorage.setItem(key(), JSON.stringify(next));
  return next;
}
