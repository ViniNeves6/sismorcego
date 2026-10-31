import React, { useState } from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { BackHandler, StyleSheet, Text, View } from 'react-native';
import { Animated } from '../src/ui/AccessibleNative';
import AnimatedOverlay from '../src/ui/AnimatedOverlay';
import AppCalendarModal from '../src/ui/AppCalendarModal';
import BottomSheetModal from '../src/ui/BottomSheetModal';
import HowToModal from '../src/ui/HowToModal';
import RecordDetailsModal from '../src/ui/RecordDetailsModal';
import RecordNotificationsModal from '../src/ui/RecordNotificationsModal';
import { ReporterModal, SignOutConfirmationModal, ThemedInfoModal } from '../src/ui/ThemedDialogs';
import MaisScreens from '../src/pages/Extras/MaisScreens';
import { layoutCalendar } from './helpers/layoutCalendar';
import { layoutRecordDetails } from './helpers/layoutRecordDetails';

jest.mock('../src/ui/useReduceMotion', () => () => mockSystemReduceMotion);
jest.mock('../src/services/redesignData', () => ({}));
jest.mock('../src/services/deviceCapture', () => ({ pickRegistroPhoto: jest.fn(), captureGpsLocation: jest.fn() }));
jest.mock('../src/services/geocoding', () => ({ reverseGeocodeMunicipio: jest.fn() }));
jest.mock('../src/ui/GpsMapPreview', () => 'GpsMapPreview');
jest.mock('../src/ui/RecordAuditTrail', () => 'RecordAuditTrail');
jest.mock('react-native-linear-gradient', () => 'LinearGradient');
jest.mock('react-native-svg', () => ({
  __esModule: true, default: 'Svg', Path: 'Path', Circle: 'Circle', Rect: 'Rect', Text: 'SvgText',
  Line: 'Line', Polyline: 'Polyline',
}));

let tree, animations, backCallbacks;
let mockSystemReduceMotion = false;
const finish = async animation => act(async () => animation.finish());
const hasText = value => tree.root.findAllByType(Text).some(node => node.props.children === value);
const layers = () => tree.root.findAllByType(View).filter(node => node.props.needsOffscreenAlphaCompositing);
const press = async label => {
  const button = tree.root.findAll(node => node.props.onPress &&
    node.findAllByType(Text).some(text => text.props.children === label))[0];
  if (!button) throw new Error(`Missing button ${label}`);
  await act(async () => button.props.onPress());
};
beforeEach(() => {
  animations = []; backCallbacks = []; mockSystemReduceMotion = false;
  jest.spyOn(Animated, 'loop').mockImplementation(() => ({ start: jest.fn(), stop: jest.fn() }));
  jest.spyOn(Animated, 'timing').mockImplementation((value, config) => {
    let completion;
    const animation = {
      value, config,
      start(callback) { completion = callback; animation.mountedAtStart = tree?.toJSON(); animations.push(animation); },
      stop: jest.fn(),
      finish() { value.setValue(config.toValue); completion?.({ finished: true }); },
    };
    return animation;
  });
  jest.spyOn(BackHandler, 'addEventListener').mockImplementation((_, callback) => {
    backCallbacks.push(callback);
    return { remove: jest.fn() };
  });
});

test('sign out confirmation offers Cancelar/Sair and reports exit only after the fade completes', async () => {
  const onConfirm = jest.fn(), onClose = jest.fn(), onExited = jest.fn();
  const popup = visible => <SignOutConfirmationModal visible={visible} onConfirm={onConfirm} onClose={onClose} onExited={onExited} />;
  await act(async () => { tree = TestRenderer.create(popup(true)); });
  await finish(animations.at(-1));
  expect(hasText('Sair da conta?')).toBe(true); expect(hasText('Cancelar')).toBe(true);
  await press('Sair'); expect(onConfirm).toHaveBeenCalledTimes(1); expect(onClose).not.toHaveBeenCalled();
  await act(async () => tree.update(popup(false)));
  expect(hasText('Sair da conta?')).toBe(true); expect(onExited).not.toHaveBeenCalled();
  expect(layers()[0].props.pointerEvents).toBe('auto');
  await finish(animations.at(-1));
  expect(tree.toJSON()).toBeNull(); expect(onExited).toHaveBeenCalledTimes(1);
});

test.each(['app', 'system'])('sign out confirmation respects %s reduced motion and closes immediately', async source => {
  mockSystemReduceMotion = source === 'system';
  const onExited = jest.fn(), onConfirm = jest.fn(), onClose = jest.fn();
  const popup = visible => <SignOutConfirmationModal visible={visible} reduceMotion={source === 'app'}
    onConfirm={onConfirm} onClose={onClose} onExited={onExited} />;
  await act(async () => { tree = TestRenderer.create(popup(true)); });
  await press('Cancelar'); expect(onClose).toHaveBeenCalledTimes(1); expect(onConfirm).not.toHaveBeenCalled();
  await act(async () => tree.update(popup(false)));
  expect(tree.toJSON()).toBeNull(); expect(onExited).toHaveBeenCalledTimes(1); expect(animations).toHaveLength(0);
});
afterEach(async () => {
  if (tree) await act(async () => tree.unmount());
  tree = null; jest.restoreAllMocks();
});

test('overlay mounts before entering, composites overlap at intermediate alpha and retains its content until exit finishes', async () => {
  const popup = (visible, message) => <AnimatedOverlay visible={visible}>
    {message ? <View style={{ backgroundColor: '#FFFFFF', borderRadius: 20, elevation: 16 }}><Text>{message}</Text></View> : null}
  </AnimatedOverlay>;
  await act(async () => { tree = TestRenderer.create(popup(false, null)); });
  expect(tree.toJSON()).toBeNull();
  expect(animations).toHaveLength(0);
  await act(async () => tree.update(popup(true, 'Excluir pergunta?')));
  const entry = animations.at(-1);
  expect(entry.mountedAtStart).not.toBeNull();
  for (const progress of [0.1, 0.5, 0.9]) {
    await act(async () => entry.value.setValue(progress));
    expect(layers()).toHaveLength(1);
    const alpha = StyleSheet.flatten(tree.root.findByType(Animated.View).props.style).opacity;
    expect(alpha.__getValue ? alpha.__getValue() : alpha).toBe(progress);
    expect(layers()[0].props.renderToHardwareTextureAndroid).toBe(true);
  }
  await finish(entry);
  expect(layers()[0].props.renderToHardwareTextureAndroid).toBe(false);
  await act(async () => tree.update(popup(false, null)));
  expect(hasText('Excluir pergunta?')).toBe(true);
  expect(layers()[0].props.pointerEvents).toBe('none');
  expect(layers()[0].props.renderToHardwareTextureAndroid).toBe(true);
  expect(layers()[0].props.importantForAccessibility).toBe('no-hide-descendants');
  expect(animations.at(-1).config.toValue).toBe(0);
  await finish(animations.at(-1));
  expect(tree.toJSON()).toBeNull();
});

test('an interrupted close cannot remove a reopened overlay even if its old completion arrives late', async () => {
  const popup = visible => <AnimatedOverlay visible={visible}><Text>Confirmar</Text></AnimatedOverlay>;
  await act(async () => { tree = TestRenderer.create(popup(true)); });
  await finish(animations.at(-1));
  await act(async () => tree.update(popup(false)));
  const oldExit = animations.at(-1);
  await act(async () => tree.update(popup(true)));
  const reopenedEntry = animations.at(-1);
  expect(oldExit.stop).toHaveBeenCalled();
  await finish(oldExit);
  expect(hasText('Confirmar')).toBe(true);
  expect(layers()[0].props.renderToHardwareTextureAndroid).toBe(true);
  await finish(reopenedEntry);
  expect(hasText('Confirmar')).toBe(true);
  expect(layers()[0].props.renderToHardwareTextureAndroid).toBe(false);
});

test.each(['app', 'system'])('reduced motion from %s opens and closes immediately without leaving an overlay', async source => {
  mockSystemReduceMotion = source === 'system';
  const popup = visible => <AnimatedOverlay visible={visible} reduceMotion={source === 'app'}><Text>Confirmar</Text></AnimatedOverlay>;
  await act(async () => { tree = TestRenderer.create(popup(true)); });
  expect(hasText('Confirmar')).toBe(true);
  expect(animations).toHaveLength(0);
  expect(layers()[0].props.renderToHardwareTextureAndroid).toBe(false);
  await act(async () => tree.update(popup(false)));
  expect(tree.toJSON()).toBeNull();
});

test.each(['Cancelar', 'voltar', 'Excluir'])('question deletion popup keeps its composition through %s and fully unmounts after exit', async action => {
  const deleteQuestion = jest.fn();
  function Questions() {
    const [questions, setQuestions] = useState([{ id: 'q1', question: 'Dúvida de teste', createdAt: '29/10/2026' }]);
    return <MaisScreens activeSubscreen="sub-faq" doubtsView="list" doubts={questions}
      accessibility={{ reduceMotion: false, fontScale: 1 }}
      onDeleteDoubt={async item => { deleteQuestion(item); setQuestions([]); }} />;
  }
  await act(async () => { tree = TestRenderer.create(<Questions />); });
  await press('Excluir');
  expect(hasText('Excluir pergunta?')).toBe(true);
  expect(layers()).toHaveLength(1);
  await finish(animations.at(-1));
  if (action === 'voltar') {
    await act(async () => expect(backCallbacks.at(-1)()).toBe(true));
  } else {
    // Pick the action from inside the popup, instead of the card below it.
    const button = layers()[0].findAll(node => node.props.onPress &&
      node.findAllByType(Text).some(text => text.props.children === action))[0];
    await act(async () => button.props.onPress());
  }
  expect(hasText('Excluir pergunta?')).toBe(true);
  expect(layers()).toHaveLength(1);
  expect(deleteQuestion).toHaveBeenCalledTimes(action === 'Excluir' ? 1 : 0);
  if (action === 'Excluir') expect(hasText('Nenhuma dúvida registrada')).toBe(true);
  const exit = animations.at(-1);
  expect(exit.config.toValue).toBe(0);
  await act(async () => exit.value.setValue(0.5));
  expect(layers()[0].props.needsOffscreenAlphaCompositing).toBe(true);
  await finish(exit);
  expect(hasText('Excluir pergunta?')).toBe(false);
  expect(layers()).toHaveLength(0);
});

const record = { id: 'r1', victimKey: 'aves', title: 'Aves', city: 'Belém', date: '29/10/2026', status: 'synced', details: {} };
test('record cancellation popup stays composited while Android back closes its exit over the retained record', async () => {
  await act(async () => { tree = TestRenderer.create(<RecordDetailsModal visible record={record} canEdit onClose={jest.fn()} />); });
  await layoutRecordDetails(tree);
  await finish(animations.at(-1));
  await press('Cancelar ocorrência');
  expect(hasText('Cancelar ocorrência?')).toBe(true);
  expect(layers()).toHaveLength(2);
  await finish(animations.at(-1));
  await act(async () => expect(backCallbacks.at(-1)()).toBe(true));
  expect(layers()).toHaveLength(2);
  expect(hasText('Detalhes do registro')).toBe(true);
  await finish(animations.at(-1));
  expect(hasText('Cancelar ocorrência?')).toBe(false);
  expect(layers()).toHaveLength(1);
});

test('month and year popup menus keep their own alpha layer through closing', async () => {
  await act(async () => { tree = TestRenderer.create(<AppCalendarModal visible selectedIsoDate="2026-10-29" onClose={jest.fn()} />); });
  await finish(animations.at(-1));
  await layoutCalendar(tree);
  for (const label of ['Selecionar mês', 'Selecionar ano']) {
    const toggle = () => tree.root.findAll(node => node.props.accessibilityLabel === label && node.props.onPress)[0].props.onPress();
    await act(async () => toggle());
    expect(layers()).toHaveLength(2);
    await finish(animations.at(-1));
    await act(async () => toggle());
    expect(layers()).toHaveLength(2);
    await finish(animations.at(-1));
    expect(layers()).toHaveLength(1);
  }
});

test.each([
  ['calendário', AppCalendarModal, { selectedIsoDate: '2026-10-29' }],
  ['seleção', BottomSheetModal, { title: 'Município', options: [{ value: 'all', label: 'Todos' }] }],
  ['orientações', HowToModal, {}],
  ['detalhes', RecordDetailsModal, { record }],
  ['notificações', RecordNotificationsModal, { records: [] }],
  ['responsável', ReporterModal, { currentName: 'Ana' }],
  ['informações', ThemedInfoModal, { title: 'Ajuda', message: 'Orientação' }],
  ['confirmação de saída', SignOutConfirmationModal, { onConfirm: jest.fn() }],
])('%s popup uses grouped alpha during both entry and exit', async (_, Component, props) => {
  const popup = visible => <Component {...props} visible={visible} onClose={jest.fn()} />;
  await act(async () => { tree = TestRenderer.create(popup(false)); });
  await act(async () => tree.update(popup(true)));
  if (Component === RecordDetailsModal) await layoutRecordDetails(tree);
  expect(layers().length).toBeGreaterThan(0);
  expect(layers()[0].props.renderToHardwareTextureAndroid).toBe(true);
  await finish(animations.at(-1));
  expect(layers()[0].props.renderToHardwareTextureAndroid).toBe(false);
  await act(async () => tree.update(popup(false)));
  expect(layers().length).toBeGreaterThan(0);
  expect(layers()[0].props.renderToHardwareTextureAndroid).toBe(true);
  await finish(animations.at(-1));
  expect(tree.toJSON()).toBeNull();
});

test.each([
  ['calendário', AppCalendarModal, { selectedIsoDate: '2026-10-29' }],
  ['seleção', BottomSheetModal, { title: 'Município', options: [{ value: 'all', label: 'Todos' }] }],
  ['orientações', HowToModal, {}],
  ['detalhes', RecordDetailsModal, { record }],
  ['notificações', RecordNotificationsModal, { records: [] }],
  ['responsável', ReporterModal, { currentName: 'Ana' }],
  ['informações', ThemedInfoModal, { title: 'Ajuda', message: 'Orientação' }],
  ['confirmação de saída', SignOutConfirmationModal, { onConfirm: jest.fn() }],
])('%s reopening cancels its old exit and keeps composition until the new entry finishes', async (_, Component, props) => {
  const popup = visible => <Component {...props} visible={visible} onClose={jest.fn()} />;
  await act(async () => { tree = TestRenderer.create(popup(true)); });
  if (Component === RecordDetailsModal) await layoutRecordDetails(tree);
  await finish(animations.at(-1));
  await act(async () => tree.update(popup(false)));
  const oldExit = animations.at(-1);
  await act(async () => tree.update(popup(true)));
  const entry = animations.at(-1);
  expect(oldExit.stop).toHaveBeenCalled();
  await finish(oldExit);
  expect(tree.toJSON()).not.toBeNull();
  expect(layers()[0].props.renderToHardwareTextureAndroid).toBe(true);
  await finish(entry);
  expect(layers()[0].props.renderToHardwareTextureAndroid).toBe(false);
});
