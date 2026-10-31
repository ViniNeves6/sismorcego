import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { AppState } from 'react-native';
import notifee, { EventType } from '@notifee/react-native';
import { collection, onSnapshot } from 'firebase/firestore';
import BackgroundFetch from 'react-native-background-fetch';
import useAuth from '../src/hooks/useAuth';
import Navigation from '../src/navigation';
import Notificacoes from '../src/pages/Main/Notificacoes';
import useCoordinatorNavigation from '../src/hooks/useCoordinatorNavigation';
import useCoordenadorNotifications from '../src/hooks/useCoordenadorNotifications';
import useNotifications from '../src/hooks/useNotifications';
import { consumeNotificationPress } from '../src/services/notificationNavigation';
import { notificationsAllowed, setNotificationsAllowed } from '../src/services/notificationPreferences';
import { executarChecagemNotificacoes } from '../src/services/checagemNotificacoes';

jest.mock('../src/hooks/useAuth', () => jest.fn());
jest.mock('firebase/auth', () => ({ onAuthStateChanged: jest.fn() }));
jest.mock('../src/services/debugTestSession', () => ({ LOCAL_TEST_MODE: false }));
jest.mock('@react-navigation/native', () => ({ NavigationContainer: ({ children }) => children }));
jest.mock('@react-navigation/native-stack', () => ({
  createNativeStackNavigator: () => ({ Navigator: ({ children }) => children, Screen: 'Route' }),
}));
jest.mock('../src/navigation/SismorcegoShell', () => 'Shell');
jest.mock('../src/navigation/AuthStack', () => 'AuthStack');
jest.mock('../src/navigation/StartupSplash', () => ({ ready, onExited }) => {
  require('react').useEffect(() => { if (ready) onExited(); }, [ready, onExited]);
  return null;
});
jest.mock('../src/pages/Main/Painel', () => 'Painel');
jest.mock('../src/ui', () => ({
  Screen: 'Screen', ScreenHeader: 'ScreenHeader', ListGroup: 'ListGroup', ListRow: 'ListRow',
  Badge: 'Badge', EmptyState: 'EmptyState', Text: 'Text', useToast: () => ({ show: jest.fn() }),
}));
jest.mock('../src/theme/ThemeProvider', () => ({ useTheme: () => ({ spacing: { lg: 16, md: 12 } }), makeNavigationTheme: () => ({}) }));
jest.mock('../src/hooks/useSpeakOnMount', () => jest.fn());
jest.mock('../src/services/firebase', () => ({ db: {} }));
jest.mock('firebase/firestore', () => ({
  collection: jest.fn((_, ...path) => path.join('/')), doc: jest.fn(), getDoc: jest.fn(),
  onSnapshot: jest.fn(() => jest.fn()), query: jest.fn(ref => ref), orderBy: jest.fn(), where: jest.fn(),
}));
jest.mock('../src/services/notificacoes', () => ({ marcarNotificacaoComoLida: jest.fn() }));
jest.mock('../src/services/registroPdf', () => ({ formatarDataCurta: () => '28/10/2026', generateRegistroPdf: jest.fn(), savePdf: jest.fn() }));
jest.mock('../src/pages/Main/buscar/PdfOptionsSheet', () => 'PdfOptionsSheet');
jest.mock('../src/pages/Main/buscar/PdfViewerModal', () => 'PdfViewerModal');
jest.mock('../src/services/notificationNavigation', () => ({ consumeNotificationPress: jest.fn().mockResolvedValue(false) }));
jest.mock('../src/services/notificationPreferences', () => ({ notificationsAllowed: jest.fn().mockResolvedValue(false), setNotificationsAllowed: jest.fn().mockResolvedValue() }));
jest.mock('../src/services/notificacaoLocal', () => ({ garantirCanalNotificacoes: jest.fn() }));
jest.mock('../src/services/checagemNotificacoes', () => ({ executarChecagemNotificacoes: jest.fn() }));
jest.mock('react-native-background-fetch', () => ({ configure: jest.fn().mockResolvedValue(), finish: jest.fn(), stop: jest.fn().mockResolvedValue() }));

let session, tree, openCoordinatorScreen, count;
const navigation = { navigate: jest.fn() };
const showToast = jest.fn();
const onOpenRecord = jest.fn();
function NavigationProbe({ enabled = true }) {
  openCoordinatorScreen = useCoordinatorNavigation(navigation, showToast, onOpenRecord, { enabled });
  return null;
}
function CounterProbe({ enabled = true }) {
  count = useCoordenadorNotifications({ enabled }).naoLidas;
  return null;
}
const render = async element => {
  await act(async () => { tree = TestRenderer.create(element); });
};
const update = async element => {
  await act(async () => tree.update(element));
};
beforeEach(() => {
  jest.clearAllMocks();
  session = { user: { uid: 'acs-user' }, role: 'acs', loading: false };
  useAuth.mockImplementation(() => session);
  notifee.getInitialNotification.mockResolvedValue(null);
  notifee.onForegroundEvent.mockReturnValue(jest.fn());
  consumeNotificationPress.mockResolvedValue(false);
  notificationsAllowed.mockResolvedValue(false);
  jest.spyOn(AppState, 'addEventListener').mockReturnValue({ remove: jest.fn() });
});
afterEach(async () => {
  if (tree) await act(async () => tree.unmount());
  tree = null;
  jest.restoreAllMocks();
});

test.each(['acs', null, undefined, 'desconhecido'])('role %s has no administrative routes or direct screen access', async role => {
  session.role = role;
  await render(<Navigation />);
  expect(tree.root.findAllByType('Route').map(node => node.props.name)).toEqual(['Inicio']);
  await update(<Notificacoes />);
  expect(tree.toJSON()).toBeNull();
  expect(collection).not.toHaveBeenCalled();
  expect(onSnapshot).not.toHaveBeenCalled();
});

test('legacy administrative screens are absent from active navigation; direct legacy feed remains role guarded', async () => {
  session = { ...session, role: 'coordenador', user: { uid: 'coordinator' } };
  await render(<Navigation />);
  expect(tree.root.findAllByType('Route').map(node => node.props.name)).toEqual(['Inicio']);
  session.role = 'acs';
  await update(<Navigation />);
  expect(tree.root.findAllByType('Route').map(node => node.props.name)).toEqual(['Inicio']);
  session.role = 'coordenador';
  await update(<Notificacoes />);
  expect(collection).toHaveBeenCalledWith(expect.anything(), 'usuarios', 'coordinator', 'notificacoes');
  const unsubscribe = onSnapshot.mock.results[0].value;
  await act(async () => onSnapshot.mock.calls[0][1]({ docs: [] }));
  expect(tree.root.findByType('EmptyState').props.title).toBe('Nenhuma notificação');
  session.role = 'acs';
  await update(<Notificacoes />);
  expect(tree.toJSON()).toBeNull();
  expect(unsubscribe).toHaveBeenCalledTimes(1);
});

test('ACS cannot navigate through callbacks or notification taps', async () => {
  await render(<NavigationProbe />);
  openCoordinatorScreen('Notificacoes');
  openCoordinatorScreen('Painel');
  expect(navigation.navigate).not.toHaveBeenCalled();
  expect(notifee.getInitialNotification).not.toHaveBeenCalled();
  expect(notifee.onForegroundEvent).not.toHaveBeenCalled();
  expect(consumeNotificationPress).not.toHaveBeenCalled();
});

test('coordinator menu and foreground taps work; retained callbacks stop after switching to ACS', async () => {
  session.role = 'coordenador';
  await render(<NavigationProbe />);
  const retainedCallback = openCoordinatorScreen;
  const onPress = notifee.onForegroundEvent.mock.calls[0][0];
  const unsubscribe = notifee.onForegroundEvent.mock.results[0].value;
  retainedCallback('Notificacoes');
  retainedCallback('Painel');
  retainedCallback('UnregisteredScreen');
  onPress({ type: EventType.PRESS });
  expect(navigation.navigate.mock.calls).toEqual([['Notificacoes'], ['Painel'], ['Notificacoes']]);
  session.role = 'acs';
  await update(<NavigationProbe />);
  retainedCallback('Notificacoes');
  onPress({ type: EventType.PRESS });
  expect(navigation.navigate).toHaveBeenCalledTimes(3);
  expect(unsubscribe).toHaveBeenCalledTimes(1);
});

test.each(['initial', 'pending'])('a pending %s tap cannot open the central after loss of role', async stage => {
  session.role = 'coordenador';
  let resolve;
  if (stage === 'initial') notifee.getInitialNotification.mockReturnValueOnce(new Promise(done => { resolve = done; }));
  else consumeNotificationPress.mockReturnValueOnce(new Promise(done => { resolve = done; }));
  await render(<NavigationProbe />);
  session.role = 'acs';
  await update(<NavigationProbe />);
  await act(async () => resolve(stage === 'initial' ? { notification: { id: 'old' } } : true));
  expect(navigation.navigate).not.toHaveBeenCalled();
});

test('initial and background taps open the exclusive central for a coordinator', async () => {
  session.role = 'coordenador';
  consumeNotificationPress.mockResolvedValueOnce(true);
  await render(<NavigationProbe />);
  expect(navigation.navigate).toHaveBeenCalledWith('Notificacoes');
  notifee.getInitialNotification.mockResolvedValueOnce({ notification: { id: 'admin' } });
  const resume = AppState.addEventListener.mock.calls.find(call => call[0] === 'change')[1];
  await act(async () => resume('active'));
  expect(navigation.navigate).toHaveBeenCalledTimes(2);
});

test('administrative unread counts and background checks never start for ACS and stop on role loss', async () => {
  await render(<CounterProbe />);
  expect(count).toBe(0);
  expect(onSnapshot).not.toHaveBeenCalled();
  expect(BackgroundFetch.configure).not.toHaveBeenCalled();
  session.role = 'coordenador';
  await update(<CounterProbe />);
  const unsubscribe = onSnapshot.mock.results[0].value;
  await act(async () => onSnapshot.mock.calls[0][1]({ size: 4 }));
  expect(count).toBe(4);
  expect(BackgroundFetch.configure).not.toHaveBeenCalled();
  expect(executarChecagemNotificacoes).not.toHaveBeenCalled();
  session.role = 'acs';
  await update(<CounterProbe />);
  expect(count).toBe(0);
  expect(unsubscribe).toHaveBeenCalledTimes(1);
  expect(BackgroundFetch.stop).not.toHaveBeenCalled();
  await act(async () => onSnapshot.mock.calls[0][1]({ size: 9 }));
  expect(count).toBe(0);
});

test('coordinators never generate alerts through client background polling', async () => {
  session.role = 'coordenador';
  await render(<CounterProbe />);
  session.role = 'acs';
  await update(<CounterProbe />);
  expect(executarChecagemNotificacoes).not.toHaveBeenCalled();
  expect(BackgroundFetch.configure).not.toHaveBeenCalled();
});

test('a notification opens the identified occurrence only for its authenticated coordinator recipient', async () => {
  session = { ...session, role: 'coordenador', user: { uid: 'coord' } };
  await render(<NavigationProbe />);
  const press = notifee.onForegroundEvent.mock.calls[0][0];
  const data = { type: 'occurrence', recipientUid: 'coord', uidAcs: 'acs', registroId: 'r1', alertId: 'alert' };
  await act(async () => press({ type: EventType.PRESS, detail: { notification: { data } } }));
  expect(onOpenRecord).toHaveBeenCalledWith(expect.objectContaining({ uidAcs: 'acs', registroId: 'r1' }));
  await act(async () => press({ type: EventType.PRESS, detail: { notification: { data: { ...data, recipientUid: 'other' } } } }));
  expect(onOpenRecord).toHaveBeenCalledTimes(1);
  session.role = 'acs'; await update(<NavigationProbe />);
  await act(async () => press({ type: EventType.PRESS, detail: { notification: { data } } }));
  expect(onOpenRecord).toHaveBeenCalledTimes(1);
});

test('pausing initial data keeps dock navigation but defers pending notification consumption', async () => {
  session.role = 'coordenador';
  consumeNotificationPress.mockResolvedValueOnce(true);
  await render(<NavigationProbe enabled={false} />);
  expect(notifee.getInitialNotification).not.toHaveBeenCalled();
  expect(consumeNotificationPress).not.toHaveBeenCalled();
  expect(notifee.onForegroundEvent).not.toHaveBeenCalled();
  openCoordinatorScreen('Painel');
  expect(navigation.navigate).toHaveBeenCalledWith('Painel');
  await update(<NavigationProbe enabled />);
  expect(consumeNotificationPress).toHaveBeenCalledTimes(1);
  expect(navigation.navigate).toHaveBeenLastCalledWith('Notificacoes');
});

test('unread subscriptions wait for initial onboarding to release data', async () => {
  session.role = 'coordenador';
  await render(<CounterProbe enabled={false} />);
  expect(onSnapshot).not.toHaveBeenCalled();
  expect(notifee.requestPermission).not.toHaveBeenCalled();
  await update(<CounterProbe enabled />);
  expect(onSnapshot).toHaveBeenCalledTimes(1);
});

test('notification preferences and settings are not read or changed during initial onboarding', async () => {
  let preferences;
  function PreferencesProbe({ enabled }) { preferences = useNotifications({ enabled }); return null; }
  await render(<PreferencesProbe enabled={false} />);
  await act(async () => preferences.toggleNotifications(true));
  expect(preferences.notificationsEnabled).toBe(false);
  expect(notifee.getNotificationSettings).not.toHaveBeenCalled();
  expect(notificationsAllowed).not.toHaveBeenCalled();
  expect(setNotificationsAllowed).not.toHaveBeenCalled();
  await update(<PreferencesProbe enabled />);
  expect(notifee.getNotificationSettings).toHaveBeenCalledTimes(1);
  expect(notificationsAllowed).toHaveBeenCalledTimes(1);
});
