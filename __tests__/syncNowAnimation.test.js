import React from 'react';
import ReactTestRenderer, { act } from 'react-test-renderer';
import { Animated, StyleSheet, Text as RNText } from 'react-native';
import SyncNowButton from '../src/ui/SyncNowButton';

let mockSystemReduceMotion = false;
jest.mock('../src/ui/useReduceMotion', () => () => mockSystemReduceMotion);
jest.mock('react-native-linear-gradient', () => 'LinearGradient');
jest.mock('react-native-svg', () => ({
  __esModule: true, default: 'Svg', Path: 'Path', Circle: 'Circle', Rect: 'Rect', Line: 'Line', Polyline: 'Polyline',
}));

let tree, props, animations, loops;
const node = testID => tree.root.findAllByProps({ testID })[0];
const style = testID => StyleSheet.flatten(node(testID).props.style);
const value = animated => animated?.__getValue ? animated.__getValue() : animated;
const button = () => tree.root.findAll(n => typeof n.props.onPress === 'function')[0];
const render = async (next = {}) => {
  props = { onSyncNow: jest.fn(), ...next };
  await act(async () => { tree = ReactTestRenderer.create(<SyncNowButton {...props} />); });
};
const update = async next => {
  props = { ...props, ...next };
  await act(async () => tree.update(<SyncNowButton {...props} />));
};
const press = async () => act(async () => button().props.onPress());
const finish = async animation => act(async () => animation.finish());
const spin = () => animations.filter(animation => [2290, 2200].includes(animation.config.duration)).at(-1);
const sampleEntry = async time => act(async () => {
  animations.filter(animation => animation.started).forEach(animation => animation.sample(time));
});

beforeEach(() => {
  jest.spyOn(require('react-native'), 'useWindowDimensions').mockReturnValue({ width: 393, height: 852, scale: 3, fontScale: 1 });
  jest.useFakeTimers();
  mockSystemReduceMotion = false;
  animations = [];
  loops = [];
  jest.spyOn(Animated, 'timing').mockImplementation((animatedValue, config) => {
    let complete, from;
    const animation = {
      config, animatedValue, started: false,
      start(callback) { complete = callback; from = animatedValue.__getValue(); animation.started = true; },
      stop: jest.fn(),
      sample(time) {
        const progress = Math.min(1, time / config.duration);
        animatedValue.setValue(from + (config.toValue - from) * config.easing(progress));
      },
      finish() { animatedValue.setValue(config.toValue); complete?.({ finished: true }); },
    };
    animations.push(animation);
    return animation;
  });
  jest.spyOn(Animated, 'loop').mockImplementation(animation => {
    const loop = { animation, start: jest.fn(), stop: jest.fn() };
    loops.push(loop);
    return loop;
  });
});
afterEach(async () => {
  if (tree) await act(async () => tree.unmount());
  tree = null;
  jest.restoreAllMocks();
  jest.useRealTimers();
});

test('idle presents the normal label without starting animation work', async () => {
  await render();
  expect(tree.root.findAllByType(RNText).map(n => n.props.children)).toContain('Sincronizar agora');
  expect(button().props.disabled).toBe(false);
  expect(animations).toHaveLength(0);
});

test('tap queues all native phases before invoking the sync callback in the same event', async () => {
  let scheduledAtSync;
  const onSyncNow = jest.fn(() => {
    scheduledAtSync = {
      spin: spin()?.started,
      timings: animations.filter(animation => animation.started).length,
      loops: loops.filter(loop => loop.start.mock.calls.length === 1).length,
    };
  });
  await render({ onSyncNow });
  await press();
  expect(onSyncNow).toHaveBeenCalledTimes(1);
  expect(scheduledAtSync).toEqual({ spin: true, timings: 6, loops: 2 });
  expect(animations.every(animation => animation.config.useNativeDriver && animation.config.isInteraction === false)).toBe(true);
  expect(animations.every(animation => !animation.config.delay)).toBe(true);
  // The 90 ms pulse precedes label/giro on the native timeline, without a JS timer.
  for (const duration of [370, 390, 450, 470, 2290]) {
    const animation = animations.find(item => item.config.duration === duration);
    expect(animation.config.easing(89 / duration)).toBe(0);
    expect(animation.config.easing(180 / duration)).toBeGreaterThan(0);
  }
});

test('icon and dots close into a centered group without animating layout width', async () => {
  await render();
  await press();
  await sampleEntry(470);
  const label = style('sync-button-label-stage');
  const icon = style('sync-button-icon');
  expect(typeof label.width).toBe('number');
  const iconShift = value(icon.transform[0].translateX);
  const rowWidth = 21 + 10 + label.width;
  const iconCenter = -rowWidth / 2 + 21 / 2 + iconShift;
  const dotsCenter = (21 + 10) / 2;
  expect((iconCenter - 21 / 2 + dotsCenter + 28 / 2) / 2).toBeCloseTo(0);
  expect(value(style('sync-button-text').opacity)).toBe(0);
  expect(value(style('sync-button-dots').opacity)).toBe(1);
  const animationCount = animations.length;
  await act(async () => button().props.onLayout({ nativeEvent: { layout: { width: 390 } } }));
  expect(animations).toHaveLength(animationCount);
  expect(value(style('sync-button-icon').transform[0].translateX)).toBe(iconShift);
});

test('the icon follows the HTML wind-up, half turn and completed turn', async () => {
  await render();
  await press();
  for (const [progress, degrees] of [[0, 0], [0.12, -18], [0.55, 190], [1, 360]]) {
    await act(async () => spin().animatedValue.setValue(progress));
    expect(parseFloat(value(style('sync-button-icon').transform[1].rotate))).toBeCloseTo(degrees);
  }
});

test('a fast sync still completes one HTML spin and retains both labels through the return', async () => {
  await render();
  await press();
  expect(button().props.disabled).toBe(true);
  await finish(spin());
  const bounce = animations.at(-1);
  expect(bounce.config.duration).toBe(450);
  expect(button().props.disabled).toBe(true);
  expect(node('sync-button-text')).toBeDefined();
  expect(node('sync-button-dots')).toBeDefined();
  expect(loops.every(loop => loop.stop.mock.calls.length === 0)).toBe(true);
  await finish(bounce);
  expect(button().props.disabled).toBe(false);
  expect(button().props.accessibilityLabel).toBe('Sincronizar agora');
  expect(loops.every(loop => loop.stop.mock.calls.length > 0)).toBe(true);
  expect(value(style('sync-button-icon').transform[0].translateX)).toBe(0);
});

test('a slow request stays busy over additional native turns until the real promise settles', async () => {
  let resolve;
  await render({ onSyncNow: jest.fn(() => new Promise(done => { resolve = done; })) });
  await press();
  await finish(spin());
  expect(spin().config.duration).toBe(2200);
  expect(button().props.disabled).toBe(true);
  expect(props.onSyncNow).toHaveBeenCalledTimes(1);
  await act(async () => resolve());
  await finish(spin());
  await finish(animations.at(-1));
  expect(button().props.disabled).toBe(false);
});

test('background sync animates without dispatching another request and exits after it ends', async () => {
  await render({ syncing: true });
  expect(spin().config.duration).toBe(2200);
  expect(animations.some(animation => animation.config.duration === 440)).toBe(false);
  await finish(spin());
  expect(button().props.disabled).toBe(true);
  await update({ syncing: false });
  await finish(spin());
  await finish(animations.at(-1));
  expect(button().props.disabled).toBe(false);
  expect(props.onSyncNow).not.toHaveBeenCalled();
});

test('a new sync during the return cancels the old finish without unlocking the active button', async () => {
  await render({ syncing: true });
  await update({ syncing: false });
  await finish(spin());
  const oldFinish = animations.at(-1);
  await update({ syncing: true });
  expect(oldFinish.stop).toHaveBeenCalled();
  const count = animations.length;
  await finish(oldFinish);
  expect(button().props.disabled).toBe(true);
  expect(animations).toHaveLength(count);
  await update({ syncing: false });
  await finish(spin());
  await finish(animations.at(-1));
  expect(button().props.disabled).toBe(false);
});

test('repeated taps in one event cannot dispatch duplicate sync requests', async () => {
  await render();
  const tap = button().props.onPress;
  await act(async () => { tap(); tap(); tap(); });
  expect(props.onSyncNow).toHaveBeenCalledTimes(1);
  expect(loops).toHaveLength(2);
});

test.each(['throw', 'reject'])('a callback that fails with %s still releases the visual lock', async failure => {
  const onSyncNow = jest.fn(() => {
    if (failure === 'throw') throw new Error('Offline');
    return Promise.reject(new Error('Offline'));
  });
  await render({ onSyncNow });
  await press();
  await finish(spin());
  await finish(animations.at(-1));
  expect(button().props.disabled).toBe(false);
  await press();
  expect(onSyncNow).toHaveBeenCalledTimes(2);
});

test.each(['application', 'system'])('reduced motion from %s uses a static busy label and no animation', async source => {
  mockSystemReduceMotion = source === 'system';
  await render({ syncing: true, reduceMotion: source === 'application' });
  expect(tree.root.findAllByType(RNText).map(n => n.props.children)).toContain('Sincronizando...');
  expect(button().props.disabled).toBe(true);
  expect(animations).toHaveLength(0);
  await update({ syncing: false });
  expect(button().props.disabled).toBe(false);
});

test('a manual request with reduced motion stays busy until its actual promise settles', async () => {
  let resolve;
  await render({ reduceMotion: true, onSyncNow: jest.fn(() => new Promise(done => { resolve = done; })) });
  await press();
  expect(button().props.disabled).toBe(true);
  expect(animations).toHaveLength(0);
  await act(async () => resolve());
  expect(button().props.disabled).toBe(false);
});

test('changing motion preferences cancels old phases and late callbacks cannot restart them', async () => {
  await render();
  await press();
  const oldSpin = spin();
  await update({ reduceMotion: true });
  expect(oldSpin.stop).toHaveBeenCalled();
  const count = animations.length;
  await finish(oldSpin);
  expect(animations).toHaveLength(count);
  await update({ reduceMotion: false });
  expect(button().props.disabled).toBe(false);
  await press();
  expect(props.onSyncNow).toHaveBeenCalledTimes(2);
});

test('restoring motion during a pending static request starts the visual cycle and can finish normally', async () => {
  let resolve;
  await render({ reduceMotion: true, onSyncNow: jest.fn(() => new Promise(done => { resolve = done; })) });
  await press();
  await update({ reduceMotion: false });
  expect(spin().config.duration).toBe(2200);
  await act(async () => resolve());
  await finish(spin());
  await finish(animations.at(-1));
  expect(button().props.disabled).toBe(false);
});

test('leaving cancels all visual work and late native callbacks cannot start more animations', async () => {
  let resolve;
  await render({ onSyncNow: jest.fn(() => new Promise(done => { resolve = done; })) });
  await press();
  const pending = animations.filter(animation => animation.started);
  const count = animations.length;
  await act(async () => tree.unmount());
  tree = null;
  expect(pending.every(animation => animation.stop.mock.calls.length > 0)).toBe(true);
  expect(loops.every(loop => loop.stop.mock.calls.length > 0)).toBe(true);
  await act(async () => resolve());
  await act(async () => pending.forEach(animation => animation.finish()));
  await act(async () => { await jest.advanceTimersByTimeAsync(3000); });
  expect(animations).toHaveLength(count);
});

test('a disabled button cannot start native work or a request', async () => {
  await render({ disabled: true });
  await press();
  expect(props.onSyncNow).not.toHaveBeenCalled();
  expect(animations).toHaveLength(0);
});
