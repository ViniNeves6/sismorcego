import React, { useState } from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { ScrollView, TextInput, View } from 'react-native';
import NovaNotificacaoScreen from '../src/pages/Main/NovaNotificacaoScreen';

let mockReducedMotion = false;
jest.mock('../src/ui/useReduceMotion', () => () => mockReducedMotion);
jest.mock('../src/ui/GpsMapPreview', () => () => null);
jest.mock('../src/services/redesignData', () => ({}));
jest.mock('../src/services/deviceCapture', () => ({ captureGpsLocation: jest.fn(), pickRegistroPhoto: jest.fn() }));
jest.mock('react-native-linear-gradient', () => 'LinearGradient');
jest.mock('react-native-svg', () => ({
  __esModule: true, default: 'Svg', Path: 'Path', Circle: 'Circle', Rect: 'Rect', Line: 'Line', Polyline: 'Polyline',
}));

let tree;
let sheet;
let closeSheet;
let offset;
let measurements;
let deferredMeasurement;
let delayedKey;
let positions;

function Form({ active = 'humano', reduceMotion = true, initial = {} }) {
  const [victimData, setVictimData] = useState({ humano: {}, canino: {}, aves: {}, producao: {}, ...initial });
  const [openField, setOpenField] = useState(null);
  closeSheet = () => setOpenField(null);
  return <NovaNotificacaoScreen
    activeVictimSubscreen={active} selectedVictimKey={active} setActiveVictimSubscreen={jest.fn()}
    victimData={victimData} setVictimData={setVictimData} victimSaved={{}} setVictimSaved={jest.fn()}
    setSelectedVictimKey={jest.fn()} reporterName="Ana" city="" community=""
    reduceMotion={reduceMotion} activeSheetFieldKey={openField}
    onOpenBottomSheet={config => { sheet = config; setOpenField(config.id); }}
  />;
}
const nativeField = key => tree.root.findAllByProps({ testID: `victim-field-${key}` }).find(n => n.type === View);
const scroller = () => tree.root.findByType(ScrollView);
const flush = async () => act(async () => { await jest.advanceTimersByTimeAsync(600); });
const choose = async (key, answer) => {
  const trigger = nativeField(key).findAll(n => typeof n.props.onPress === 'function')[0];
  await act(async () => trigger.props.onPress());
  await act(async () => { sheet.onSelect(answer); closeSheet(); });
};
const mount = async props => {
  await act(async () => { tree = TestRenderer.create(<Form {...props} />); });
  await act(async () => scroller().props.onContentSizeChange(360, 2000));
};

beforeEach(() => {
  jest.clearAllMocks();
  jest.useFakeTimers();
  mockReducedMotion = false;
  sheet = null;
  offset = 0;
  delayedKey = null;
  deferredMeasurement = null;
  measurements = [];
  positions = { 'hv-ocupacao': 550, 'hv-atend': 780, 'hv-atend-motivo': 880, 'hv-abrigo': 980 };
  jest.spyOn(View.prototype, 'measureInWindow').mockImplementation(function (callback) {
    if (this.props.testID === 'victim-form-scroll') {
      callback(0, 80, 360, 650);
      return;
    }
    const key = this.props.testID?.replace('victim-field-', '');
    measurements.push(key);
    const reply = () => callback(20, (positions[key] || 650) - offset, 320, 80);
    if (key === delayedKey) deferredMeasurement = reply;
    else reply();
  });
  jest.spyOn(ScrollView.prototype, 'scrollTo').mockImplementation(function ({ y }) {
    offset = y;
    this.props.onScroll({ nativeEvent: { contentOffset: { y } } });
  });
});

afterEach(async () => {
  if (tree) await act(async () => tree.unmount());
  tree = null;
  jest.restoreAllMocks();
  jest.useRealTimers();
});

test('typing consumes no opportunity, and consecutive selections each advance to the next visible field', async () => {
  await mount();
  await act(async () => nativeField('hv-nome').findByType(TextInput).props.onChangeText('Maria'));
  await flush();
  expect(ScrollView.prototype.scrollTo).not.toHaveBeenCalled();
  await choose('hv-sexo', 'Masculino');
  await flush();
  expect(measurements.at(-1)).toBe('hv-ocupacao');
  expect(ScrollView.prototype.scrollTo).toHaveBeenLastCalledWith({ y: 70, animated: false });
  await choose('hv-circ', 'Em casa, dormindo');
  await flush();
  expect(measurements.at(-1)).toBe('hv-atend');
  expect(ScrollView.prototype.scrollTo).toHaveBeenCalledTimes(2);
  expect(offset).toBeGreaterThan(70);
});

test('new dependent fields are targeted and hidden dependent fields are skipped', async () => {
  await mount();
  await choose('hv-atend', 'Não');
  await flush();
  expect(measurements.at(-1)).toBe('hv-atend-motivo');
  await choose('hv-atend', 'Sim');
  await flush();
  expect(measurements.at(-1)).toBe('hv-abrigo');
  expect(ScrollView.prototype.scrollTo).toHaveBeenCalledTimes(2);
});

test('shelter description is shown only for Other and clears when its type or parent answer changes', async () => {
  await mount({ initial: { humano: { 'hv-abrigo': 'Sim' } } });
  const descriptionFields = () => tree.root.findAllByProps({ testID: 'victim-field-hv-desc' });
  expect(descriptionFields()).toHaveLength(0);
  for (const type of ['Natural', 'Artificial']) {
    await choose('hv-tipo', type);
    await flush();
    expect(descriptionFields()).toHaveLength(0);
  }
  await choose('hv-tipo', 'Outro');
  await flush();
  await act(async () => nativeField('hv-desc').findByType(TextInput).props.onChangeText('Abrigo descrito pelo agente'));
  expect(tree.root.findByType(NovaNotificacaoScreen).props.victimData.humano['hv-desc']).toBe('Abrigo descrito pelo agente');
  await choose('hv-tipo', 'Artificial');
  await flush();
  expect(descriptionFields()).toHaveLength(0);
  expect(tree.root.findByType(NovaNotificacaoScreen).props.victimData.humano['hv-desc']).toBeUndefined();
  await choose('hv-tipo', 'Outro');
  await flush();
  expect(nativeField('hv-desc').findByType(TextInput).props.value).toBe('');
  await act(async () => nativeField('hv-desc').findByType(TextInput).props.onChangeText('Outra descrição'));
  await choose('hv-abrigo', 'Não');
  await flush();
  expect(descriptionFields()).toHaveLength(0);
  expect(tree.root.findByType(NovaNotificacaoScreen).props.victimData.humano).not.toHaveProperty('hv-tipo');
  expect(tree.root.findByType(NovaNotificacaoScreen).props.victimData.humano).not.toHaveProperty('hv-desc');
});

test.each([
  ['humano', 'hv-circ', 'hv-circ-desc'],
  ['canino', 'cf-circ', 'cf-circ-desc'],
  ['aves', 'av-circ', 'av-circ-desc'],
  ['producao', 'pr-circ', 'pr-circ-desc'],
  ['humano', 'hv-tipo', 'hv-desc', { humano: { 'hv-abrigo': 'Sim' } }],
])('Other reveals the actual description in the %s form', async (active, parent, description, initial = {}) => {
  await mount({ active, initial });
  await choose(parent, 'Outro');
  await flush();
  expect(measurements.at(-1)).toBe(description);
  expect(ScrollView.prototype.scrollTo).toHaveBeenCalledTimes(1);
});

test('a real drag cancels pending assistance and later selections until leaving and returning', async () => {
  await mount();
  await choose('hv-sexo', 'Masculino');
  await act(async () => scroller().props.onScrollBeginDrag());
  await flush();
  await choose('hv-atend', 'Não');
  await flush();
  expect(ScrollView.prototype.scrollTo).not.toHaveBeenCalled();
  await act(async () => tree.update(<Form active={null} />));
  await act(async () => tree.update(<Form active="humano" />));
  await act(async () => scroller().props.onContentSizeChange(360, 2000));
  await choose('hv-atend', 'Sim');
  await flush();
  expect(ScrollView.prototype.scrollTo).toHaveBeenCalledTimes(1);
});

test('a drag arriving during asynchronous native measurement also cancels the advance', async () => {
  await mount();
  delayedKey = 'hv-ocupacao';
  await choose('hv-sexo', 'Masculino');
  await flush();
  expect(deferredMeasurement).toBeDefined();
  await act(async () => scroller().props.onScrollBeginDrag());
  await act(async () => deferredMeasurement());
  expect(ScrollView.prototype.scrollTo).not.toHaveBeenCalled();
});

test('an open selector blocks a pending advance and leaving prevents delayed jumps', async () => {
  await mount();
  await choose('hv-sexo', 'Masculino');
  await act(async () => nativeField('hv-circ').findAll(n => typeof n.props.onPress === 'function')[0].props.onPress());
  await flush();
  expect(ScrollView.prototype.scrollTo).not.toHaveBeenCalled();
  await act(async () => { sheet.onSelect('Outro'); closeSheet(); });
  await act(async () => tree.update(<Form active={null} />));
  await flush();
  expect(ScrollView.prototype.scrollTo).not.toHaveBeenCalled();
});

test('normal motion waits for field/selector transitions and reduced motion advances without animation', async () => {
  await mount({ reduceMotion: false });
  await choose('hv-sexo', 'Masculino');
  await act(async () => { await jest.advanceTimersByTimeAsync(250); });
  expect(ScrollView.prototype.scrollTo).not.toHaveBeenCalled();
  await flush();
  expect(ScrollView.prototype.scrollTo).toHaveBeenLastCalledWith({ y: 70, animated: true });
  mockReducedMotion = true;
  await act(async () => tree.update(<Form reduceMotion={false} />));
  await choose('hv-circ', 'Em casa, dormindo');
  await flush();
  expect(ScrollView.prototype.scrollTo.mock.calls.at(-1)[0].animated).toBe(false);
});

test('a fully scrolled form never overshoots its content or moves upwards', async () => {
  await mount();
  offset = 1350;
  await act(async () => scroller().props.onScroll({ nativeEvent: { contentOffset: { y: offset } } }));
  await choose('hv-sexo', 'Feminino');
  await flush();
  expect(ScrollView.prototype.scrollTo).not.toHaveBeenCalled();
});
