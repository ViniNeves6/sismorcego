import React from 'react';
import Renderer, { act } from 'react-test-renderer';
import { AppState, DeviceEventEmitter, Keyboard, NativeModules, Platform } from 'react-native';
import useKeyboardState from '../src/hooks/useKeyboardState';
import KeyboardDock from '../src/ui/KeyboardDock';

let tree, snapshot, receive, resume, resolveSnapshot;
const originalOS = Platform.OS;
function Probe() { snapshot = useKeyboardState(); return <KeyboardDock testID="dock" hidden={snapshot.visible || snapshot.transitioning} />; }
const emit = async patch => act(async () => receive({ visible: false, transitioning: false, height: 0, keyboardTop: 800, ...patch }));
beforeEach(() => {
  Platform.OS = 'android';
  NativeModules.SismorcegoWindow = { getSnapshot: jest.fn(() => new Promise(resolve => { resolveSnapshot = resolve; })) };
  jest.spyOn(DeviceEventEmitter, 'addListener').mockImplementation((_, fn) => { receive = fn; return { remove: jest.fn() }; });
  jest.spyOn(AppState, 'addEventListener').mockImplementation((_, fn) => { resume = fn; return { remove: jest.fn() }; });
  jest.spyOn(Keyboard, 'addListener');
});
afterEach(async () => {
  if (tree) await act(async () => tree.unmount()); tree = null;
  delete NativeModules.SismorcegoWindow; Platform.OS = originalOS; jest.restoreAllMocks();
});

test('native start/end ordering hides the mounted dock until the IME layout settles, ignoring stale snapshots', async () => {
  await act(async () => { tree = Renderer.create(<Probe />); });
  await emit({ sequence: 100 });
  const dock = tree.root.findByType(KeyboardDock);
  await emit({ sequence: 101, transitioning: true }); expect(dock.props.hidden).toBe(true);
  await emit({ sequence: 102, visible: true, transitioning: true, height: 300, keyboardTop: 500 });
  await emit({ sequence: 103, visible: true, height: 300, keyboardTop: 500 });
  // An older async getSnapshot response cannot reveal the dock during typing.
  await act(async () => resolveSnapshot({ sequence: 100, visible: false }));
  expect(dock.props.hidden).toBe(true); expect(snapshot.keyboardTop).toBe(500);
  expect(Keyboard.addListener).not.toHaveBeenCalled();
  await emit({ sequence: 104, visible: true, transitioning: true });
  await emit({ sequence: 105, visible: false, transitioning: true }); expect(dock.props.hidden).toBe(true);
  await emit({ sequence: 106 });
  expect(dock.props.hidden).toBe(false); expect(tree.root.findByType(KeyboardDock)).toBe(dock);
});

test('resume reconciles native state and a promise resolving after unmount cannot update the store', async () => {
  await act(async () => { tree = Renderer.create(<Probe />); });
  await emit({ sequence: 200, visible: true });
  await act(async () => resume('active'));
  await act(async () => resolveSnapshot({ sequence: 201, visible: false }));
  expect(snapshot.visible).toBe(false);
  await act(async () => resume('active'));
  await act(async () => tree.unmount()); tree = null;
  await act(async () => resolveSnapshot({ sequence: 202, visible: true }));
  expect(snapshot.visible).toBe(false);
});
