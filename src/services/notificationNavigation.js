import AsyncStorage from '@react-native-async-storage/async-storage';
import { auth } from './firebase';
import { occurrencePushTarget } from './alertContract';

const key = uid => `@sismorcego:${uid}:openNotifications`;
export async function rememberNotificationPress(data) {
  const target = occurrencePushTarget(data);
  const uid = target?.recipientUid || auth?.currentUser?.uid;
  if (uid) await AsyncStorage.setItem(key(uid), target ? JSON.stringify(target) : 'true');
}
export async function consumeNotificationPress() {
  const uid = auth?.currentUser?.uid;
  if (!uid) return false;
  const pending = await AsyncStorage.getItem(key(uid));
  if (pending) await AsyncStorage.removeItem(key(uid));
  if (pending === 'true') return true;
  try {
    const target = pending ? JSON.parse(pending) : null;
    return target?.recipientUid === uid ? target : false;
  } catch { return false; }
}
