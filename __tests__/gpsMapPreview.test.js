import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { Linking } from 'react-native';
import { Animated } from '../src/ui/AccessibleNative';
import GpsMapPreview from '../src/ui/GpsMapPreview';

jest.mock('react-native-maps', () => ({ __esModule: true, default: 'MapView', Marker: 'Marker' }));
jest.mock('../src/ui/useReduceMotion', () => () => false);
jest.mock('react-native-svg', () => ({ __esModule: true, default: 'Svg', Path: 'Path', Circle: 'Circle', Rect: 'Rect', Line: 'Line', Polyline: 'Polyline' }));
jest.mock('../src/ui/AccessibleNative', () => {
  const actual = jest.requireActual('../src/ui/AccessibleNative');
  return { ...actual, Animated: { ...actual.Animated, timing: jest.fn() } };
});

let tree;
let animations;
const point = { lat: -1.234567891, lng: -48.123456789 };
const render = async props => act(async () => { tree = TestRenderer.create(<GpsMapPreview {...props} />); });
const layout = async () => act(async () => {
  const canvas = tree.root.findAll(node => typeof node.props.onLayout === 'function')[0];
  canvas.props.onLayout({ nativeEvent: { layout: { width: 300, height: 166 } } });
});
const finish = async () => act(async () => { animations.at(-1).finish(); });

beforeEach(() => {
  animations = [];
  Animated.timing.mockImplementation((value, config) => {
    let done = false;
    let callback;
    const animation = {
      start: complete => { callback = complete; animations.push(animation); },
      stop: () => { if (!done) { done = true; callback?.({ finished: false }); } },
      finish: () => {
        if (!done) { done = true; value.setValue(config.toValue); callback?.({ finished: true }); }
      },
    };
    return animation;
  });
});
afterEach(async () => {
  if (tree) await act(async () => tree.unmount());
  tree = null;
  jest.restoreAllMocks();
});

test.each([[undefined, undefined], [NaN, -48], [91, -48], [-1, 181]])('no native map is created for invalid capture %s / %s', async (lat, lng) => {
  await render({ visible: true, lat, lng });
  expect(tree.toJSON()).toBeNull();
});

test('native map waits for layout, uses captured coordinates and disables the crashing native loading indicator', async () => {
  await render({ visible: true, ...point });
  expect(tree.root.findAllByType('MapView')).toHaveLength(0);
  await layout();
  const map = tree.root.findByType('MapView');
  expect(map.props.loadingEnabled).toBe(false);
  expect(map.props.region).toMatchObject({ latitude: point.lat, longitude: point.lng });
  expect(tree.root.findByType('Marker').props.coordinate).toEqual({ latitude: point.lat, longitude: point.lng });
  await act(async () => tree.update(<GpsMapPreview visible lat={-2.5} lng={-47.5} />));
  expect(tree.root.findByType('MapView')).toBe(map);
  expect(map.props.region).toMatchObject({ latitude: -2.5, longitude: -47.5 });
});

test('removing GPS retains the map through exit, then destroys it instead of keeping a hidden map mounted', async () => {
  await render({ visible: true, ...point });
  await layout();
  await finish();
  await act(async () => tree.update(<GpsMapPreview visible={false} />));
  expect(tree.root.findAllByType('MapView')).toHaveLength(1);
  await finish();
  expect(tree.toJSON()).toBeNull();
  await act(async () => tree.update(<GpsMapPreview visible {...point} />));
  await layout();
  expect(tree.root.findByType('Marker').props.coordinate.latitude).toBe(point.lat);
});

test('the full-map link uses captured coordinates, and reduced motion closes immediately', async () => {
  jest.spyOn(Linking, 'openURL').mockResolvedValue();
  await render({ visible: true, ...point, reduceMotion: true });
  await layout();
  const link = tree.root.findAll(node => typeof node.props.onPress === 'function')[0];
  await act(async () => link.props.onPress());
  expect(Linking.openURL).toHaveBeenCalledWith(expect.stringContaining('mlat=-1.234568&mlon=-48.123457'));
  await act(async () => tree.update(<GpsMapPreview visible={false} reduceMotion />));
  expect(tree.toJSON()).toBeNull();
});
