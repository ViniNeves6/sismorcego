import React from 'react';
import Renderer, { act } from 'react-test-renderer';
import { AccessibilityInfo, StyleSheet, Text as NativeText, View as NativeView } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Tts from 'react-native-tts';
import useAccessibility, { AccessibilityProvider } from '../src/hooks/useAccessibility';
import { ThemeProvider } from '../src/theme/ThemeProvider';
import ThemeText from '../src/ui/Text';
import Badge from '../src/ui/Badge';
import { FontText } from '../src/ui/FontText';
import { Text, View } from '../src/ui/AccessibleNative';
import { contrastRatio, surfaceColor } from '../src/ui/accessibilityStyles';
import AdminPanelScreen from '../src/pages/Admin/AdminPanelScreen';
import AdminAlertsScreen from '../src/pages/Admin/AdminAlertsScreen';
import RegistrosScreen from '../src/pages/Main/RegistrosScreen';
import NovaNotificacaoScreen from '../src/pages/Main/NovaNotificacaoScreen';
import MaisScreens from '../src/pages/Extras/MaisScreens';
import BottomSheetModal from '../src/ui/BottomSheetModal';
import AppCalendarModal from '../src/ui/AppCalendarModal';
import RecordDetailsModal from '../src/ui/RecordDetailsModal';
import { ReporterModal } from '../src/ui/ThemedDialogs';

jest.mock('../src/services/redesignData', () => ({}));
jest.mock('../src/services/deviceCapture', () => ({ pickRegistroPhoto: jest.fn(), captureGpsLocation: jest.fn() }));
jest.mock('../src/services/geocoding', () => ({ reverseGeocodeMunicipio: jest.fn(), reverseGeocodeLocation: jest.fn() }));
jest.mock('../src/ui/RecordAuditTrail', () => 'RecordAuditTrail');
jest.mock('react-native-linear-gradient', () => 'LinearGradient');
jest.mock('react-native-vector-icons/Feather', () => 'Feather');
jest.mock('react-native-maps', () => ({ __esModule: true, default: 'Map', Marker: 'Marker', Heatmap: 'Heatmap' }));
jest.mock('react-native-svg', () => ({
  __esModule: true, default: 'Svg', Path: 'Path', Circle: 'Circle', Rect: 'Rect', Line: 'Line', Polyline: 'Polyline',
  Polygon: 'Polygon', Defs: 'Defs', LinearGradient: 'SvgLinearGradient', RadialGradient: 'RadialGradient', Stop: 'Stop', G: 'G',
}));

const records = [{ id: 'r1', title: 'Canino / Felino', victimKey: 'canino', city: 'Belém', community: 'Castanheira', reporter: 'Ana Lima',
  date: '30/10/2026', isoDate: '2026-10-30', status: 'synced', statusLabel: 'Sincronizado', details: { especie: 'Canina' } }];
let api, tree;
function Probe() { api = useAccessibility(); return null; }
function Extras({ screen }) { const preferences = useAccessibility(); return <MaisScreens activeSubscreen={screen} setActiveSubscreen={jest.fn()} accountProfile={{ username: 'Ana', email: 'ana@example.test' }}
  doubts={[{ id: 'q1', question: 'Como consultar meus registros?', createdAt: '30/10/2026' }]} doubtsView="list"
  accessibility={preferences.settings} onUpdateAccessibility={preferences.updateSettings} />; }
const fixtures = {
  panel: () => <AdminPanelScreen records={records} />,
  alerts: () => <AdminAlertsScreen alerts={records} />,
  records: () => <RegistrosScreen records={records} isCoordenador />,
  new: () => <NovaNotificacaoScreen reporterName="Ana Lima" victimData={{}} victimSaved={{}} selectedVictimKey="" city="Belém" community="Castanheira" dateState={{ display: '30/10/2026' }} />,
  settings: () => <Extras screen="sub-settings" />,
  account: () => <Extras screen="sub-account" />,
  password: () => <Extras screen="sub-password" />,
  questions: () => <Extras screen="sub-faq" />,
  credits: () => <Extras screen="sub-credits" />,
  calendar: () => <AppCalendarModal visible selectedIsoDate="2026-10-30" />,
  sheet: () => <BottomSheetModal visible title="Município" options={['Todos', 'Belém']} selectedValue="Todos" />,
  reporter: () => <ReporterModal visible reporterName="Ana Lima" />,
  details: () => <RecordDetailsModal visible record={records[0]} canEdit />,
};
const wrap = children => <AccessibilityProvider><ThemeProvider><Probe />{children}</ThemeProvider></AccessibilityProvider>;
const mount = async (children, settings = {}) => {
  await AsyncStorage.setItem('@sismorcego:accessibility', JSON.stringify({ reduceMotion: true, ...settings }));
  await act(async () => { tree = Renderer.create(wrap(null)); });
  await act(async () => tree.update(wrap(children)));
};
const textStyle = label => StyleSheet.flatten(tree.root.findAllByType(NativeText).find(node => node.props.children === label)?.props.style);
const press = async label => {
  const button = tree.root.findAll(node => typeof node.props.onPress === 'function').find(node => node.props.accessibilityLabel === label || node.findAllByType(NativeText).some(text => text.props.children === label));
  expect(button).toBeTruthy(); await act(async () => button.props.onPress());
};
beforeEach(() => {
  jest.clearAllMocks(); jest.useFakeTimers();
  jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(false);
});
afterEach(async () => {
  if (tree) await act(async () => tree.unmount()); tree = null;
  await AsyncStorage.clear(); jest.restoreAllMocks(); jest.useRealTimers();
});

test.each(Object.keys(fixtures))('%s applies high contrast to text against its actual card/button surface', async screen => {
  await mount(fixtures[screen](), { highContrast: true });
  const labels = tree.root.findAllByType(NativeText).filter(node => typeof node.props.children === 'string' && node.props.children.trim());
  expect(labels.length).toBeGreaterThanOrEqual(3);
  for (const node of labels) {
    const ancestors = []; let parent = node;
    while (parent) { if ([NativeView, NativeText, 'LinearGradient'].includes(parent.type)) ancestors.unshift(parent); parent = parent.parent; }
    let background = '#08080C';
    for (const ancestor of ancestors) background = ancestor.type === 'LinearGradient' ? ancestor.props.colors[0] : surfaceColor(ancestor.props.style, background);
    const color = StyleSheet.flatten(node.props.style)?.color;
    expect({ text: node.props.children, color, background, readable: contrastRatio(color, background) >= 4.5 }).toMatchObject({ readable: true });
  }
});

test.each([
  ['panel', 'Painel', 'Filtrar ocorrências'], ['alerts', 'Alertas', 'Ana Lima'], ['records', 'Registros', 'Ana Lima'],
  ['new', 'Nova notificação', 'Município da ocorrência'], ['settings', 'Configurações', 'Assim o texto aparece nas telas do app.'],
  ['account', 'Minha conta', 'Nome de usuário'], ['password', 'Alterar senha', 'Nova senha'],
  ['questions', 'Dúvidas', 'Como consultar meus registros?'], ['calendar', 'Selecionar data', 'Cancelar'],
  ['sheet', 'Município', 'Belém'], ['details', 'Detalhes do registro', 'Município'],
])('%s scales heading and body at every setting and returns to the original size', async (screen, heading, body) => {
  await mount(fixtures[screen]());
  const initialHeading = textStyle(heading)?.fontSize, initialBody = textStyle(body)?.fontSize;
  expect(initialHeading).toBeGreaterThan(0); expect(initialBody).toBeGreaterThan(0);
  for (const fontScale of [0.85, 1.15, 1.3, 1]) {
    await act(async () => api.updateSettings({ fontScale }));
    expect(textStyle(heading).fontSize).toBeCloseTo(initialHeading * fontScale);
    expect(textStyle(body).fontSize).toBeCloseTo(initialBody * fontScale);
  }
});

test('raw, accessible, nested and legacy themed text use the font scale exactly once', async () => {
  await mount(<View><FontText style={{ fontSize: 20 }}>Raw <FontText testID="nested">nested</FontText></FontText>
    <Text style={{ fontSize: 20 }}>Accessible</Text><ThemeText style={{ fontSize: 20 }}>Legacy</ThemeText><Badge label="Sincronizado" /></View>, { fontScale: 1.3 });
  for (const label of ['Accessible', 'Legacy']) expect(textStyle(label).fontSize).toBe(26);
  expect(textStyle('Sincronizado').fontSize).toBe(17);
  const raw = tree.root.findAllByType(NativeText).find(node => Array.isArray(node.props.children));
  expect(StyleSheet.flatten(raw.props.style).fontSize).toBe(26);
  const nested = tree.root.findAllByType(NativeText).find(node => node.props.testID === 'nested');
  expect(StyleSheet.flatten(nested.props.style).fontSize).toBeUndefined();
});

test('high contrast preserves readable selected pills, chart strokes and gradient contents', async () => {
  await mount(fixtures.records(), { highContrast: true });
  expect(textStyle('Todos').color).toBe('#000000');
  expect(tree.root.findAllByType('LinearGradient').every(node => node.props.colors.every(color => ['#08080C', '#18181F'].includes(color)))).toBe(true);
  await act(async () => tree.update(wrap(fixtures.panel())));
  expect(tree.root.findAllByType('Polyline').some(node => node.props.stroke === '#FFD700')).toBe(true);
  expect(tree.root.findAllByType('Stop').every(node => node.props.stopColor === '#FFD700')).toBe(true);
});

test('settings uses neighboring size presets, accessible switch state, and the voice sample', async () => {
  await mount(fixtures.settings(), { fontScale: 1.1 });
  await press('Diminuir tamanho do texto'); expect(api.fontScale).toBe(1);
  await press('Aumentar tamanho do texto'); expect(api.fontScale).toBe(1.15);
  await press('Aumentar tamanho do texto'); expect(api.fontScale).toBe(1.3);
  const button = label => tree.root.findAll(node => typeof node.props.onPress === 'function').find(node => node.props.accessibilityLabel === label);
  expect(button('Aumentar tamanho do texto').props.disabled).toBe(true);
  await press('Alto contraste'); expect(button('Alto contraste').props.accessibilityState.checked).toBe(true);
  await press('Leitura em voz alta'); expect(button('Leitura em voz alta').props.accessibilityState.checked).toBe(true);
  await press('Ouvir exemplo de leitura'); expect(Tts.speak).toHaveBeenLastCalledWith(expect.stringContaining('Leitura por voz do Sismorcego'));
  await press('Leitura em voz alta'); expect(button('Ouvir exemplo de leitura').props.disabled).toBe(true);
});

test('panel and records filter pairs reserve more width when the text is enlarged', async () => {
  for (const screen of ['panel', 'records']) {
    await mount(fixtures[screen]());
    const getFilter = () => tree.root.findAllByProps({ accessibilityLabel: 'Filtrar por município' })[0];
    expect(StyleSheet.flatten(getFilter().props.style).flexBasis).toBe(158);
    await act(async () => api.updateSettings({ fontScale: 1.3 }));
    expect(StyleSheet.flatten(getFilter().props.style).flexBasis).toBeCloseTo(205.4);
    await act(async () => tree.unmount()); tree = null;
  }
});

test('real panel, record details and chart selection announce their displayed data', async () => {
  await mount(fixtures.panel(), { ttsEnabled: true });
  await act(async () => { jest.advanceTimersByTime(100); });
  expect(Tts.speak).toHaveBeenLastCalledWith(expect.stringContaining('Total de registros: 1'));
  await press('Mês');
  expect(Tts.speak).toHaveBeenLastCalledWith(expect.stringContaining('Registros por período'));
  await act(async () => tree.update(wrap(<>{fixtures.panel()}{fixtures.details()}</>)));
  await act(async () => { jest.advanceTimersByTime(100); });
  expect(Tts.speak).toHaveBeenLastCalledWith(expect.stringContaining('Agente: Ana Lima'));
  await act(async () => tree.update(wrap(fixtures.alerts())));
  await act(async () => { jest.advanceTimersByTime(100); });
  expect(Tts.speak).toHaveBeenLastCalledWith(expect.stringContaining('1 alertas não lidos'));
});
