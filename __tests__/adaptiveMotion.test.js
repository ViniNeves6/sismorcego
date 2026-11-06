import React from 'react';
import Renderer, { act } from 'react-test-renderer';
import { AccessibilityInfo } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import useAccessibility, { AccessibilityProvider } from '../src/hooks/useAccessibility';

let mockPerformance, value, tree, systemChange;
jest.mock('../src/hooks/useDevicePerformance', () => () => mockPerformance);
function Probe() { value = useAccessibility(); return null; }
beforeEach(async () => {
  await AsyncStorage.clear();
  jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(false);
  jest.spyOn(AccessibilityInfo, 'addEventListener').mockImplementation((_, callback) => { systemChange = callback; return { remove: jest.fn() }; });
});
afterEach(async () => { if (tree) await act(async () => tree.unmount()); tree = null; jest.restoreAllMocks(); });

test.each(['low', 'medium', 'high'])('%s profile composes automatic, user and OS preferences without overwriting the saved choice', async tier => {
  mockPerformance = { ready: true, tier, automaticReduceMotion: tier === 'low' };
  await act(async () => { tree = Renderer.create(<AccessibilityProvider><Probe /></AccessibilityProvider>); });
  expect(value.reduceMotion).toBe(tier === 'low');
  expect(value.settings.canAdjustMotion).toBe(tier !== 'low');
  await act(async () => value.updateSettings({ reduceMotion: true })); expect(value.reduceMotion).toBe(true);
  await act(async () => value.updateSettings({ reduceMotion: false })); expect(value.reduceMotion).toBe(tier === 'low');
  await act(async () => systemChange(true)); expect(value.reduceMotion).toBe(true);
  expect(value.settings.preferredReduceMotion).toBe(false);
  expect(JSON.parse(await AsyncStorage.getItem('@sismorcego:accessibility')).reduceMotion).toBe(false);
  await act(async () => systemChange(false)); expect(value.reduceMotion).toBe(tier === 'low');
});
