import AsyncStorage from '@react-native-async-storage/async-storage';
import notifee, { AuthorizationStatus } from '@notifee/react-native';
import { auth } from './firebase';
import { DeviceEventEmitter } from 'react-native';
import { garantirCanalNotificacoes } from './notificacaoLocal';
import { LOCAL_TEST_MODE, LOCAL_TEST_USER } from './debugTestSession';

const key = uid => `@sismorcego:${uid}:notifications`;
const sessionUid = () => LOCAL_TEST_MODE ? LOCAL_TEST_USER?.uid : auth?.currentUser?.uid;
export async function notificationsAllowed(uid = sessionUid()) {
  if (!uid) return false;
  return (await AsyncStorage.getItem(key(uid))) !== 'false';
}
export async function setNotificationsAllowed(enabled) {
  const uid = sessionUid();
  if (!uid) throw new Error('Faça login para configurar as notificações.');
  if (enabled) {
    const settings = await notifee.requestPermission();
    if (settings.authorizationStatus < AuthorizationStatus.AUTHORIZED) {
      throw new Error('Notificações bloqueadas pelo sistema. Autorize o SisMorcego nas configurações do aparelho.');
    }
    await garantirCanalNotificacoes();
  }
  await AsyncStorage.setItem(key(uid), String(enabled));
  if (!enabled) await notifee.cancelAllNotifications();
  DeviceEventEmitter.emit('notifications:changed');
}
