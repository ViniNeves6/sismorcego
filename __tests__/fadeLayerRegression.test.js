import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { Animated, StyleSheet, Text, View } from 'react-native';
import useFadeCompositing from '../src/ui/useFadeCompositing';
import AnimatedScreenTransition from '../src/ui/AnimatedScreenTransition';
import RegistrosScreen from '../src/pages/Main/RegistrosScreen';
import AdminAlertsScreen from '../src/pages/Admin/AdminAlertsScreen';

jest.mock('../src/ui/useReduceMotion', () => () => false);
jest.mock('react-native-linear-gradient', () => 'LinearGradient');
jest.mock('react-native-svg', () => ({ __esModule: true, default: 'Svg', Path: 'Path', Circle: 'Circle', Rect: 'Rect', Line: 'Line', Polyline: 'Polyline' }));
let tree;
afterEach(async () => { if (tree) await act(async () => tree.unmount()); tree = null; });

const layer = () => tree.root.findByType(View);
function Layer({ progress, target, reduceMotion, revision }) {
  const props = useFadeCompositing(progress, target, reduceMotion, revision);
  return <View {...props}><Text>Conteúdo</Text></View>;
}

test('hardware composition is prepared before each transition and released only at its endpoint', async () => {
  const progress = new Animated.Value(0);
  const render = (target, revision = target) => <Layer progress={progress} target={target} revision={revision} />;
  await act(async () => { tree = TestRenderer.create(render(1)); });
  expect(layer().props.renderToHardwareTextureAndroid).toBe(true);
  await act(async () => progress.setValue(0.5));
  expect(layer().props.renderToHardwareTextureAndroid).toBe(true);
  await act(async () => progress.setValue(1));
  expect(layer().props.renderToHardwareTextureAndroid).toBe(false);
  await act(async () => tree.update(render(0)));
  expect(layer().props.renderToHardwareTextureAndroid).toBe(true);
  await act(async () => progress.setValue(0.5));
  expect(layer().props.renderToHardwareTextureAndroid).toBe(true);
  await act(async () => progress.setValue(0));
  expect(layer().props.renderToHardwareTextureAndroid).toBe(false);
});

test('a stale completion cannot release the texture while a reversed fade is still running', async () => {
  const progress = new Animated.Value(1);
  const render = target => <Layer progress={progress} target={target} />;
  await act(async () => { tree = TestRenderer.create(render(0)); });
  await act(async () => progress.setValue(0.5));
  await act(async () => tree.update(render(1)));
  await act(async () => progress.setValue(0));
  expect(layer().props.renderToHardwareTextureAndroid).toBe(true);
  await act(async () => progress.setValue(1));
  expect(layer().props.renderToHardwareTextureAndroid).toBe(false);
});

test('a new revision prepares a layer even when it has the same opacity endpoint', async () => {
  const progress = new Animated.Value(0);
  await act(async () => { tree = TestRenderer.create(<Layer progress={progress} target={1} revision="details" />); });
  await act(async () => progress.setValue(1));
  expect(layer().props.renderToHardwareTextureAndroid).toBe(false);
  await act(async () => tree.update(<Layer progress={progress} target={1} revision="edit" />));
  expect(layer().props.renderToHardwareTextureAndroid).toBe(true);
  await act(async () => progress.setValue(1));
  expect(layer().props.renderToHardwareTextureAndroid).toBe(false);
});

test('reduced motion releases an active texture and unmount removes its native value listener', async () => {
  const progress = new Animated.Value(0);
  const remove = jest.spyOn(progress, 'removeListener');
  await act(async () => { tree = TestRenderer.create(<Layer progress={progress} target={1} />); });
  await act(async () => tree.update(<Layer progress={progress} target={1} reduceMotion />));
  expect(layer().props.renderToHardwareTextureAndroid).toBe(false);
  expect(remove).toHaveBeenCalledTimes(1);
  await act(async () => tree.update(<Layer progress={progress} target={1} reduceMotion={false} />));
  expect(layer().props.renderToHardwareTextureAndroid).toBe(false);
  await act(async () => tree.unmount()); tree = null;
  await act(async () => progress.setValue(1));
});

test.each([
  ['records', RegistrosScreen, { records: [{ id: 'r1', title: 'Aves', victimKey: 'aves', city: 'Belém', status: 'synced' }] }, 'record-card-r1'],
  ['alerts', AdminAlertsScreen, { alerts: [{ id: 'a1', title: 'Aves', city: 'Belém', lida: false }] }, 'alert-card-a1'],
])('%s cards stay fully opaque underneath the screen fade and have no individual scale or slide', async (key, Component, props, testID) => {
  await act(async () => { tree = TestRenderer.create(<AnimatedScreenTransition screenKey={key}><Component {...props} /></AnimatedScreenTransition>); });
  const card = tree.root.findAllByProps({ testID }).find(candidate => candidate.type === View);
  expect(card).toBeDefined();
  for (let ancestor = card; ancestor && ancestor.type !== AnimatedScreenTransition; ancestor = ancestor.parent) {
    const style = StyleSheet.flatten(ancestor.props.style) || {};
    expect(style.opacity === undefined || style.opacity === 1).toBe(true);
    expect(style.transform).toBeUndefined();
  }
});
