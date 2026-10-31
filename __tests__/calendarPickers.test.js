import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { BackHandler, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Animated } from '../src/ui/AccessibleNative';
import AppCalendarModal from '../src/ui/AppCalendarModal';
import { layoutCalendar } from './helpers/layoutCalendar';

jest.mock('../src/services/redesignData', () => ({}));
jest.mock('../src/ui/useReduceMotion', () => () => false);
jest.mock('react-native-svg', () => ({ __esModule: true, default: 'Svg', Path: 'Path', Circle: 'Circle', Rect: 'Rect', Line: 'Line', Polyline: 'Polyline' }));
let tree, animations, back;
const props = { visible: true, selectedIsoDate: '2025-01-10', onClose: jest.fn(), onSelectDate: jest.fn() };
const node = testID => tree.root.findAllByProps({ testID }).find(n => n.type === View);
const exists = testID => tree.root.findAllByProps({ testID }).length > 0;
const press = async label => act(async () => {
  tree.root.findAll(n => n.props.onPress && (n.props.accessibilityLabel === label ||
    (n.findAllByType(Text).length === 1 && n.findAllByType(Text)[0].props.children === label)))[0].props.onPress();
});
const finish = async () => act(async () => animations.at(-1).finish());
beforeEach(async () => {
  jest.clearAllMocks(); animations = [];
  jest.spyOn(BackHandler, 'addEventListener').mockImplementation((_, callback) => { back = callback; return { remove: jest.fn() }; });
  jest.spyOn(Animated, 'timing').mockImplementation((value, config) => {
    let done;
    const animation = { config, start: callback => { done = callback; animations.push(animation); }, stop: jest.fn(),
      finish: () => { value.setValue(config.toValue); done?.({ finished: true }); } };
    return animation;
  });
  await act(async () => { tree = TestRenderer.create(<AppCalendarModal {...props} />); });
  await finish();
  await layoutCalendar(tree);
});
afterEach(async () => { await act(async () => tree.unmount()); jest.restoreAllMocks(); });

test.each([['month', 'Selecionar mês', 12], ['year', 'Selecionar ano', new Date().getFullYear() - 1929]])(
  '%s list has a bounded scroll viewport and no short control column among its touch ancestors', async (kind, label, count) => {
    await press(label); await finish();
    const menu = node(`calendar-${kind}-menu`);
    const ancestors = [];
    for (let parent = menu.parent; parent; parent = parent.parent) ancestors.push(parent.props.testID);
    expect(ancestors).toContain('calendar-dialog');
    expect(ancestors).not.toContain('calendar-controls');
    expect(ancestors).not.toContain(`calendar-${kind}-anchor`);
    const list = tree.root.findByType(ScrollView);
    expect(list.props.testID).toBe(`calendar-${kind}-list`);
    expect(StyleSheet.flatten(list.props.style).height).toBe(180);
    expect(list.props.scrollEnabled).not.toBe(false);
    expect(list.findAllByType(Text)).toHaveLength(count);
  },
);

test('months and old years can be selected and produce the intended calendar date', async () => {
  await press('Selecionar mês'); await finish();
  await press('Dezembro'); await finish();
  expect(exists('calendar-month-menu')).toBe(false);
  await press('Selecionar ano'); await finish();
  await press('1930'); await finish();
  expect(exists('calendar-year-menu')).toBe(false);
  await press('10');
  expect(props.onSelectDate).toHaveBeenCalledWith({ iso: '1930-12-10', display: '10/12/1930' });
});

test('changing picker retains the old menu until its exit, then mounts the requested menu', async () => {
  await press('Selecionar mês'); await finish();
  await press('Selecionar ano');
  expect(exists('calendar-month-menu')).toBe(true);
  expect(exists('calendar-year-menu')).toBe(false);
  expect(animations.at(-1).config.toValue).toBe(0);
  await finish();
  expect(exists('calendar-month-menu')).toBe(false);
  expect(exists('calendar-year-menu')).toBe(true);
  expect(animations.at(-1).config.toValue).toBe(1);
  await finish();
  await act(async () => expect(back()).toBe(true));
  expect(exists('calendar-year-menu')).toBe(true);
  await finish();
  expect(exists('calendar-year-menu')).toBe(false);
  expect(props.onClose).not.toHaveBeenCalled();
});

test('picker positions follow changed control measurements while open', async () => {
  await press('Selecionar mês'); await finish();
  expect(StyleSheet.flatten(node('calendar-month-menu').props.style)).toMatchObject({ left: 59, top: 122.5, width: 117 });
  await layoutCalendar(tree, { controls: { x: 19.5, y: 98, width: 326, height: 40 }, month: { x: 41, y: 2, width: 162, height: 36 } });
  expect(StyleSheet.flatten(node('calendar-month-menu').props.style)).toMatchObject({ left: 59, top: 139.5, width: 162 });
});

test('reduced motion switches menus and closes with Android back immediately', async () => {
  await act(async () => tree.update(<AppCalendarModal {...props} reduceMotion />));
  await press('Selecionar mês');
  expect(exists('calendar-month-menu')).toBe(true);
  await press('Selecionar ano');
  expect(exists('calendar-month-menu')).toBe(false);
  expect(exists('calendar-year-menu')).toBe(true);
  await act(async () => expect(back()).toBe(true));
  expect(exists('calendar-year-menu')).toBe(false);
});
