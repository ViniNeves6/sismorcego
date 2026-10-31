import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { Modal, StyleSheet, View } from 'react-native';
import { Animated } from '../src/ui/AccessibleNative';
import SpotlightWelcomeModal from '../src/ui/SpotlightWelcomeModal';

let mockSystemReduceMotion = false;
jest.mock('../src/ui/useReduceMotion', () => () => mockSystemReduceMotion);
jest.mock('react-native-svg', () => ({
  __esModule: true, default: 'Svg', Circle: 'Circle', Defs: 'Defs',
  RadialGradient: 'RadialGradient', Rect: 'Rect', Stop: 'Stop',
}));

let tree;
let timings;
let loops;
const node = testID => {
  const matches = tree.root.findAllByProps({ testID });
  return matches.find(n => n.type === View) || matches[0];
};
const style = testID => StyleSheet.flatten(node(testID).props.style);
const finish = async animation => act(async () => animation.finish());
const render = async (props, loadImages = true) => {
  await act(async () => {
    tree = TestRenderer.create(<SpotlightWelcomeModal visible {...props} />);
  });
  if (loadImages) {
    await presentScene();
    await loadLayer('left');
    await loadLayer('right');
    await loadLayer('body');
    await commitImages();
  }
};
const frame = async (width, height) => act(async () => node('welcome-screen').props.onLayout({ nativeEvent: { layout: { width, height } } }));
const button = () => tree.root.findAll(n => n.props.accessibilityLabel === 'Continuar para o aplicativo' && n.props.onPress)[0];
const presentScene = async () => {
  await frame(400, 800);
  await act(async () => tree.root.findByType(Modal).props.onShow());
};
const loadLayer = async layer => act(async () => node(`welcome-main-bat-${layer}`).props.onLoad());
const commitImages = async () => act(async () => { await jest.advanceTimersByTimeAsync(50); });
const value = animated => animated?.__getValue ? animated.__getValue() : animated;

beforeEach(() => {
  jest.useFakeTimers();
  mockSystemReduceMotion = false;
  timings = [];
  loops = [];
  jest.spyOn(Animated, 'timing').mockImplementation((value, config) => {
    let completion;
    const animation = {
      value, config,
      start(callback) { completion = callback; if (config.duration === 0) animation.finish(); },
      stop: jest.fn(),
      finish() { value.setValue(config.toValue); completion?.({ finished: true }); },
    };
    timings.push(animation);
    return animation;
  });
  jest.spyOn(Animated, 'loop').mockImplementation(animation => {
    const loop = { animation, start: jest.fn(), stop: jest.fn(), reset: jest.fn() };
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

test('the four small bats constrain both PNGs to their actual miniature canvas', async () => {
  await render();
  const dimensions = [[43, 29], [31, 21], [37, 25], [28, 19]];
  for (const [index, [width, height]] of dimensions.entries()) {
    expect(style(`welcome-background-bat-${index}`)).toMatchObject({ width, height, left: -55 });
    for (const side of ['left', 'right']) {
      expect(style(`welcome-mini-${index}-${side}`)).toMatchObject({ width, height });
      expect(node(`welcome-mini-${index}-${side}`).props.resizeMode).toBe('stretch');
    }
  }
  const flights = timings.filter(animation => [9000, 12000, 10000, 14000].includes(animation.config.duration));
  expect(flights.map(animation => animation.config.duration)).toEqual([9000, 12000, 10000, 14000]);
  expect(new Set(flights.map(animation => animation.value)).size).toBe(4);
});

test('the main bat canvas and moon use the HTML stage proportions and align their visible centers', async () => {
  await render({ reduceMotion: true });
  await frame(400, 800);
  const stage = style('welcome-stage');
  const bat = style('welcome-main-bat');
  const moon = style('welcome-moon');
  expect(stage.width).toBe(360);
  expect(stage.height).toBeCloseTo(360 * 313 / 437);
  expect(bat).toMatchObject({ width: 360, height: 232.5 });
  // Visible body bounds in the original PNG are (380,177)-(584,486).
  const bodyCenter = { x: bat.left + 482 * bat.width / 960, y: bat.top + 331.5 * bat.height / 620 };
  expect(bodyCenter.x).toBeCloseTo(stage.width / 2);
  expect(bodyCenter.y).toBeCloseTo(stage.height / 2);
  expect(moon.left + moon.width / 2).toBeCloseTo(bodyCenter.x);
  expect(moon.top + moon.height / 2).toBeCloseTo(bodyCenter.y);
  expect(style('welcome-main-bat-left').transformOrigin).toEqual([360 * 0.484375, 232.5 * 0.5080645, 0]);
  expect(style('welcome-main-bat-right').transformOrigin).toEqual([360 * 0.515625, 232.5 * 0.5064516, 0]);
});

test.each([[320, 568], [360, 800], [412, 915], [768, 1024], [915, 412]])(
  'moon and visible bat share the screen center at %s x %s', async (width, height) => {
    await render({ reduceMotion: true });
    await frame(width, height);
    const root = style('welcome-screen');
    const stage = style('welcome-stage');
    const bat = style('welcome-main-bat');
    const moon = style('welcome-moon');
    expect(root.alignItems).toBe('center');
    expect(stage.width).toBeLessThanOrEqual(width);
    // Resolve the centered flex child's horizontal origin, then the visible artwork.
    const stageLeft = (width - stage.width) / 2;
    expect(stageLeft + moon.left + moon.width / 2).toBeCloseTo(width / 2);
    expect(stageLeft + bat.left + 482 * bat.width / 960).toBeCloseTo(width / 2);
    expect(style('welcome-main-flight').transform.map(item => value(Object.values(item)[0])))
      .toEqual([0, 0, '0deg', 1]);
  },
);

test('resizing an entered welcome realigns the artwork without restarting its flight', async () => {
  await render();
  const flight = timings.find(animation => animation.config.duration === 720);
  await finish(flight);
  for (const [width, height] of [[360, 800], [800, 360], [412, 915]]) {
    await frame(width, height);
    const stage = style('welcome-stage');
    const bat = style('welcome-main-bat');
    const moon = style('welcome-moon');
    expect(moon.left + moon.width / 2).toBeCloseTo(stage.width / 2);
    expect(bat.left + 482 * bat.width / 960).toBeCloseTo(stage.width / 2);
  }
  expect(timings.filter(animation => animation.config.duration === 720)).toHaveLength(1);
  expect(style('welcome-main-flight').transform.map(item => value(Object.values(item)[0])))
    .toEqual([0, 0, '0deg', 1]);
});

test('the welcome title uses the reference font families and responsive sizes', async () => {
  await render({ reduceMotion: true });
  await frame(360, 800);
  const textStyles = tree.root.findAll(n => n.props.children === 'Bem-vindo ao' || n.props.children === 'Sismorcego')
    .map(n => StyleSheet.flatten(n.props.style));
  expect(textStyles).toEqual(expect.arrayContaining([
    expect.objectContaining({ fontFamily: 'PlusJakartaSans-SemiBold', fontSize: 17.5, opacity: 0.8 }),
    expect.objectContaining({ fontFamily: 'PlusJakartaSans-ExtraBold', fontSize: 35, letterSpacing: -35 * 0.045 }),
  ]));
  // Android needs the actual font ascent/descent, rather than the tighter CSS
  // line box: Plus Jakarta Sans has 1.26 em of native vertical metrics.
  expect(style('welcome-brand-name').lineHeight).toBeUndefined();
  expect(style('welcome-brand-name').paddingBottom).toBeGreaterThanOrEqual(4);
  expect(style('welcome-brand-name').overflow).toBe('visible');
});

test('the complete bat waits for every decoded layer and enters with the HTML offset and scale', async () => {
  await render({}, false);
  await presentScene();
  await loadLayer('left');
  await loadLayer('right');
  await commitImages();
  expect(timings).toHaveLength(0);
  expect(value(style('welcome-screen').opacity)).toBe(0);
  expect(button().props.disabled).toBe(true);

  await loadLayer('body');
  expect(timings).toHaveLength(0);
  await commitImages();
  const swoop = timings.find(animation => animation.config.duration === 720);
  expect(swoop).toBeDefined();
  const transform = () => style('welcome-main-flight').transform.map(item => value(Object.values(item)[0]));
  expect(transform()).toEqual([-90, -95, '-12deg', 0.58]);
  expect(timings.filter(animation => animation.config.duration === 380 && animation.config.toValue === 1)).toHaveLength(1);
  for (const layer of ['left', 'right', 'body']) {
    expect(node(`welcome-main-bat-${layer}`).props.fadeDuration).toBe(0);
  }
  await finish(swoop);
  expect(transform()).toEqual([0, 0, '0deg', 1]);
  await loadLayer('left');
  await commitImages();
  expect(timings.filter(animation => animation.config.duration === 720)).toHaveLength(1);
});

test('closing stops every flight, retains the welcome through its fade, and handles Android back', async () => {
  const onClose = jest.fn();
  const onExited = jest.fn();
  await render({ onClose, onExited });
  expect(button().props.disabled).toBe(true);
  await act(async () => jest.advanceTimersByTime(1000));
  expect(button().props.disabled).toBe(false);
  await act(async () => tree.root.findByType(Modal).props.onRequestClose());
  expect(onClose).toHaveBeenCalledTimes(1);
  await act(async () => tree.update(<SpotlightWelcomeModal visible={false} onClose={onClose} onExited={onExited} />));
  expect(tree.toJSON()).not.toBeNull();
  expect(loops.filter(loop => loop.start.mock.calls.length > 0).every(loop => loop.stop.mock.calls.length > 0)).toBe(true);
  expect(button().props.disabled).toBe(true);
  const exit = timings.at(-1);
  expect(exit.config).toMatchObject({ toValue: 0, duration: 380 });
  expect(onExited).not.toHaveBeenCalled();
  await finish(exit);
  expect(tree.toJSON()).toBeNull();
  expect(onExited).toHaveBeenCalledTimes(1);
});

test('reopening cancels the old exit and restarts the entry without leaving stale animations', async () => {
  await render();
  await act(async () => tree.update(<SpotlightWelcomeModal visible={false} />));
  const exit = timings.at(-1);
  await act(async () => tree.update(<SpotlightWelcomeModal visible />));
  expect(exit.stop).toHaveBeenCalled();
  await finish(exit);
  expect(tree.toJSON()).not.toBeNull();
  expect(button().props.disabled).toBe(true);
  expect(timings.at(-1).config).toMatchObject({ duration: 600, delay: 950 });
});

test('system reduced motion hides background flights, neutralizes wings and closes immediately', async () => {
  mockSystemReduceMotion = true;
  const onExited = jest.fn();
  await render({ onExited });
  expect(tree.root.findAllByProps({ testID: 'welcome-background-bat-0' })).toHaveLength(0);
  expect(loops).toHaveLength(0);
  expect(style('welcome-main-bat-left').transform[0].rotate.__getValue()).toBe('0deg');
  expect(button().props.disabled).toBe(false);
  await act(async () => tree.update(<SpotlightWelcomeModal visible={false} onExited={onExited} />));
  expect(tree.toJSON()).toBeNull();
  expect(onExited).toHaveBeenCalledTimes(1);
});
