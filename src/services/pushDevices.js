import AsyncStorage from '@react-native-async-storage/async-storage';
import { doc, serverTimestamp, setDoc } from 'firebase/firestore';
import { deleteToken, getMessaging } from '@react-native-firebase/messaging';
import { auth, db } from './firebase';
import { FIREBASE_PUSH_BACKEND_READY } from './firebaseIntegration';
import { LOCAL_TEST_MODE } from './debugTestSession';
import { newRecordId, withRecordLock } from './recordDraftIdentity';

export const pushBackendEnabled = () => FIREBASE_PUSH_BACKEND_READY && !LOCAL_TEST_MODE;
const installKey = '@sismorcego:pushInstallation';
const detachKey = uid => `@sismorcego:${uid}:pushDetachPending`;
export function pushInstallationId() {
  return withRecordLock(installKey, async () => {
    let id = await AsyncStorage.getItem(installKey);
    if (!id) { id = newRecordId(); await AsyncStorage.setItem(installKey, id); }
    return id;
  });
}
export async function attachPushDevice(uid, token) {
  if (!pushBackendEnabled()) return { pendingBackend: true };
  return withRecordLock('push-device-binding', async () => {
    if (!uid || auth?.currentUser?.uid !== uid || !token) throw new Error('Sessão inválida para registrar notificações.');
    const deviceId = await pushInstallationId();
    const value = typeof token === 'function' ? await token() : token;
    if (auth.currentUser?.uid !== uid) return;
    await setDoc(doc(db, 'usuarios', uid, 'dispositivos', deviceId), { token: value, enabled: true, platform: 'android', updatedAt: serverTimestamp() }, { merge: true });
    await AsyncStorage.removeItem(detachKey(uid));
  });
}
export async function detachPushDevice(uid) {
  if (!pushBackendEnabled() || !uid) return { pendingBackend: true };
  return withRecordLock('push-device-binding', async () => {
    try {
      const deviceId = await pushInstallationId();
      await AsyncStorage.setItem(detachKey(uid), deviceId);
      if (auth?.currentUser?.uid === uid) {
        await setDoc(doc(db, 'usuarios', uid, 'dispositivos', deviceId), { enabled: false, token: null, updatedAt: serverTimestamp() }, { merge: true });
        await AsyncStorage.removeItem(detachKey(uid));
      }
    } catch { /* A revogação fica pendente; o servidor também deve remover tokens inválidos. */ }
    await deleteToken(getMessaging()).catch(() => {});
  });
}
