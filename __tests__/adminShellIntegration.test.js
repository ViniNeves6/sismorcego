import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { AppState, BackHandler, DeviceEventEmitter, Keyboard, StyleSheet, Text } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import notifee from '@notifee/react-native';
import { getDoc, onSnapshot } from 'firebase/firestore';
import useAuth from '../src/hooks/useAuth';
import useCoordenadorNotifications from '../src/hooks/useCoordenadorNotifications';
import { updateRecordInStorage, deleteRecordFromStorage, loadRecordsFromStorage, loadPendingCount,
  loadAccountProfile, loadReporterName, triggerSyncRecords, addNewRecordToStorage } from '../src/services/sismorcegoData';
import { loadDoubtDrafts } from '../src/services/doubtDrafts';
import { subscribeDoubts } from '../src/services/duvidas';
import { getRecordDraftIdentity } from '../src/services/recordDraftIdentity';
import { consumeNotificationPress } from '../src/services/notificationNavigation';
import { generateRegistroPdf } from '../src/services/registroPdf';
import SismorcegoShell from '../src/navigation/SismorcegoShell';
import { toRecordView } from '../src/services/registroAdapter';

jest.mock('../src/hooks/useAuth', () => jest.fn());
jest.mock('firebase/auth', () => ({ onAuthStateChanged: jest.fn() }));
jest.mock('../src/hooks/useAccessibility', () => () => ({ settings: { reduceMotion: mockReduceMotion }, speak: jest.fn(), updateSettings: jest.fn() }));
jest.mock('../src/ui/AccessibleNative', () => require('react-native'));
jest.mock('react-native-safe-area-context', () => ({ SafeAreaView: 'SafeAreaView', useSafeAreaInsets: () => ({ top: 24, bottom: 24, left: 0, right: 0 }) }));
jest.mock('react-native-svg', () => ({ __esModule: true, default: 'Svg', Line: 'Line' }));
jest.mock('react-native-linear-gradient', () => 'LinearGradient');
jest.mock('../src/ui/SismorcegoIcons', () => ({ DockAlertasIcon: 'DockAlertasIcon', DockMaisIcon: 'DockMaisIcon', DockPainelIcon: 'DockPainelIcon', DockRegistrosIcon: 'DockRegistrosIcon' }));
jest.mock('../src/ui/HowToModal', () => 'HowToModal');
jest.mock('../src/ui/BottomSheetModal', () => 'BottomSheetModal');
jest.mock('../src/ui/AppCalendarModal', () => 'AppCalendarModal');
jest.mock('../src/ui/RecordDetailsModal', () => 'RecordDetailsModal');
jest.mock('../src/ui/ThemedDialogs', () => ({ ReporterModal: 'ReporterModal', ThemedInfoModal: 'ThemedInfoModal', SignOutConfirmationModal: 'SignOutConfirmationModal' }));
jest.mock('../src/pages/Main/RegistrosScreen', () => 'RegistrosScreen');
jest.mock('../src/pages/Main/NovaNotificacaoScreen', () => 'NovaNotificacaoScreen');
jest.mock('../src/pages/Extras/MaisScreens', () => 'MaisScreens');
jest.mock('../src/pages/Admin/AdminPanelScreen', () => 'AdminPanelScreen');
jest.mock('../src/pages/Admin/AdminAlertsScreen', () => 'AdminAlertsScreen');
jest.mock('../src/ui/AnimatedScreenTransition', () => ({ children }) => children);
jest.mock('../src/ui/SwipeDismissibleToast', () => 'Toast');
jest.mock('../src/ui/SpotlightGuideModal', () => ({ __esModule: true, default: 'SpotlightGuideModal', SPOTLIGHT_STORAGE_KEY: 'guide-seen' }));
jest.mock('../src/ui/SpotlightWelcomeModal', () => ({ __esModule: true, default: 'SpotlightWelcomeModal', SPOTLIGHT_WELCOME_KEY: 'welcome-seen' }));
jest.mock('../src/hooks/useNotifications', () => () => ({ notificationsEnabled: true, toggleNotifications: jest.fn() }));
jest.mock('../src/hooks/useCoordenadorNotifications', () => jest.fn());
jest.mock('@react-native-community/netinfo', () => ({ addEventListener: jest.fn(() => jest.fn()),fetch:jest.fn().mockResolvedValue({isConnected:true}) }));
jest.mock('../src/services/debugTestSession', () => ({ LOCAL_TEST_MODE: false }));
jest.mock('../src/services/firebase', () => ({ db: {} }));
jest.mock('firebase/firestore', () => ({
  collection: jest.fn((_, ...path) => path.join('/')), query: jest.fn(ref => ref), orderBy: jest.fn(),
  collectionGroup:jest.fn((_,name)=>name),setDoc:jest.fn().mockResolvedValue(),serverTimestamp:()=> 'server-time',
  doc: jest.fn((_, ...path) => ({ path: path.join('/'), id: path[path.length - 1] })), getDoc: jest.fn(), onSnapshot: jest.fn(() => jest.fn()),
}));
jest.mock('../src/services/notificacoes', () => ({ marcarNotificacaoComoLida: jest.fn().mockResolvedValue() }));
jest.mock('../src/services/notificationNavigation', () => ({ consumeNotificationPress: jest.fn().mockResolvedValue(false) }));
jest.mock('../src/services/sismorcegoData', () => ({
  VICTIM_META: { humano: { title: 'Humano' } }, addNewRecordToStorage: jest.fn(), deleteRecordFromStorage: jest.fn(),
  loadAccountProfile: jest.fn().mockResolvedValue({ username: 'Coord', email: 'coord@example.test' }),
  loadRecordsFromStorage: jest.fn().mockResolvedValue([]), loadPendingCount: jest.fn().mockResolvedValue(0),
  loadReporterName: jest.fn().mockResolvedValue('Coord'), saveAccountProfile: jest.fn(), saveReporterNameToStorage: jest.fn(),
  triggerSyncRecords: jest.fn().mockResolvedValue({ reason: 'empty' }), updateRecordInStorage: jest.fn(),
}));
jest.mock('../src/services/duvidas', () => ({ createDoubt: jest.fn(), deleteDoubt: jest.fn(), subscribeDoubts: jest.fn(() => jest.fn()) }));
jest.mock('../src/services/doubtDrafts', () => ({ loadDoubtDrafts: jest.fn().mockResolvedValue([]), removeDoubtDraft: jest.fn() }));
jest.mock('../src/services/recordDraftIdentity', () => ({ getRecordDraftIdentity: jest.fn().mockResolvedValue({ id: 'draft' }), completeRecordDraft: jest.fn() }));
jest.mock('../src/services/registroPdf', () => ({ generateRegistroPdf: jest.fn().mockResolvedValue({ path: 'pdf-file' }), savePdf: jest.fn() }));
jest.mock('../src/pages/Main/buscar/PdfOptionsSheet', () => 'PdfOptionsSheet');
jest.mock('../src/pages/Main/buscar/PdfViewerModal', () => 'PdfViewerModal');

let tree, session, mockRawRecord;
let mockReduceMotion = true;
const navigation = { navigate: jest.fn() };
const press = async label => act(async () => {
  const button = tree.root.findAll(node => typeof node.props.onPress === 'function' && node.findAllByType(Text).some(child => child.props.children === label))[0];
  if (!button) throw new Error(`Missing button: ${label}`);
  button.props.onPress();
});
beforeEach(async () => {
  jest.clearAllMocks();
  mockReduceMotion = true;
  await AsyncStorage.setItem('guide-seen', '1');
  session = { user: { uid: 'coordinator', displayName: 'Coord' }, role: 'coordenador', signOut: jest.fn().mockResolvedValue() };
  useAuth.mockImplementation(() => session);
  mockRawRecord = { tipoVitima: 'aves', municipio: 'Curuçá',
    localidade: 'Comunidade real', nomeAcs: 'Ana', dataMordedura: '2026-10-28', detalhes: { especie: 'galinha', circunstancia: 'no_galinheiro' },
    location: { latitude: -1.4, longitude: -48.4 }, photoBase64: 'AAAA', photoMime: 'image/jpeg' };
  getDoc.mockResolvedValue({id:'remote-id',exists:()=>true,data:()=>mockRawRecord});
  await act(async () => { tree = TestRenderer.create(<SismorcegoShell navigation={navigation} />); });
});
afterEach(async () => { if (tree) await act(async () => tree.unmount()); tree = null; await AsyncStorage.clear(); });

test.each(['acs', 'coordenador'])('Sair asks %s for confirmation and cancellation preserves the session', async role => {
  session.role = role; await press('Mais');
  await act(async () => tree.root.findByType('MaisScreens').props.onSignOut());
  const dialog = tree.root.findByType('SignOutConfirmationModal');
  expect(dialog.props.visible).toBe(true); expect(session.signOut).not.toHaveBeenCalled();
  await act(async () => dialog.props.onClose());
  expect(tree.root.findByType('SignOutConfirmationModal').props.visible).toBe(false);
  await act(async () => tree.root.findByType('SignOutConfirmationModal').props.onExited());
  expect(session.signOut).not.toHaveBeenCalled();
  expect(tree.root.findAllByType('MaisScreens')).toHaveLength(1);
});

test('confirmation signs out once only after its exit animation and ignores repeated taps/callbacks', async () => {
  await press('Mais'); await act(async () => tree.root.findByType('MaisScreens').props.onSignOut());
  const confirm = tree.root.findByType('SignOutConfirmationModal').props.onConfirm;
  await act(async () => { confirm(); confirm(); });
  expect(session.signOut).not.toHaveBeenCalled();
  const exited = tree.root.findByType('SignOutConfirmationModal').props.onExited;
  await act(async () => { await exited(); await exited(); });
  expect(session.signOut).toHaveBeenCalledTimes(1);
});

test('Android Back cancels sign out without navigating away from More', async () => {
  const back = jest.spyOn(BackHandler, 'addEventListener').mockReturnValue({ remove: jest.fn() });
  try {
    await press('Mais'); await act(async () => tree.root.findByType('MaisScreens').props.onSignOut());
    await act(async () => expect(back.mock.calls.at(-1)[1]()).toBe(true));
    expect(tree.root.findByType('SignOutConfirmationModal').props.visible).toBe(false);
    await act(async () => tree.root.findByType('SignOutConfirmationModal').props.onExited());
    expect(session.signOut).not.toHaveBeenCalled(); expect(tree.root.findAllByType('MaisScreens')).toHaveLength(1);
  } finally { back.mockRestore(); }
});

test('a rejected logout preserves the session and allows another confirmed attempt', async () => {
  session.signOut.mockRejectedValueOnce(new Error('Sem conexão'));
  await press('Mais');
  for (let attempt = 0; attempt < 2; attempt += 1) {
    await act(async () => tree.root.findByType('MaisScreens').props.onSignOut());
    expect(tree.root.findByType('SignOutConfirmationModal').props.visible).toBe(true);
    await act(async () => tree.root.findByType('SignOutConfirmationModal').props.onConfirm());
    await act(async () => tree.root.findByType('SignOutConfirmationModal').props.onExited());
  }
  expect(session.signOut).toHaveBeenCalledTimes(2);
});

test('administrative screens open through the dock without More shortcuts or duplicate listeners', async () => {
  expect(onSnapshot).toHaveBeenCalledTimes(3);
  expect(useCoordenadorNotifications).toHaveBeenCalledWith({ trackUnread: false, enabled: true });
  await press('Mais');
  expect(tree.root.findByType('MaisScreens').props.onOpenCoordinatorScreen).toBeUndefined();
  await press('Painel');
  expect(tree.root.findAllByType('AdminPanelScreen')).toHaveLength(1);
  await press('Alertas');
  expect(tree.root.findAllByType('AdminAlertsScreen')).toHaveLength(1);
  await press('Registros');
  await press('Alertas');
  expect(tree.root.findAllByType('AdminAlertsScreen')).toHaveLength(1);
  expect(navigation.navigate).not.toHaveBeenCalled();
  expect(onSnapshot).toHaveBeenCalledTimes(3);
});

test.each(['acs', 'coordenador'])('keyboard hides and restores the dock without remounting forms for %s', async role => {
  await act(async () => tree.unmount()); tree = null;
  session.role = role;
  const listeners = {};
  const removers = [];
  const subscription = jest.spyOn(Keyboard, 'addListener').mockImplementation((event, callback) => {
    listeners[event] = callback; const remove = jest.fn(); removers.push(remove); return { remove };
  });
  const visible = jest.spyOn(Keyboard, 'isVisible').mockReturnValue(false);
  try {
    await act(async () => { tree = TestRenderer.create(<SismorcegoShell />); });
    const dock = () => tree.root.findAllByProps({ testID: 'bottom-dock' })[0];
    const initialDockStyle = StyleSheet.flatten(dock().props.style);
    const screens = role === 'coordenador'
      ? [['Registros', 'RegistrosScreen'], ['Notificar', 'NovaNotificacaoScreen'], ['Mais', 'MaisScreens'], ['Painel', 'AdminPanelScreen'], ['Alertas', 'AdminAlertsScreen']]
      : [['Registros', 'RegistrosScreen'], ['Notificar', 'NovaNotificacaoScreen'], ['Mais', 'MaisScreens']];
    for (const [label, screen] of screens) {
      if (label === 'Notificar') await act(async () => {
        tree.root.findAll(node => typeof node.props.onPress === 'function' && node.findAllByType('LinearGradient').length > 0)[0].props.onPress();
      });
      else await press(label);
      if (label === 'Notificar') await act(async () => tree.root.findByType(screen).props.setCity('Curuçá'));
      const retained = tree.root.findByType(screen);
      await act(async () => { visible.mockReturnValue(true); listeners.keyboardDidShow({ endCoordinates: { height: 300, screenY: 500 } }); });
      expect(dock()).toBeUndefined(); expect(tree.root.findByType(screen)).toBe(retained);
      if (label === 'Notificar') expect(retained.props.city).toBe('Curuçá');
      await act(async () => { visible.mockReturnValue(false); listeners.keyboardDidHide({ endCoordinates: { height: 0, screenY: 800 } }); });
      expect(StyleSheet.flatten(dock().props.style)).toEqual(initialDockStyle);
      expect(tree.root.findByType(screen)).toBe(retained);
    }
    await act(async () => tree.unmount()); tree = null;
    removers.forEach(remove => expect(remove).toHaveBeenCalled());
  } finally { subscription.mockRestore(); visible.mockRestore(); }
});

describe('new notification defaults to the local current date', () => {
  const form = () => tree.root.findByType('NovaNotificacaoScreen').props;
  const pressFab = async () => act(async () => {
    tree.root.findAll(node => typeof node.props.onPress === 'function' &&
      node.findAllByType('LinearGradient').length > 0)[0].props.onPress();
  });
  const chooseDate = async picked => {
    await act(async () => form().onOpenCalendarForNew());
    await act(async () => {
      const calendar = tree.root.findByType('AppCalendarModal');
      calendar.props.onSelectDate(picked);
      calendar.props.onClose();
    });
  };
  beforeEach(async () => {
    await act(async () => tree.unmount());
    tree = null;
    jest.useFakeTimers({ now: new Date(2026, 9, 29, 23, 55) });
    await act(async () => { tree = TestRenderer.create(<SismorcegoShell />); });
    await pressFab();
  });
  afterEach(() => jest.useRealTimers());

  test('step 3 receives today and opens the calendar with the same day selected', async () => {
    expect(form().dateState).toEqual({ iso: '2026-10-29', display: '29/10/2026' });
    await act(async () => form().onOpenCalendarForNew());
    expect(tree.root.findByType('AppCalendarModal').props.selectedIsoDate).toBe('2026-10-29');
  });

  test('first opening on a later day uses that day rather than when the app mounted', async () => {
    await act(async () => tree.unmount());
    await act(async () => { tree = TestRenderer.create(<SismorcegoShell />); });
    jest.setSystemTime(new Date(2026, 9, 30, 0, 5));
    await pressFab();
    expect(form().dateState).toEqual({ iso: '2026-10-30', display: '30/10/2026' });
  });

  test('a manually selected date survives switching tabs and victim forms', async () => {
    const picked = { iso: '2026-10-20', display: '20/10/2026' };
    await chooseDate(picked);
    await act(async () => form().setActiveVictimSubscreen('humano'));
    await act(async () => form().setActiveVictimSubscreen(null));
    await press('Registros');
    await pressFab();
    expect(form().dateState).toEqual(picked);
    await act(async () => form().onOpenCalendarForNew());
    expect(tree.root.findByType('AppCalendarModal').props.selectedIsoDate).toBe(picked.iso);
  });

  test.each([
    [new Date(2026, 9, 30, 0, 5), { iso: '2026-10-30', display: '30/10/2026' }],
    [new Date(2027, 0, 1, 0, 5), { iso: '2027-01-01', display: '01/01/2027' }],
  ])('clearing the form recalculates today after a date change', async (now, expected) => {
    await chooseDate({ iso: '2026-10-20', display: '20/10/2026' });
    jest.setSystemTime(now);
    await pressFab();
    expect(form().dateState).toEqual(expected);
  });

  test.each([false, true])('clearing returns the form to the top with reduced motion %s', async reduceMotion => {
    mockReduceMotion = reduceMotion;
    await act(async () => tree.update(<SismorcegoShell />));
    const scrollTo = jest.fn();
    const dismiss = jest.spyOn(Keyboard, 'dismiss');
    try {
      await act(async () => {
        form().setCity('Belém'); form().setCommunity('Castanheira');
        form().setPhotoState({ localUri: 'file:///foto.jpg' });
      });
      form().guideScroll.node = { scrollTo };
      form().guideScroll.offset = 900;
      await pressFab();
      expect(scrollTo).toHaveBeenCalledWith({ y: 0, animated: !reduceMotion });
      expect(dismiss).toHaveBeenCalled();
      expect(form()).toMatchObject({ city: '', community: '', photoState: null, selectedVictimKey: '', activeVictimSubscreen: null });
      // Opening the tab again must preserve an in-progress draft.
      await act(async () => form().setCity('Curuçá'));
      await press('Registros'); scrollTo.mockClear();
      await pressFab();
      expect(scrollTo).not.toHaveBeenCalled(); expect(form().city).toBe('Curuçá');
      await act(async () => jest.advanceTimersByTime(1000));
    } finally { dismiss.mockRestore(); }
  });

  test('saving preserves the selected day and the next occurrence starts with current today', async () => {
    const picked = { iso: '2026-10-20', display: '20/10/2026' };
    await chooseDate(picked);
    jest.setSystemTime(new Date(2026, 9, 30, 0, 5));
    addNewRecordToStorage.mockImplementationOnce(async record => ({ ...record, id: 'draft' }));
    await act(async () => form().onSaveCompleteRecord('humano', {}));
    expect(addNewRecordToStorage).toHaveBeenLastCalledWith(expect.objectContaining({ date: picked.display, isoDate: picked.iso }));
    jest.setSystemTime(new Date(2026, 9, 31, 9, 0));
    await pressFab();
    expect(form().dateState).toEqual({ iso: '2026-10-31', display: '31/10/2026' });
  });
});

test('selecting a records filter keeps its identifier and closes the shared sheet', async () => {
  await act(async () => tree.root.findByType('RegistrosScreen').props.onOpenAdminVictimFilter());
  const sheet = tree.root.findByType('BottomSheetModal');
  expect(sheet.props.visible).toBe(true);
  const choice = sheet.props.options.find(option => option.id === 'aves');
  await act(async () => sheet.props.onSelect(choice));
  expect(tree.root.findByType('RegistrosScreen').props.adminVictimFilter).toBe('aves');
  expect(tree.root.findByType('BottomSheetModal').props.visible).toBe(false);
  expect(tree.root.findByType('BottomSheetModal').props.selectedValue).toBe('aves');
});

test('a remote alert opens adapted read-only details and exports the actual raw record to PDF', async () => {
  const item = { id: 'alert-1', registroId: 'remote-id', uidAcs: 'another-acs', createdAt: '2026-10-28', lida: false };
  await act(async () => {
    onSnapshot.mock.calls[0][1]({docs:[{id:'remote-id',ref:{path:'registros/another-acs/itens/remote-id'},data:()=>mockRawRecord}]});
    onSnapshot.mock.calls[1][1]({docs:[]});
    onSnapshot.mock.calls[2][1]({docs:[{id:item.id,data:()=>item}]});
  });
  await press('Alertas');
  const alertScreen = tree.root.findByType('AdminAlertsScreen');
  expect(alertScreen.props.alerts[0]).toMatchObject({ title: 'Aves', community: 'Comunidade real' });
  await act(async () => alertScreen.props.onSelectAlert(alertScreen.props.alerts[0]));
  const details = tree.root.findByType('RecordDetailsModal');
  expect(details.props.visible).toBe(true);
  expect(details.props.canEdit).toBe(false);
  expect(details.props.record).toMatchObject({ id: 'remote-id', uid: 'another-acs', victimKey: 'aves', gps: { lat: -1.4, lng: -48.4 },
    details: { 'av-especie': 'Galinha' }, photo: { uri: 'data:image/jpeg;base64,AAAA' } });
  await expect(details.props.onSaveRecord(details.props.record)).rejects.toThrow('somente para consulta');
  await expect(details.props.onDeleteRecord()).rejects.toThrow('somente para consulta');
  expect(updateRecordInStorage).not.toHaveBeenCalled();
  expect(deleteRecordFromStorage).not.toHaveBeenCalled();
  await act(async () => details.props.onExportPdf());
  expect(tree.root.findByType('PdfOptionsSheet').props.registro).toBeNull();
  await act(async () => details.props.onExited());
  const options = tree.root.findByType('PdfOptionsSheet');
  expect(options.props.registro).toMatchObject({ uid: 'another-acs', tipoVitima: 'aves', photoBase64: 'AAAA' });
  await act(async () => options.props.onSelect(options.props.registro, { photo: true }));
  expect(generateRegistroPdf).toHaveBeenCalledWith(expect.objectContaining({ uid: 'another-acs', photoBase64: 'AAAA' }), { photo: true });
  expect(tree.root.findByType('PdfViewerModal').props.pdf).toBeNull();
  await act(async () => options.props.onExited());
  expect(tree.root.findByType('PdfViewerModal').props.pdf).toEqual({ path: 'pdf-file' });
  expect(getDoc).toHaveBeenCalledTimes(1);
});

test('a coordinator can edit and cancel an own record and use its server conflict version', async () => {
  const own = toRecordView({ ...mockRawRecord, uid: session.user.uid, recordId: 'mine', _origin: 'cloud' });
  await act(async () => tree.root.findByType('RegistrosScreen').props.onSelectRecord(own));
  let details = tree.root.findByType('RecordDetailsModal');
  expect(details.props.canEdit).toBe(true);
  expect(details.props.onUseServerRecord).toEqual(expect.any(Function));
  const updated = { ...own, city: 'Belém' };
  updateRecordInStorage.mockResolvedValueOnce(updated);
  await act(async () => details.props.onSaveRecord(updated));
  expect(updateRecordInStorage).toHaveBeenCalledWith(updated);
  details = tree.root.findByType('RecordDetailsModal');
  deleteRecordFromStorage.mockResolvedValueOnce({ ...updated, lifecycleStatus: 'cancelled' });
  await act(async () => details.props.onDeleteRecord('mine', 'Duplicidade'));
  expect(deleteRecordFromStorage).toHaveBeenCalledWith(updated, 'Duplicidade');
  expect(tree.root.findByType('RecordDetailsModal').props.visible).toBe(false);
});

test.each(['acs-other','coordinator-other'])('coordinators cannot modify records owned by %s, or forge a different identity in an own editor', async other => {
  const third = toRecordView({ ...mockRawRecord, uid: other, recordId: 'third', _origin: 'cloud' });
  await act(async () => tree.root.findByType('RegistrosScreen').props.onSelectRecord(third));
  const details = tree.root.findByType('RecordDetailsModal');
  expect(details.props.canEdit).toBe(false);
  await expect(details.props.onSaveRecord(third)).rejects.toThrow('consulta');
  await expect(details.props.onDeleteRecord('third','Motivo')).rejects.toThrow('consulta');
  const own = toRecordView({ ...mockRawRecord, uid: session.user.uid, recordId: 'mine', _origin: 'cloud' });
  await act(async () => tree.root.findByType('RegistrosScreen').props.onSelectRecord(own));
  await expect(tree.root.findByType('RecordDetailsModal').props.onSaveRecord({ ...own, id:'changed' })).rejects.toThrow('identidade');
  expect(updateRecordInStorage).not.toHaveBeenCalled();
  expect(deleteRecordFromStorage).not.toHaveBeenCalled();
});

test('cancelled own records are read-only for a coordinator',async()=>{
  const own=toRecordView({...mockRawRecord,uid:session.user.uid,recordId:'cancelled',lifecycleStatus:'cancelled'});
  await act(async()=>tree.root.findByType('RegistrosScreen').props.onSelectRecord(own));
  const details=tree.root.findByType('RecordDetailsModal');
  expect(details.props.canEdit).toBe(false);
  await expect(details.props.onSaveRecord(own)).rejects.toThrow('consulta');
  await expect(details.props.onDeleteRecord('cancelled','Motivo')).rejects.toThrow('consulta');
});

test('switching to ACS removes administrative tabs and prevents retained dock callbacks from opening them', async () => {
  const oldOpen = tree.root.findAll(node => node.props.accessibilityLabel === 'Alertas' && typeof node.props.onPress === 'function')[0].props.onPress;
  await press('Painel');
  session.role = 'acs';
  await act(async () => tree.update(<SismorcegoShell navigation={navigation} />));
  await act(async () => oldOpen());
  expect(tree.root.findAllByType('AdminPanelScreen')).toHaveLength(0);
  expect(tree.root.findAllByType('AdminAlertsScreen')).toHaveLength(0);
  expect(tree.root.findAll(node => ['Painel', 'Alertas'].includes(node.props.accessibilityLabel))).toHaveLength(0);
  expect(tree.root.findAllByType('RegistrosScreen')).toHaveLength(1);
});

test('guide scroll room stays mounted until its exit finishes', async () => {
  await press('Mais');
  await act(async () => tree.root.findByType('MaisScreens').props.onOpenInteractiveGuide());
  await act(async () => tree.root.findByType('SpotlightGuideModal').props.onSwitchTab('panel'));
  expect(tree.root.findByType('AdminPanelScreen').props.guideActive).toBe(true);
  await act(async () => tree.root.findByType('SpotlightGuideModal').props.onSkip());
  expect(tree.root.findByType('SpotlightGuideModal').props.visible).toBe(false);
  expect(tree.root.findByType('AdminPanelScreen').props.guideActive).toBe(true);
  await act(async () => tree.root.findByType('SpotlightGuideModal').props.onExited());
  expect(tree.root.findByType('AdminPanelScreen').props.guideActive).toBe(false);
});

test.each(['acs', 'coordenador'])('continuing from welcome opens Registros after its exit for %s', async role => {
  session.role = role;
  await act(async () => tree.update(<SismorcegoShell navigation={navigation} />));
  await press('Mais');
  await act(async () => tree.root.findByType('MaisScreens').props.onOpenInteractiveGuide());
  await act(async () => tree.root.findByType('SpotlightGuideModal').props.onComplete());
  await act(async () => tree.root.findByType('SpotlightGuideModal').props.onExited());
  expect(tree.root.findByType('SpotlightWelcomeModal').props.visible).toBe(true);

  await act(async () => tree.root.findByType('SpotlightWelcomeModal').props.onClose());
  expect(tree.root.findByType('SpotlightWelcomeModal').props.visible).toBe(false);
  expect(tree.root.findAllByType('MaisScreens')).toHaveLength(1);
  expect(tree.root.findAllByType('RegistrosScreen')).toHaveLength(0);

  await act(async () => tree.root.findByType('SpotlightWelcomeModal').props.onExited());
  expect(tree.root.findAllByType('RegistrosScreen')).toHaveLength(1);
  expect(tree.root.findAllByType('MaisScreens')).toHaveLength(0);
});

describe('initial tutorial defers application data', () => {
  const dataTasks = [loadRecordsFromStorage, loadPendingCount, loadAccountProfile, loadReporterName,
    loadDoubtDrafts, subscribeDoubts, triggerSyncRecords, getRecordDraftIdentity, addNewRecordToStorage,
    onSnapshot, notifee.getInitialNotification, consumeNotificationPress];
  const expectPaused = () => {
    dataTasks.forEach(task => expect(task).not.toHaveBeenCalled());
    expect(NetInfo.addEventListener).not.toHaveBeenCalled();
    expect(useCoordenadorNotifications).toHaveBeenLastCalledWith({ trackUnread: false, enabled: false });
  };
  const mountFirstLaunch = async (role = 'coordenador') => {
    session.role = role;
    await act(async () => { tree = TestRenderer.create(<SismorcegoShell />); });
  };
  const openInitialGuide = async () => {
    await mountFirstLaunch();
    await act(async () => { await jest.advanceTimersByTimeAsync(500); });
    expect(tree.root.findByType('SpotlightGuideModal').props.visible).toBe(true);
  };
  beforeEach(async () => {
    await act(async () => tree.unmount());
    tree = null;
    await AsyncStorage.clear();
    jest.clearAllMocks();
    jest.useFakeTimers();
    jest.spyOn(AppState, 'addEventListener').mockReturnValue({ remove: jest.fn() });
    NetInfo.addEventListener.mockImplementation(listener => {
      listener({ isConnected: true, isInternetReachable: true });
      return jest.fn();
    });
  });
  afterEach(() => {
    jest.restoreAllMocks();
    jest.useRealTimers();
    NetInfo.addEventListener.mockImplementation(() => jest.fn());
  });

  test('storage verification and the opening delay cannot race with data reads or sync', async () => {
    let resolveSeen;
    AsyncStorage.getItem.mockImplementationOnce(() => new Promise(resolve => { resolveSeen = resolve; }));
    await mountFirstLaunch();
    expectPaused();
    await act(async () => { await jest.advanceTimersByTimeAsync(1000); });
    expect(tree.root.findByType('SpotlightGuideModal').props.visible).toBe(false);
    expectPaused();
    // An exit callback before the guide has opened cannot unlock startup.
    await act(async () => tree.root.findByType('SpotlightGuideModal').props.onExited());
    await act(async () => resolveSeen(null));
    await act(async () => { await jest.advanceTimersByTimeAsync(499); });
    expectPaused();
    await act(async () => { await jest.advanceTimersByTimeAsync(1); });
    expect(tree.root.findByType('SpotlightGuideModal').props.visible).toBe(true);
    expectPaused();
  });

  test('login readiness waits for guide entry and does not enable any initial tutorial data', async () => {
    const onInitialScreenReady = jest.fn();
    await act(async () => { tree = TestRenderer.create(<SismorcegoShell onInitialScreenReady={onInitialScreenReady} />); });
    await act(async () => tree.root.findAllByProps({ testID: 'sismorcego-shell' })[0].props.onLayout());
    await act(async () => { jest.advanceTimersByTime(500); });
    expect(onInitialScreenReady).not.toHaveBeenCalled(); expectPaused();
    const guide = tree.root.findByType('SpotlightGuideModal'); expect(guide.props.visible).toBe(true);
    await act(async () => guide.props.onReady());
    expect(onInitialScreenReady).toHaveBeenCalledTimes(1); expectPaused();
    expect(tree.root.findByType('SpotlightWelcomeModal').props.visible).toBe(false);
    await act(async () => guide.props.onReady()); expect(onInitialScreenReady).toHaveBeenCalledTimes(1);
  });

  test('returning users release the login cover after the Shell layout without waiting for a guide', async () => {
    await AsyncStorage.setItem('guide-seen', '1');
    const onInitialScreenReady = jest.fn();
    await act(async () => { tree = TestRenderer.create(<SismorcegoShell onInitialScreenReady={onInitialScreenReady} />); });
    expect(onInitialScreenReady).not.toHaveBeenCalled();
    await act(async () => tree.root.findAllByProps({ testID: 'sismorcego-shell' })[0].props.onLayout());
    expect(onInitialScreenReady).toHaveBeenCalledTimes(1);
    expect(tree.root.findByType('SpotlightGuideModal').props.visible).toBe(false);
  });

  test.each(['acs', 'coordenador'])('%s cannot fetch, sync or create a draft while exploring the initial tour', async role => {
    await mountFirstLaunch(role);
    await act(async () => { await jest.advanceTimersByTimeAsync(500); });
    const home = tree.root.findByType('RegistrosScreen');
    expect(home.props.records).toEqual([]);
    expect(home.props.loading).toBe(false);
    await act(async () => {
      await home.props.onRefresh();
      await home.props.onSyncNow();
      DeviceEventEmitter.emit('registros:changed');
      AppState.addEventListener.mock.calls.forEach(([, callback]) => callback('active'));
    });
    await act(async () => tree.root.findByType('SpotlightGuideModal').props.onSwitchTab('new'));
    await act(async () => tree.root.findByType('NovaNotificacaoScreen').props.onSaveCompleteRecord('humano', {}));
    if (role === 'coordenador') {
      await act(async () => tree.root.findByType('SpotlightGuideModal').props.onSwitchTab('panel'));
      expect(tree.root.findByType('AdminPanelScreen').props.records).toEqual([]);
      await act(async () => tree.root.findByType('SpotlightGuideModal').props.onSwitchTab('alerts'));
      expect(tree.root.findByType('AdminAlertsScreen').props.alerts).toEqual([]);
      expect(tree.root.findByType('AdminAlertsScreen').props.loading).toBe(false);
    }
    expectPaused();
    expect(await AsyncStorage.getItem('guide-seen')).toBeNull();
  });

  test('skipping releases automatic loading and sync only after the closing animation', async () => {
    await openInitialGuide();
    await act(async () => tree.root.findByType('SpotlightGuideModal').props.onSkip());
    expect(tree.root.findByType('SpotlightGuideModal').props.visible).toBe(false);
    expectPaused();
    expect(await AsyncStorage.getItem('guide-seen')).toBe('1');
    await act(async () => tree.root.findByType('SpotlightGuideModal').props.onExited());
    expect(loadRecordsFromStorage).toHaveBeenCalled();
    expect(triggerSyncRecords).toHaveBeenCalledTimes(1);
    expect(subscribeDoubts).toHaveBeenCalledTimes(1);
    expect(onSnapshot).toHaveBeenCalledTimes(3);
    expect(tree.root.findByType('SpotlightWelcomeModal').props.visible).toBe(false);
  });

  test('completion waits through guide exit, welcome, and welcome exit before loading', async () => {
    await openInitialGuide();
    await act(async () => tree.root.findByType('SpotlightGuideModal').props.onComplete());
    expectPaused();
    await act(async () => tree.root.findByType('SpotlightGuideModal').props.onExited());
    expect(tree.root.findByType('SpotlightWelcomeModal').props.visible).toBe(true);
    expectPaused();
    await act(async () => tree.root.findByType('SpotlightWelcomeModal').props.onClose());
    expectPaused();
    await act(async () => tree.root.findByType('SpotlightWelcomeModal').props.onExited());
    expect(tree.root.findAllByType('RegistrosScreen')).toHaveLength(1);
    expect(loadRecordsFromStorage).toHaveBeenCalled();
    expect(triggerSyncRecords).toHaveBeenCalledTimes(1);
    expect(subscribeDoubts).toHaveBeenCalledTimes(1);
    expect(onSnapshot).toHaveBeenCalledTimes(3);
  });

  test('completing when welcome was already shown starts data after guide exit', async () => {
    await AsyncStorage.setItem('welcome-seen', '1');
    await openInitialGuide();
    await act(async () => tree.root.findByType('SpotlightGuideModal').props.onComplete());
    expectPaused();
    await act(async () => tree.root.findByType('SpotlightGuideModal').props.onExited());
    expect(loadRecordsFromStorage).toHaveBeenCalled();
    expect(tree.root.findByType('SpotlightWelcomeModal').props.visible).toBe(false);
  });

  test('an interrupted first tour remains pending on the next launch', async () => {
    await openInitialGuide();
    await act(async () => tree.unmount());
    tree = null;
    await mountFirstLaunch();
    await act(async () => { await jest.advanceTimersByTimeAsync(500); });
    expect(tree.root.findByType('SpotlightGuideModal').props.visible).toBe(true);
    expectPaused();
  });

  test('a failed guide preference read keeps data paused and still offers the tour', async () => {
    AsyncStorage.getItem.mockRejectedValueOnce(new Error('Storage unavailable'));
    await openInitialGuide();
    expectPaused();
  });

  test('unmounting during preference verification or delay never starts application data', async () => {
    let resolveSeen;
    AsyncStorage.getItem.mockImplementationOnce(() => new Promise(resolve => { resolveSeen = resolve; }));
    await mountFirstLaunch();
    await act(async () => tree.unmount());
    tree = null;
    await act(async () => resolveSeen('1'));
    dataTasks.forEach(task => expect(task).not.toHaveBeenCalled());
    await mountFirstLaunch();
    await act(async () => tree.unmount());
    tree = null;
    await act(async () => { await jest.advanceTimersByTimeAsync(1000); });
    dataTasks.forEach(task => expect(task).not.toHaveBeenCalled());
  });

  test('a returning user starts normally and replaying the guide keeps data active', async () => {
    await AsyncStorage.setItem('guide-seen', '1');
    await mountFirstLaunch();
    expect(loadRecordsFromStorage).toHaveBeenCalled();
    const firstInboxStop = onSnapshot.mock.results[0].value;
    await press('Mais');
    await act(async () => tree.root.findByType('MaisScreens').props.onOpenInteractiveGuide());
    expect(tree.root.findByType('SpotlightGuideModal').props.visible).toBe(true);
    expect(useCoordenadorNotifications).toHaveBeenLastCalledWith({ trackUnread: false, enabled: true });
    expect(firstInboxStop).not.toHaveBeenCalled();
    const before = triggerSyncRecords.mock.calls.length;
    await act(async () => {
      AppState.addEventListener.mock.calls.forEach(([, callback]) => callback('active'));
    });
    expect(triggerSyncRecords.mock.calls.length).toBeGreaterThan(before);
  });
});
