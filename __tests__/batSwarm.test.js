import React from 'react';
import Renderer, { act } from 'react-test-renderer';
import { Image, StyleSheet, View } from 'react-native';
import { cancelAnimation } from 'react-native-reanimated';
import BatSwarm from '../src/navigation/BatSwarm';

let mockReduced = false;
const mockValues = [];
jest.mock('../src/ui/useReduceMotion', () => () => mockReduced);
// Mock only the UI-thread runtime. The production geometry/effects render intact.
jest.mock('react-native-reanimated', () => {
  const ReactRuntime = require('react');
  const native = require('react-native');
  return {
    __esModule: true, default: { View: native.View }, Easing: native.Easing,
    useSharedValue: initial => {
      const ref = ReactRuntime.useRef(null);
      if (!ref.current) {
        ref.current = { value: initial, animation: null, get() { return this.value; },
          set(next) { if (typeof next === 'number') this.value = next; else this.animation = next; } };
        mockValues.push(ref.current);
      }
      return ref.current;
    },
    useAnimatedStyle: callback => callback(),
    withTiming: (toValue, config) => ({ kind: 'timing', toValue, config }),
    withDelay: (delay, animation) => ({ kind: 'delay', delay, animation }),
    withRepeat: (animation, count, reverse) => ({ kind: 'repeat', animation, count, reverse }),
    withSequence: (...animations) => ({ kind: 'sequence', animations }),
    cancelAnimation: jest.fn(),
  };
});
let tree;
const render = async props => act(async () => { tree = Renderer.create(<BatSwarm {...props} />); });
const rerender = async props => act(async () => tree.update(<BatSwarm {...props} />));
const bats = () => tree.root.findAllByType(View).filter(node => Array.isArray(StyleSheet.flatten(node.props.style)?.transform));
beforeEach(() => {
  mockReduced = false; mockValues.length = 0; jest.clearAllMocks();
  jest.spyOn(require('react-native'), 'useWindowDimensions').mockReturnValue({ width: 393, height: 852, scale: 3, fontScale: 1 });
});
afterEach(async () => { if (tree) await act(async () => tree.unmount()); tree = null; jest.restoreAllMocks(); });

test('uses the original 18 varied sprites, delayed diagonal flights and repeating wing beats', async () => {
  await render(); expect(tree.root.findAllByType(Image)).toHaveLength(18); expect(mockValues).toHaveLength(36);
  const sizes = tree.root.findAllByType(Image).map(node => node.props.style.width);
  expect(new Set(sizes).size).toBe(18);
  tree.root.findAllByType(Image).forEach(node => {
    expect(node.props.style.width).toBeGreaterThanOrEqual(56); expect(node.props.style.width).toBeLessThanOrEqual(126);
    expect(node.props.style.height).toBeCloseTo(node.props.style.width * 0.79);
    expect(node.props.accessible).toBe(false);
  });
  for (let index = 0; index < 36; index += 2) {
    const flight = mockValues[index].animation, wings = mockValues[index + 1].animation;
    expect(flight.delay).toBeGreaterThanOrEqual(0); expect(flight.delay).toBeLessThanOrEqual(550);
    expect(flight.animation.config.duration).toBeGreaterThanOrEqual(1500); expect(flight.animation.config.duration).toBeLessThanOrEqual(2200);
    expect(wings.animation).toMatchObject({ kind: 'repeat', count: -1, animation: { kind: 'sequence' } });
  }
});

test('each original path travels up and right, with independent geometry rather than a shared row', async () => {
  await render();
  const starts = bats().map(node => StyleSheet.flatten(node.props.style).transform);
  mockValues.forEach((value, index) => { if (index % 2 === 0) value.set(1); }); await rerender();
  const ends = bats().map(node => StyleSheet.flatten(node.props.style).transform);
  starts.forEach((start, index) => {
    expect(ends[index][0].translateX).toBeGreaterThan(start[0].translateX);
    expect(ends[index][1].translateY).toBeLessThan(start[1].translateY);
  });
  expect(new Set(starts.map(transform => transform[1].translateY)).size).toBe(18);
});

test('bats fade in and out along the path and retain the original wing geometry', async () => {
  await render();
  for (const [progress, opacity] of [[0, 0], [0.04, 0.5], [0.5, 1], [0.95, 0.5], [1, 0]]) {
    mockValues[0].set(progress); mockValues[1].set(1); await rerender();
    const style = StyleSheet.flatten(bats()[0].props.style);
    expect(style.opacity).toBeCloseTo(opacity);
    expect(style.transform[2].rotate).toBe('8deg'); expect(style.transform[3].scaleX).toBeCloseTo(0.65);
  }
});

test.each(['prop', 'preference'])('reduced motion from %s omits the entire swarm', async source => {
  mockReduced = source === 'preference'; await render({ reduced: source === 'prop' });
  expect(tree.toJSON()).toBeNull(); expect(mockValues).toHaveLength(0);
});

test('enabling reduced motion cancels every flight and infinite flutter loop, and can restore them', async () => {
  await render(); const originalValues = [...mockValues];
  mockReduced = true; await rerender(); expect(tree.toJSON()).toBeNull();
  originalValues.forEach(value => expect(cancelAnimation).toHaveBeenCalledWith(value));
  expect(cancelAnimation).toHaveBeenCalledTimes(36);
  mockReduced = false; await rerender(); expect(tree.root.findAllByType(Image)).toHaveLength(18);
});

test('unmount cancels the native animations without leaving wing loops running', async () => {
  await render(); const values = [...mockValues]; await act(async () => tree.unmount()); tree = null;
  values.forEach(value => expect(cancelAnimation).toHaveBeenCalledWith(value));
  expect(cancelAnimation).toHaveBeenCalledTimes(36);
});
