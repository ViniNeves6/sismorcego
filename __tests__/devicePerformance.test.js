import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppState, NativeModules, Platform } from 'react-native';
import { classifyDevice, initialDevicePerformance, loadDevicePerformance, nextPerformanceObservation, observeStartupPerformance } from '../src/services/devicePerformance';

const high = { totalMemoryMb: 8000, availableMemoryMb: 2500, cpuCores: 8, cpuMaxMhz: 3000, androidSdk: 35 };
const medium = { ...high, totalMemoryMb: 4000, cpuCores: 4 };
const os = Platform.OS, state = AppState.currentState;
afterEach(() => { Platform.OS = os; AppState.currentState = state; delete NativeModules.SismorcegoDevice; jest.restoreAllMocks(); });

test.each([
  [high, 'high'], [medium, 'medium'], [{ ...high, totalMemoryMb: 2048 }, 'low'],
  [{ ...high, cpuCores: 2 }, 'low'], [{ ...high, cpuCores: 4, cpuMaxMhz: 1200 }, 'low'],
  [{ ...high, androidSdk: 25 }, 'low'], [{ ...high, lowRamDevice: true }, 'low'],
  [{ ...high, availableMemoryMb: 200 }, 'high'],
  [{ ...high, availableMemoryMb: 200, lowMemory: true }, 'medium'],
  [{ ...high, cpuMaxMhz: 0 }, 'high'], [{}, 'medium'],
  [{ ...high, cpuCores: 4, cpuMaxMhz: 0.002 }, 'medium'],
  [{ ...high, totalMemoryMb: Infinity, cpuCores: NaN }, 'medium'],
])('stable capability profile %j selects %s', (capabilities, tier) => {
  expect(classifyDevice(capabilities)).toEqual({ tier, automaticReduceMotion: tier === 'low' });
});

test('only confirmed cached constraints lower a tier; truthy invalid flags do not', () => {
  expect(classifyDevice(high, { constrained: true }).tier).toBe('medium');
  expect(classifyDevice(medium, { constrained: true }).tier).toBe('low');
  expect(classifyDevice({ ...high, lowRamDevice: 'false', lowMemory: 'false' }, { constrained: 'false' }).tier).toBe('high');
});

test('passive observations require two slow launches to downgrade and three healthy ones to recover', () => {
  const slow = Array(12).fill(55), fast = Array(12).fill(16.7);
  const first = nextPerformanceObservation({ fingerprint: 'device' }, slow);
  expect(first).toMatchObject({ constrained: false, slowRuns: 1 });
  const second = nextPerformanceObservation({ fingerprint: 'device', history: first }, slow);
  expect(second).toMatchObject({ constrained: true, slowRuns: 2 });
  let history = second;
  for (let run = 1; run <= 3; run++) {
    history = nextPerformanceObservation({ fingerprint: 'device', history }, fast);
    expect(history.constrained).toBe(run < 3);
  }
  expect(nextPerformanceObservation({}, [NaN, 1, 800, 16])).toBeNull();
});

test('unavailable native metrics safely preserve the medium fallback without storage or startup delays', async () => {
  Platform.OS = 'android'; AsyncStorage.getItem.mockClear();
  expect(initialDevicePerformance()).toMatchObject({ ready: true, tier: 'medium' });
  expect(await loadDevicePerformance()).toMatchObject({ source: 'unavailable', automaticReduceMotion: false });
  expect(AsyncStorage.getItem).not.toHaveBeenCalled();
});

test('one native query is reused for the session; passive sampling never mutates the active profile', async () => {
  Platform.OS = 'android';
  NativeModules.SismorcegoDevice = { getCapabilities: jest.fn().mockResolvedValue(high) };
  AsyncStorage.getItem.mockResolvedValueOnce(null);
  expect(initialDevicePerformance()).toMatchObject({ ready: false });
  const [profile, same] = await Promise.all([loadDevicePerformance(), loadDevicePerformance()]);
  expect(profile).toBe(same); expect(profile.tier).toBe('high');
  expect(NativeModules.SismorcegoDevice.getCapabilities).toHaveBeenCalledTimes(1);
  let callback, background;
  AppState.currentState = 'active';
  jest.spyOn(global, 'requestAnimationFrame').mockImplementation(fn => { callback = fn; return 1; });
  jest.spyOn(global, 'cancelAnimationFrame').mockImplementation(() => {});
  const remove = jest.fn();
  jest.spyOn(AppState, 'addEventListener').mockImplementation((_, fn) => { background = fn; return { remove }; });
  AsyncStorage.setItem.mockClear();
  observeStartupPerformance(profile); callback(0); background('background');
  callback(50); expect(AsyncStorage.setItem).not.toHaveBeenCalled(); expect(remove).toHaveBeenCalled();
  observeStartupPerformance(profile);
  for (let frame = 0; frame < 16; frame++) callback(frame * 55);
  expect(AsyncStorage.setItem).toHaveBeenCalledTimes(1);
  expect(profile.tier).toBe('high'); expect(profile.history).toBeUndefined();
});
