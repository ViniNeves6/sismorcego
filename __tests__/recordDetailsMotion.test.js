import React, { useState } from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { BackHandler, StyleSheet, Text, View } from 'react-native';
import { Animated } from '../src/ui/AccessibleNative';
import RecordDetailsModal from '../src/ui/RecordDetailsModal';
import { layoutRecordDetails } from './helpers/layoutRecordDetails';

let mockSystemReduceMotion = false;
jest.mock('../src/ui/useReduceMotion', () => () => mockSystemReduceMotion);
jest.mock('../src/services/redesignData', () => ({}));
jest.mock('../src/services/deviceCapture', () => ({ pickRegistroPhoto: jest.fn(), captureGpsLocation: jest.fn() }));
jest.mock('../src/services/geocoding', () => ({ reverseGeocodeMunicipio: jest.fn() }));
jest.mock('../src/ui/GpsMapPreview', () => 'GpsMapPreview');
jest.mock('../src/ui/RecordAuditTrail', () => 'RecordAuditTrail');
jest.mock('react-native-svg', () => ({ __esModule: true, default: 'Svg', Path: 'Path', Circle: 'Circle', Rect: 'Rect', Line: 'Line', Polyline: 'Polyline' }));
const record = { id: 'r1', victimKey: 'aves', title: 'Aves', city: 'Belém', date: '29/10/2026', status: 'synced', details: {} };
let tree, animations, back, onExited, onClose;
const native = testID => tree.root.findAllByProps({ testID }).find(node => node.type === View);
const valueOf = value => value?.__getValue ? value.__getValue() : value;
const hasText = value => tree.root.findAllByType(Text).some(node => node.props.children === value);
const finish = async (animation = animations.at(-1)) => act(async () => animation.finish());
const press = async label => act(async () => {
  tree.root.findAll(node => node.props.onPress && (node.props.accessibilityLabel === label ||
    (node.findAllByType(Text).length === 1 && node.findAllByType(Text)[0].props.children === label)))[0].props.onPress();
});
const render = (visible, extra = {}) => <RecordDetailsModal record={record} visible={visible} canEdit onClose={onClose} onExited={onExited} {...extra} />;
beforeEach(() => {
  mockSystemReduceMotion = false; animations = []; onClose = jest.fn(); onExited = jest.fn();
  jest.spyOn(BackHandler, 'addEventListener').mockImplementation((_, callback) => { back = callback; return { remove: jest.fn() }; });
  jest.spyOn(Animated, 'timing').mockImplementation((value, config) => {
    let completion;
    const animation = { value, config, stop: jest.fn(),
      start: callback => {
        completion = callback;
        animation.alphaAtStart = value.__getValue();
        animation.layerAtStart = tree && native('record-details-overlay')?.props.renderToHardwareTextureAndroid;
        animations.push(animation);
      },
      finish: () => { value.setValue(config.toValue); completion?.({ finished: true }); },
    };
    return animation;
  });
});
afterEach(async () => { if (tree) await act(async () => tree.unmount()); tree = null; jest.restoreAllMocks(); });

test('opening waits for native layout, starts transparent and smoothly settles without overshoot', async () => {
  await act(async () => { tree = TestRenderer.create(render(false)); });
  expect(tree.toJSON()).toBeNull();
  expect(animations).toHaveLength(0); expect(onExited).not.toHaveBeenCalled();
  await act(async () => tree.update(render(true)));
  expect(valueOf(StyleSheet.flatten(native('record-details-overlay').props.style).opacity)).toBe(0);
  expect(animations).toHaveLength(0);
  await layoutRecordDetails(tree);
  const entry = animations.at(-1);
  expect(entry.config).toMatchObject({ duration: 320, toValue: 1, useNativeDriver: true });
  expect(entry.alphaAtStart).toBe(0); expect(entry.layerAtStart).toBe(true);
  let previousY = 25, previousScale = 0.98;
  for (const time of [0, 0.1, 0.3, 0.5, 0.8, 1]) {
    const progress = entry.config.easing(time);
    await act(async () => entry.value.setValue(progress));
    const transform = StyleSheet.flatten(native('record-details-dialog').props.style).transform;
    const y = valueOf(transform[0].translateY), scale = valueOf(transform[1].scale);
    expect(y).toBeGreaterThanOrEqual(0); expect(y).toBeLessThanOrEqual(previousY);
    expect(scale).toBeGreaterThanOrEqual(previousScale); expect(scale).toBeLessThanOrEqual(1);
    previousY = y; previousScale = scale;
  }
  await finish(entry);
  expect(native('record-details-overlay').props.renderToHardwareTextureAndroid).toBe(false);
});

test('first mount while already visible also starts at zero and waits for layout', async () => {
  await act(async () => { tree = TestRenderer.create(render(true)); });
  expect(valueOf(StyleSheet.flatten(native('record-details-overlay').props.style).opacity)).toBe(0);
  expect(animations).toHaveLength(0);
  await layoutRecordDetails(tree); await finish();
});

test.each(['Fechar detalhes do registro', 'Fechar detalhes pelo fundo', 'voltar'])('%s keeps the record mounted after the parent clears it until exit completes', async action => {
  function Host() {
    const [visible, setVisible] = useState(true);
    return render(visible, { record: visible ? record : null, onClose: () => { onClose(); setVisible(false); } });
  }
  await act(async () => { tree = TestRenderer.create(<Host />); });
  await layoutRecordDetails(tree); await finish();
  if (action === 'voltar') await act(async () => expect(back()).toBe(true));
  else await press(action);
  expect(onClose).toHaveBeenCalledTimes(1);
  expect(hasText('Belém')).toBe(true);
  expect(native('record-details-overlay').props.pointerEvents).toBe('none');
  expect(animations.at(-1).config).toMatchObject({ toValue: 0, duration: 220, useNativeDriver: true });
  expect(onExited).not.toHaveBeenCalled();
  await finish();
  expect(tree.toJSON()).toBeNull(); expect(onExited).toHaveBeenCalledTimes(1);
});

test('reopening during exit continues from the current alpha and rejects a late exit completion', async () => {
  await act(async () => { tree = TestRenderer.create(render(true)); });
  await layoutRecordDetails(tree); await finish();
  await act(async () => tree.update(render(false)));
  const exit = animations.at(-1);
  await act(async () => exit.value.setValue(0.4));
  await act(async () => tree.update(render(true)));
  expect(exit.stop).toHaveBeenCalled();
  const entry = animations.at(-1);
  expect(entry.alphaAtStart).toBe(0.4);
  await finish(exit);
  expect(hasText('Detalhes do registro')).toBe(true); expect(onExited).not.toHaveBeenCalled();
  await finish(entry);
});

test.each(['app', 'system'])('%s reduced motion opens and closes without waiting for layout or running animation', async source => {
  mockSystemReduceMotion = source === 'system';
  const extra = { reduceMotion: source === 'app' };
  await act(async () => { tree = TestRenderer.create(render(true, extra)); });
  expect(hasText('Detalhes do registro')).toBe(true);
  expect(native('record-details-overlay').props.renderToHardwareTextureAndroid).toBe(false);
  await act(async () => tree.update(render(false, extra)));
  expect(tree.toJSON()).toBeNull(); expect(animations).toHaveLength(0);
  expect(onExited).toHaveBeenCalledTimes(1);
});

test('enabling reduced motion during entry finishes the current opening without resetting the form', async () => {
  await act(async () => { tree = TestRenderer.create(render(true)); });
  await layoutRecordDetails(tree);
  const entry = animations.at(-1);
  mockSystemReduceMotion = true;
  await act(async () => tree.update(render(true)));
  expect(entry.stop).toHaveBeenCalled();
  expect(valueOf(StyleSheet.flatten(native('record-details-overlay').props.style).opacity)).toBe(1);
  expect(hasText('Belém')).toBe(true);
});

test.each(['Cancelar', 'voltar'])('%s in edit mode retains the previous mode until its fade finishes', async action => {
  await act(async () => { tree = TestRenderer.create(render(true)); });
  await layoutRecordDetails(tree); await finish();
  await press('Editar');
  expect(hasText('Detalhes do registro')).toBe(true);
  await finish(); expect(hasText('Modificar registro')).toBe(true);
  await finish();
  if (action === 'voltar') await act(async () => expect(back()).toBe(true));
  else await press(action);
  expect(hasText('Modificar registro')).toBe(true);
  await finish(); expect(hasText('Detalhes do registro')).toBe(true);
  await finish(); expect(onClose).not.toHaveBeenCalled();
});

test('closing before first layout cancels the invisible opening without leaving an overlay', async () => {
  await act(async () => { tree = TestRenderer.create(render(true)); });
  await act(async () => tree.update(render(false)));
  expect(tree.toJSON()).toBeNull(); expect(animations).toHaveLength(0);
  expect(onExited).toHaveBeenCalledTimes(1);
});

test('closing during the edit-mode fade cancels it and prevents a late callback from reopening content', async () => {
  await act(async () => { tree = TestRenderer.create(render(true)); });
  await layoutRecordDetails(tree); await finish();
  await press('Editar');
  const modeExit = animations.at(-1);
  await act(async () => tree.update(render(false)));
  const exit = animations.at(-1), count = animations.length;
  expect(modeExit.stop).toHaveBeenCalled();
  await finish(modeExit);
  expect(animations).toHaveLength(count);
  expect(hasText('Modificar registro')).toBe(false);
  await finish(exit);
  expect(tree.toJSON()).toBeNull(); expect(onExited).toHaveBeenCalledTimes(1);
});
