import React from 'react';
import Renderer, { act } from 'react-test-renderer';
import { AppState, Keyboard, Platform } from 'react-native';
import useKeyboardVisible from '../src/hooks/useKeyboardVisible';

let tree, visible, listeners, removers, appState, removeAppState;
const originalPlatform = Platform.OS;
function Probe() { visible = useKeyboardVisible(); return null; }
const mount = async () => act(async () => { tree = Renderer.create(<Probe />); });
const emit = async event => act(async () => listeners[event]?.({ endCoordinates: { screenY: 500, height: event.includes('Hide') ? 0 : 300 } }));
beforeEach(() => {
  listeners = {}; removers = []; removeAppState = jest.fn(); Platform.OS = 'android';
  jest.spyOn(Keyboard, 'isVisible').mockReturnValue(false);
  jest.spyOn(Keyboard, 'addListener').mockImplementation((event, callback) => {
    listeners[event] = callback; const remove = jest.fn(); removers.push(remove); return { remove };
  });
  jest.spyOn(AppState, 'addEventListener').mockImplementation((event, callback) => { appState = callback; return { remove: removeAppState }; });
});
afterEach(async () => {
  if (tree) await act(async () => tree.unmount()); tree = null;
  jest.restoreAllMocks(); Platform.OS = originalPlatform;
});

test('recognizes a keyboard that was already open before mounting', async () => {
  Keyboard.isVisible.mockReturnValue(true); await mount(); expect(visible).toBe(true);
  await emit('keyboardDidHide'); expect(visible).toBe(false);
});

test('repeated opening and closing follows keyboard events instead of text-field focus', async () => {
  await mount(); expect(visible).toBe(false);
  for (let cycle = 0; cycle < 3; cycle++) {
    await emit('keyboardDidShow'); expect(visible).toBe(true);
    await emit('keyboardDidHide'); expect(visible).toBe(false);
  }
});

test('iOS hides the dock as the keyboard starts opening and restores it after closing', async () => {
  Platform.OS = 'ios'; await mount();
  await emit('keyboardWillShow'); expect(visible).toBe(true);
  await emit('keyboardDidShow'); expect(visible).toBe(true);
  await emit('keyboardWillHide'); expect(visible).toBe(true);
  await emit('keyboardDidHide'); expect(visible).toBe(false);
});

test('returning from the background reconciles a missed keyboard-close event', async () => {
  await mount(); await emit('keyboardDidShow'); expect(visible).toBe(true);
  Keyboard.isVisible.mockReturnValue(false);
  await act(async () => appState('active')); expect(visible).toBe(false);
});

test('unmounting removes both keyboard and app-state subscriptions', async () => {
  await mount(); await act(async () => tree.unmount()); tree = null;
  removers.forEach(remove => expect(remove).toHaveBeenCalledTimes(1));
  expect(removeAppState).toHaveBeenCalledTimes(1);
});
