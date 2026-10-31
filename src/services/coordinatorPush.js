import { getInitialNotification, getMessaging, getToken, onMessage, onNotificationOpenedApp, onTokenRefresh, setBackgroundMessageHandler } from '@react-native-firebase/messaging';
import { doc, getDoc } from 'firebase/firestore';
import notifee, { AndroidVisibility, AuthorizationStatus } from '@notifee/react-native';
import { AppState, DeviceEventEmitter } from 'react-native';
import { onAuthStateChanged } from 'firebase/auth';
import { auth, db } from './firebase';
import { attachPushDevice, detachPushDevice, pushBackendEnabled } from './pushDevices';
import { deterministicAlertId, PRIVATE_PUSH_BODY, PRIVATE_PUSH_TITLE, occurrencePushTarget } from './alertContract';
import { CANAL_NOTIFICACOES_ID, garantirCanalNotificacoes } from './notificacaoLocal';
import { notificationsAllowed } from './notificationPreferences';
import { canAccessCoordinatorArea } from './roleAccess';

export async function displayOccurrencePush(message, uid) {
  const target = occurrencePushTarget(message?.data);
  if (!target || target.recipientUid !== uid || !await notificationsAllowed(uid)) return;
  await garantirCanalNotificacoes();
  await notifee.displayNotification({ id: target.alertId || deterministicAlertId(uid, target.uidAcs, target.registroId),
    title: PRIVATE_PUSH_TITLE, body: PRIVATE_PUSH_BODY, data: { type: 'occurrence', ...target },
    android: { channelId: CANAL_NOTIFICACOES_ID, visibility: AndroidVisibility.PRIVATE, pressAction: { id: 'default' } } });
}
export function registerPushBackgroundHandler() {
  if (!pushBackendEnabled()) return;
  setBackgroundMessageHandler(getMessaging(), async message => {
    const user = auth?.currentUser || await new Promise(resolve => {
      let stop;
      const timer = setTimeout(() => { stop?.(); resolve(null); }, 5000);
      stop = onAuthStateChanged(auth, current => { clearTimeout(timer); stop?.(); resolve(current); });
    });
    const uid = user?.uid;
    const target = occurrencePushTarget(message.data);
    if (!uid || target?.recipientUid !== uid || !db) return;
    const profile = await getDoc(doc(db, 'usuarios', uid));
    if (canAccessCoordinatorArea(profile.data()?.role)) await displayOccurrencePush(message, uid);
  });
}
export function listenCoordinatorPush(uid, isActive, onOpen, onError) {
  if (!pushBackendEnabled()) return () => {};
  const messaging = getMessaging();
  const canReceive = async () => isActive() && await notificationsAllowed(uid)
    && (await notifee.getNotificationSettings()).authorizationStatus >= AuthorizationStatus.AUTHORIZED;
  const register = async token => { if (await canReceive() && isActive()) await attachPushDevice(uid, token); };
  const refreshBinding = async () => {
    if (await canReceive() && isActive()) await attachPushDevice(uid, () => getToken(messaging));
    else if (isActive()) await detachPushDevice(uid);
  };
  const open = message => {
    const target = occurrencePushTarget(message?.data);
    if (isActive() && target?.recipientUid === uid) onOpen(target);
  };
  refreshBinding().catch(onError);
  getInitialNotification(messaging).then(open).catch(onError);
  const listeners = [onTokenRefresh(messaging, token => register(token).catch(onError)),
    onMessage(messaging, message => { if (isActive()) displayOccurrencePush(message, uid).catch(onError); }),
    onNotificationOpenedApp(messaging, open)];
  const preferences = DeviceEventEmitter.addListener('notifications:changed', () => refreshBinding().catch(onError));
  const appState = AppState.addEventListener('change', state => { if (state === 'active') refreshBinding().catch(onError); });
  return () => {
    listeners.forEach(stop => stop()); preferences.remove(); appState.remove();
    detachPushDevice(uid).catch(() => {});
  };
}
