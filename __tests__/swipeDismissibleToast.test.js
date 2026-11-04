import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { PanResponder, StyleSheet, Text } from 'react-native';
import { Animated } from '../src/ui/AccessibleNative';
import SwipeDismissibleToast from '../src/ui/SwipeDismissibleToast';

jest.mock('../src/ui/useReduceMotion', () => () => mockReduceMotion);
jest.mock('react-native-svg', () => ({ __esModule: true, default: 'Svg', Path: 'Path', Circle: 'Circle', Rect: 'Rect', Line: 'Line', Polyline: 'Polyline' }));
jest.mock('../src/ui/AccessibleNative', () => {
  const actual = jest.requireActual('../src/ui/AccessibleNative');
  return { ...actual, Animated: { ...actual.Animated, timing: jest.fn(), spring: jest.fn() } };
});

let tree;
let ref;
let responder;
let animations;
let mockReduceMotion = false;
const messages = () => tree.root.findAllByType(Text).map(node => node.props.children);
const show = async message => act(async () => ref.current.show(message));
const finishAnimations = async () => act(async () => {
  for (const animation of [...animations]) animation.finish();
});
const drag = async (dx, dy, release = true) => act(async () => {
  if (!responder.onMoveShouldSetPanResponder(null, { dx, dy })) return;
  responder.onPanResponderGrant();
  responder.onPanResponderMove(null, { dx, dy });
  if (release) responder.onPanResponderRelease(null, { dx, dy, vx: 0, vy: 0 });
});

beforeEach(async () => {
  jest.useFakeTimers();
  mockReduceMotion = false;
  animations = [];
  jest.spyOn(PanResponder, 'create').mockImplementation(config => {
    responder = config;
    return { panHandlers: {} };
  });
  const animate = (value, config) => {
    let completed = false;
    let completion;
    const animation = {
      start: callback => { completion = callback; animations.push(animation); },
      stop: () => {
        if (!completed) { completed = true; completion?.({ finished: false }); }
      },
      finish: () => {
        if (!completed) {
          completed = true;
          value.setValue(config.toValue);
          completion?.({ finished: true });
        }
      },
    };
    return animation;
  };
  Animated.timing.mockImplementation(animate);
  Animated.spring.mockImplementation(animate);
  ref = React.createRef();
  await act(async () => { tree = TestRenderer.create(<SwipeDismissibleToast ref={ref} />); });
});

afterEach(async () => {
  await act(async () => tree.unmount());
  jest.restoreAllMocks();
  jest.useRealTimers();
});

test.each([[96, 0], [-96, 0]])('dragging sideways %s / %s dismisses after the exit animation', async (dx, dy) => {
  await show('Configuração salva');
  await finishAnimations();
  await drag(dx, dy);
  expect(messages()).toContain('Configuração salva');
  await finishAnimations();
  expect(tree.toJSON()).toBeNull();
});

test('vertical gestures are not captured or used to move or dismiss the alert', async () => {
  await show('Aviso');
  await finishAnimations();
  expect(responder.onStartShouldSetPanResponder()).toBe(false);
  expect(responder.onMoveShouldSetPanResponder(null, { dx: 10, dy: 90 })).toBe(false);
  await drag(0, -90);
  await drag(0, 90);
  expect(messages()).toEqual(['Aviso']);
});

test('a diagonal horizontal drag locks the alert height and ignores vertical release speed', async () => {
  await show('Aviso');
  await finishAnimations();
  await drag(40, 25, false);
  const alert = tree.root.findAll(node => node.props.accessibilityRole === 'alert')[0];
  const transforms = StyleSheet.flatten(alert.props.style).transform;
  const values = Object.fromEntries(transforms.flatMap(transform => Object.entries(transform).map(([key, value]) => [key, value?.__getValue ? value.__getValue() : value])));
  expect(values).toMatchObject({ translateX: 40, translateY: 0 });
  await act(async () => responder.onPanResponderRelease(null, { dx: 40, dy: 200, vx: 0, vy: 5 }));
  await finishAnimations();
  expect(messages()).toEqual(['Aviso']);
});

test('holding pauses auto-dismiss; a small or interrupted drag returns before resuming the timer', async () => {
  await show('Aviso');
  await finishAnimations();
  await drag(10, 0, false);
  await act(async () => jest.advanceTimersByTime(5000));
  expect(messages()).toContain('Aviso');
  await act(async () => responder.onPanResponderTerminate());
  await finishAnimations();
  await act(async () => jest.advanceTimersByTime(2300));
  expect(messages()).toContain('Aviso');
  await finishAnimations();
  expect(tree.toJSON()).toBeNull();
});

test('a new alert waits for the dragged alert to exit and gets its own timer', async () => {
  await show('Primeiro');
  await finishAnimations();
  await drag(-80, 0);
  await show('Segundo');
  expect(messages()).toEqual(['Primeiro']);
  await finishAnimations();
  expect(messages()).toEqual(['Segundo']);
  await finishAnimations();
  await act(async () => jest.advanceTimersByTime(2000));
  expect(messages()).toEqual(['Segundo']);
  await act(async () => jest.advanceTimersByTime(300));
  await finishAnimations();
  expect(tree.toJSON()).toBeNull();
});

test('reduced motion allows immediate dismissal through the accessibility action', async () => {
  mockReduceMotion = true;
  await show('Animações desativadas');
  const alert = tree.root.findAll(node => typeof node.props.onAccessibilityAction === 'function')[0];
  await act(async () => alert.props.onAccessibilityAction({ nativeEvent: { actionName: 'dismiss' } }));
  expect(tree.toJSON()).toBeNull();
  expect(animations).toHaveLength(0);
});
