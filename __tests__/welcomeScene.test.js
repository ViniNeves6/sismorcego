import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { StyleSheet, View } from 'react-native';
import { Animated } from '../src/ui/AccessibleNative';
import WelcomeScene, { SCENE_START_FALLBACK_MS } from '../src/ui/WelcomeScene';

let mockSystemReduceMotion = false;
jest.mock('../src/ui/useReduceMotion', () => () => mockSystemReduceMotion);
let mockPerformance;
jest.mock('../src/hooks/useAccessibility', () => {
  const actual = jest.requireActual('../src/hooks/useAccessibility').default;
  return () => ({ ...actual(), performance: mockPerformance });
});
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
    tree = TestRenderer.create(<WelcomeScene {...props} />);
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
const presentScene = async () => {
  await frame(400, 800);
};
const loadLayer = async layer => act(async () => node(`welcome-main-bat-${layer}`).props.onLoad());
const commitImages = async () => act(async () => { await jest.advanceTimersByTimeAsync(50); });
const value = animated => animated?.__getValue ? animated.__getValue() : animated;

beforeEach(() => {
  jest.useFakeTimers();
  mockSystemReduceMotion = false;
  mockPerformance = undefined;
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
  expect(value(style('welcome-moon').opacity)).toBe(0);

  await loadLayer('body');
  expect(timings).toHaveLength(0);
  await commitImages();
  const swoop = timings.find(animation => animation.config.duration === 720);
  expect(swoop).toBeDefined();
  const transform = () => style('welcome-main-flight').transform.map(item => value(Object.values(item)[0]));
  expect(transform()).toEqual([-90, -95, '-12deg', 0.58]);
  expect(timings.find(animation => animation.config.duration === 900).config).toMatchObject({ toValue: 1, delay: 100 });
  for (const layer of ['left', 'right', 'body']) {
    expect(node(`welcome-main-bat-${layer}`).props.fadeDuration).toBe(0);
  }
  await finish(swoop);
  expect(transform()).toEqual([0, 0, '0deg', 1]);
  await loadLayer('left');
  await commitImages();
  expect(timings.filter(animation => animation.config.duration === 720)).toHaveLength(1);
});

test('a slow image never freezes the opening: the entrance starts after the fallback', async () => {
  await render({}, false);
  await presentScene();
  await loadLayer('left');
  await commitImages();
  expect(timings).toHaveLength(0);
  await act(async () => { await jest.advanceTimersByTimeAsync(SCENE_START_FALLBACK_MS); });
  expect(timings.find(animation => animation.config.duration === 720)).toBeDefined();
});

test('the title appears after the bat lands and unmount stops every flight', async () => {
  await render();
  expect(timings.find(animation => animation.config.duration === 600).config).toMatchObject({ toValue: 1, delay: 950 });
  await act(async () => tree.unmount());
  tree = null;
  expect(loops.filter(loop => loop.start.mock.calls.length > 0).every(loop => loop.stop.mock.calls.length > 0)).toBe(true);
});

test('system reduced motion shows the finished scene without flights or wing beats', async () => {
  mockSystemReduceMotion = true;
  await render();
  expect(tree.root.findAllByProps({ testID: 'welcome-background-bat-0' })).toHaveLength(0);
  expect(loops).toHaveLength(0);
  expect(style('welcome-main-bat-left').transform[0].rotate.__getValue()).toBe('0deg');
  expect(value(style('welcome-title').opacity)).toBe(1);
  expect(value(style('welcome-moon').opacity)).toBe(1);
});

test('every looping motion is a single native timing, so a busy JS thread at startup cannot freeze or reset the wings', async () => {
  await render();
  const swoop = timings.find(animation => animation.config.duration === 720);
  await finish(swoop); // starts the hover loop
  expect(loops.length).toBeGreaterThanOrEqual(4);
  for (const loop of loops) {
    expect(loop.animation.config).toMatchObject({ toValue: 1, useNativeDriver: true });
    expect(loop.animation.value).toBeDefined();
  }
  expect(loops.map(loop => loop.animation.config.duration)).toEqual(expect.arrayContaining([580, 480, 1160]));
  // The wave is smooth and symmetric: open at the start, closed halfway, open again.
  const wing = style('welcome-main-bat-left').transform[0].rotate;
  const flapPhase = loops.find(loop => loop.animation.config.duration === 580).animation.value;
  const at = async phase => { await act(async () => flapPhase.setValue(phase)); return wing.__getValue(); };
  expect(await at(0)).toBe('-14deg');
  expect(await at(0.5)).toBe('14deg');
  expect(await at(1)).toBe('-14deg');
});

test('re-rendering during startup keeps the same animation nodes, so the wings never snap back', async () => {
  await render();
  const nodes = () => ({
    left: style('welcome-main-bat-left').transform[0].rotate,
    right: style('welcome-main-bat-right').transform[0].rotate,
    flight: style('welcome-main-flight').transform,
    mini: style('welcome-mini-0-left').transform[0].rotate,
  });
  const before = nodes();
  const starts = timings.length;
  for (let i = 0; i < 3; i++) await act(async () => tree.update(<WelcomeScene />));
  await frame(400, 800);
  const after = nodes();
  expect(after.left).toBe(before.left);
  expect(after.right).toBe(before.right);
  expect(after.mini).toBe(before.mini);
  after.flight.forEach((item, index) => expect(Object.values(item)[0]).toBe(Object.values(before.flight[index])[0]));
  expect(timings.length).toBe(starts); // nada reinicia
});

test('while the device performance is being measured nothing animates; then the full entrance plays', async () => {
  mockPerformance = { ready: false, tier: 'medium' };
  mockSystemReduceMotion = true; // precaução automática durante a medição
  await render();
  expect(timings).toHaveLength(0);
  expect(loops).toHaveLength(0);
  expect(value(style('welcome-title').opacity)).toBe(0);
  mockPerformance = { ready: true, tier: 'high', source: 'native' };
  mockSystemReduceMotion = false;
  await act(async () => tree.update(<WelcomeScene />));
  const swoop = timings.find(animation => animation.config.duration === 720);
  expect(swoop).toBeDefined();
  expect(style('welcome-main-flight').transform.map(item => value(Object.values(item)[0]))).toEqual([-90, -95, '-12deg', 0.58]);
});
