import AsyncStorage from '@react-native-async-storage/async-storage';
import notifee from '@notifee/react-native';
import NetInfo from '@react-native-community/netinfo';
import { addDoc, deleteDoc } from 'firebase/firestore';
import { auth } from '../src/services/firebase';
import { createDoubt, deleteDoubt, normalizeDoubt } from '../src/services/duvidas';
import { notificationsAllowed, setNotificationsAllowed } from '../src/services/notificationPreferences';

jest.mock('../src/services/firebase', () => ({ auth: { currentUser: { uid: 'real-owner' } }, db: {} }));
jest.mock('@react-native-community/netinfo', () => ({ fetch: jest.fn() }));
jest.mock('firebase/firestore', () => ({
  addDoc: jest.fn().mockResolvedValue({ id: 'q1' }), deleteDoc: jest.fn().mockResolvedValue(),
  collection: jest.fn((_, name) => name), doc: jest.fn((_, ...path) => path.join('/')), serverTimestamp: () => 'server-timestamp',
}));
beforeEach(async () => {
  jest.clearAllMocks(); await AsyncStorage.clear();
  auth.currentUser = { uid: 'real-owner' };
  NetInfo.fetch.mockResolvedValue({ isConnected: true });
  notifee.requestPermission.mockResolvedValue({ authorizationStatus: 1 });
});
test('creates a real owned question with no fabricated answer', async () => {
  await createDoubt('  Como consultar o registro?  ');
  expect(addDoc).toHaveBeenCalledWith('duvidas', {
    titulo: 'Como consultar o registro?', resposta: null, userId: 'real-owner', createdAt: 'server-timestamp',
  });
});
test('rejects anonymous submissions and deleting another person’s question', async () => {
  auth.currentUser = null;
  await expect(createDoubt('Como consultar o registro?')).rejects.toThrow('Faça login');
  auth.currentUser = { uid: 'real-owner' };
  await expect(deleteDoubt({ id: 'foreign', userId: 'other' })).rejects.toThrow('próprias dúvidas');
  expect(addDoc).not.toHaveBeenCalled(); expect(deleteDoc).not.toHaveBeenCalled();
});
test('distinguishes real team answers from the old canned acknowledgement', () => {
  const doc = response => ({ id: 'q1', data: () => ({ titulo: 'Pergunta', resposta: response }) });
  expect(normalizeDoubt(doc('Dúvida registrada, resposta em breve.')).answer).toBe('');
  expect(normalizeDoubt(doc('Use a tela de registros.')).answer).toBe('Use a tela de registros.');
});
test('notification preference persists per account and actually cancels local notifications', async () => {
  await setNotificationsAllowed(false);
  expect(await notificationsAllowed()).toBe(false);
  expect(notifee.cancelAllNotifications).toHaveBeenCalledTimes(1);
  auth.currentUser = { uid: 'different-owner' };
  expect(await notificationsAllowed()).toBe(true);
});
test('denied system permission cannot produce an enabled switch', async () => {
  await setNotificationsAllowed(false);
  notifee.requestPermission.mockResolvedValue({ authorizationStatus: 0 });
  await expect(setNotificationsAllowed(true)).rejects.toThrow('bloqueadas pelo sistema');
  expect(await notificationsAllowed()).toBe(false);
});
test('offline question submission reports the connection problem without a hanging server write', async () => {
  NetInfo.fetch.mockResolvedValue({ isConnected: false });
  await expect(createDoubt('Como consultar meu registro?')).rejects.toThrow('Sem conexão');
  expect(addDoc).not.toHaveBeenCalled();
});
jest.mock('../src/services/debugTestSession', () => ({ LOCAL_TEST_MODE: false }));
