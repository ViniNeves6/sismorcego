import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { Text } from 'react-native';
import { Animated } from '../src/ui/AccessibleNative';
import PanelTrendChart from '../src/pages/Admin/PanelTrendChart';

jest.mock('../src/ui/useReduceMotion', () => () => mockReduceMotion);
jest.mock('../src/ui/AccessibleNative', () => {
  const actual = jest.requireActual('../src/ui/AccessibleNative');
  return { ...actual, Animated: { ...actual.Animated, timing: jest.fn() } };
});
jest.mock('react-native-svg', () => ({
  __esModule: true, default: 'Svg', Circle: 'Circle', Defs: 'Defs', Line: 'Line',
  LinearGradient: 'LinearGradient', Polygon: 'Polygon', Polyline: 'Polyline', Stop: 'Stop',
}));

const records = [{ isoDate: '2026-09-28' }, { isoDate: '2026-09-28' }, { isoDate: '2026-08-14' }];
let tree, animations, mockReduceMotion = false;
const texts = () => tree.root.findAllByType(Text).map(node => node.props.children);
const line = () => tree.root.findByType('Polyline').props.points;
const press = async label => {
  const button = tree.root.findAll(node => typeof node.props.onPress === 'function'
    && node.findAllByType(Text).some(child => child.props.children === label))[0];
  await act(async () => button.props.onPress());
};
const finish = async animation => act(async () => animation.finish());
const curve = () => animations.filter(animation => animation.config.duration === 720).at(-1);
const render = async props => act(async () => { tree = TestRenderer.create(<PanelTrendChart records={records} {...props} />); });

beforeEach(() => {
  mockReduceMotion = false; animations = []; jest.clearAllMocks();
  Animated.timing.mockImplementation((value, config) => {
    let callback, completed = false;
    const from = value.__getValue();
    const animation = {
      config, value,
      start: done => { callback = done; animations.push(animation); },
      advance: t => { if (!completed) value.setValue(from + (config.toValue - from) * config.easing(t)); },
      finish: () => {
        if (completed) return;
        completed = true; value.setValue(config.toValue); callback?.({ finished: true });
      },
      stop: jest.fn(() => {
        if (!completed) { completed = true; callback?.({ finished: false }); }
      }),
    };
    return animation;
  });
});
afterEach(async () => { if (tree) await act(async () => tree.unmount()); tree = null; });

test('day/month/day retains old labels through exit and interpolates the line, area, points and counters', async () => {
  await render();
  const dailyLine = line();
  expect(animations).toHaveLength(0);
  expect(texts()).toContain('2 registros no gráfico');
  await press('Mês');
  expect(texts()).toContain('24/09');
  expect(texts()).not.toContain('mai');
  expect(animations.at(-1).config).toMatchObject({ toValue: 0, duration: 120 });
  await finish(animations.at(-1));
  expect(texts()).toContain('mai');
  expect(texts()).not.toContain('24/09');
  expect(texts()).toContain('3 registros no gráfico');
  expect(line()).toBe(dailyLine);
  expect(texts()).not.toContain(1);
  const morph = curve();
  await act(async () => morph.advance(0.5));
  const intermediate = line();
  expect(intermediate).not.toBe(dailyLine);
  expect(intermediate).not.toContain('230.0,56.0');
  expect(texts()).toContain(1);
  expect(tree.root.findByType('Polygon').props.points).toContain(intermediate);
  const fourth = tree.root.findAllByType('Circle')[3];
  expect(Number(fourth.props.cy)).toBeGreaterThan(56);
  expect(Number(fourth.props.cy)).toBeLessThan(95);
  await finish(morph); await finish(animations.at(-1));
  expect(line()).toContain('230.0,56.0');
  const monthLine = line();
  await press('Dia');
  expect(texts()).toContain('mai');
  expect(line()).toBe(monthLine);
  await finish(animations.at(-1));
  expect(texts()).toContain('24/09');
  await finish(curve()); await finish(animations.at(-1));
  expect(line()).toBe(dailyLine);
  expect(texts()).toContain('2 registros no gráfico');
});

test('rapid changes cancel stale exits and resume from the current curve instead of jumping', async () => {
  await render();
  await press('Mês');
  const exit = animations.at(-1);
  await act(async () => exit.advance(0.5));
  await press('Dia');
  expect(exit.stop).toHaveBeenCalled();
  await finish(exit);
  expect(texts()).toContain('Evolução nos últimos 5 dias');
  await press('Mês'); await finish(animations.at(-1));
  const firstMorph = curve();
  await act(async () => firstMorph.advance(0.35));
  const halfway = line();
  await press('Dia');
  expect(firstMorph.stop).toHaveBeenCalled();
  const interruptedExit = animations.at(-1);
  await press('Mês');
  expect(interruptedExit.stop).toHaveBeenCalled();
  expect(line()).toBe(halfway);
  await finish(curve()); await finish(animations.at(-1));
  expect(texts()).toContain('Evolução nos últimos 5 meses');
  expect(line()).toContain('230.0,56.0');
});

test('live filtered data updates to an empty chart without stale counts or invalid points', async () => {
  await render();
  await act(async () => tree.update(<PanelTrendChart records={[]} />));
  expect(texts()).toContain('2 registros no gráfico');
  await finish(animations.at(-1));
  expect(texts()).toContain('0 registros no gráfico');
  await finish(curve()); await finish(animations.at(-1));
  expect(tree.root.findAllByType('Circle').every(node => Number(node.props.cy) === 95)).toBe(true);
  expect(line()).not.toMatch(/NaN|Infinity/);
});

test.each(['system', 'app'])('%s reduced motion switches in both directions without scheduling animations', async source => {
  mockReduceMotion = source === 'system';
  await render({ reduceMotion: source === 'app' });
  for (const [mode, title, count] of [['Mês', 'meses', 3], ['Dia', 'dias', 2]]) {
    await press(mode);
    expect(texts()).toContain(`Evolução nos últimos 5 ${title}`);
    expect(texts()).toContain(`${count} registros no gráfico`);
  }
  expect(animations).toHaveLength(0);
});

test('unmounting during navigation stops the curve, entry and frame listener', async () => {
  await render(); await press('Mês'); await finish(animations.at(-1));
  const morph = curve(), entry = animations.at(-1);
  expect(morph.value.hasListeners()).toBe(true);
  await act(async () => tree.unmount()); tree = null;
  expect(morph.stop).toHaveBeenCalled();
  expect(entry.stop).toHaveBeenCalled();
  expect(morph.value.hasListeners()).toBe(false);
});
