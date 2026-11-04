import AsyncStorage from '@react-native-async-storage/async-storage';
import notifee from '@notifee/react-native';
import { getMessaging, getToken, onTokenRefresh, onMessage, onNotificationOpenedApp, setBackgroundMessageHandler, deleteToken } from '@react-native-firebase/messaging';
import { setDoc, getDoc, updateDoc } from 'firebase/firestore';
import { auth } from '../src/services/firebase';
import * as integration from '../src/services/firebaseIntegration';
import { listenCoordinatorPush, registerPushBackgroundHandler } from '../src/services/coordinatorPush';
import { detachPushDevice } from '../src/services/pushDevices';
import { buildAlertContract, deterministicAlertId, PRIVATE_PUSH_BODY, PRIVATE_PUSH_TITLE } from '../src/services/alertContract';
import { consumeNotificationPress, rememberNotificationPress } from '../src/services/notificationNavigation';
import { marcarNotificacaoComoLida } from '../src/services/notificacoes';

jest.mock('../src/services/debugTestSession', () => ({ LOCAL_TEST_MODE: false }));
jest.mock('../src/services/firebaseIntegration', () => ({ __esModule: true, FIREBASE_PUSH_BACKEND_READY: false }));
jest.mock('../src/services/firebase', () => ({ auth: { currentUser: { uid: 'coord' } }, db: {} }));
jest.mock('firebase/auth', () => ({ onAuthStateChanged: jest.fn() }));
jest.mock('firebase/firestore', () => ({
  doc: jest.fn((_, ...path) => ({ path: path.join('/') })), serverTimestamp: () => 'server-time',
  setDoc: jest.fn().mockResolvedValue(), updateDoc: jest.fn().mockResolvedValue(),
  getDoc: jest.fn().mockResolvedValue({ data: () => ({ role: 'coordenador' }) }),
}));
const target = { type: 'occurrence', recipientUid: 'coord', uidAcs: 'acs', registroId: 'r1', alertId: 'alert' };
const settle = () => new Promise(resolve => setImmediate(resolve));
beforeEach(async () => {
  jest.clearAllMocks(); await AsyncStorage.clear(); integration.FIREBASE_PUSH_BACKEND_READY = false;
  auth.currentUser = { uid: 'coord' };
  notifee.getNotificationSettings.mockResolvedValue({ authorizationStatus: 1 });
});

test('backend gate prevents all FCM registration and remote token writes until configuration is authorized', async () => {
  registerPushBackgroundHandler();
  listenCoordinatorPush('coord', () => true, jest.fn(), jest.fn())();
  await detachPushDevice('coord');
  expect(getMessaging).not.toHaveBeenCalled(); expect(getToken).not.toHaveBeenCalled();
  expect(setDoc).not.toHaveBeenCalled(); expect(setBackgroundMessageHandler).not.toHaveBeenCalled();
});

test('future server contract has deterministic per-coordinator alert identities and independent read history', () => {
  const record = { uid: 'acs', recordId: 'r1', tipoVitima: 'humano' };
  const inboxes = new Map();
  const deliver = coordinator => {
    const alert = buildAlertContract(coordinator, record, 'received');
    // Modelo do contrato create-if-absent; não é uma implementação do servidor.
    if (!inboxes.has(alert.id)) inboxes.set(alert.id, alert);
    return inboxes.get(alert.id);
  };
  const a = deliver('coord-a'); const b = deliver('coord-b'); a.lida = true;
  deliver('coord-a'); deliver('coord-b');
  expect(inboxes.size).toBe(2); expect(a.lida).toBe(true); expect(b.lida).toBe(false);
  expect(deterministicAlertId('coord-a', 'acs', 'r1')).not.toBe(deterministicAlertId('coord-a', 'another-acs', 'r1'));
});

test('mocked FCM registers an installation, refreshes its token and invalidates it on logout', async () => {
  integration.FIREBASE_PUSH_BACKEND_READY = true;
  const stop = listenCoordinatorPush('coord', () => true, jest.fn(), jest.fn());
  await settle();
  expect(setDoc.mock.calls[0][0].path).toMatch(/^usuarios\/coord\/dispositivos\//);
  expect(setDoc.mock.calls[0][1]).toMatchObject({ token: 'mock-fcm-token', enabled: true });
  await onTokenRefresh.mock.calls[0][1]('renewed-token'); await settle();
  expect(setDoc.mock.calls.at(-1)[1].token).toBe('renewed-token');
  await detachPushDevice('coord');
  expect(setDoc.mock.calls.at(-1)[1]).toMatchObject({ token: null, enabled: false });
  expect(deleteToken).toHaveBeenCalled(); stop(); await settle();
});

test('foreground and headless pushes expose only generic text and reject another recipient or revoked role', async () => {
  integration.FIREBASE_PUSH_BACKEND_READY = true;
  const open = jest.fn(); const stop = listenCoordinatorPush('coord', () => true, open, jest.fn());
  await settle();
  const message = { messageId: 'm1', data: target, notification: { title: 'Sensitive name', body: 'Clinical details' } };
  await onMessage.mock.calls[0][1](message); await settle();
  expect(notifee.displayNotification.mock.calls[0][0]).toMatchObject({ title: PRIVATE_PUSH_TITLE, body: PRIVATE_PUSH_BODY });
  onNotificationOpenedApp.mock.calls[0][1](message);
  expect(open).toHaveBeenCalledWith(expect.objectContaining({ uidAcs: 'acs', registroId: 'r1' }));
  onNotificationOpenedApp.mock.calls[0][1]({ data: { ...target, recipientUid: 'other' } });
  expect(open).toHaveBeenCalledTimes(1);
  registerPushBackgroundHandler();
  getDoc.mockResolvedValueOnce({ data: () => ({ role: 'acs' }) });
  await setBackgroundMessageHandler.mock.calls[0][1](message);
  expect(notifee.displayNotification).toHaveBeenCalledTimes(1);
  stop(); await settle();
});

test('notification presses survive a cold start by recipient and cannot be consumed by a different account', async () => {
  await rememberNotificationPress(target);
  auth.currentUser = { uid: 'another' };
  expect(await consumeNotificationPress()).toBe(false);
  auth.currentUser = { uid: 'coord' };
  expect(await consumeNotificationPress()).toMatchObject({ uidAcs: 'acs', registroId: 'r1' });
  expect(await consumeNotificationPress()).toBe(false);
});

test('marking read updates only the authenticated coordinator document and leaves the other recipient unread', async () => {
  const states = new Map([['usuarios/coord-a/notificacoes/case', false], ['usuarios/coord-b/notificacoes/case', false]]);
  updateDoc.mockImplementation(async (ref, patch) => states.set(ref.path, patch.lida));
  auth.currentUser = { uid: 'coord-a' };
  await marcarNotificacaoComoLida('coord-a', 'case');
  expect(states.get('usuarios/coord-a/notificacoes/case')).toBe(true);
  expect(states.get('usuarios/coord-b/notificacoes/case')).toBe(false);
  await expect(marcarNotificacaoComoLida('coord-b', 'case')).rejects.toThrow();
  expect(updateDoc).toHaveBeenCalledTimes(1);
});
