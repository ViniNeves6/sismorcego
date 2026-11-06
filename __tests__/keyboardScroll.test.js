import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { Keyboard, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, TextInput } from 'react-native';
import KeyboardScrollView from '../src/ui/KeyboardScrollView';
import App from '../App';

let mockReduceMotion = false;
jest.mock('../src/ui/useReduceMotion', () => () => mockReduceMotion);
jest.mock('../src/navigation', () => 'Navigation');
jest.mock('../src/database/db', () => ({ initDB: jest.fn() }));
jest.mock('../src/hooks/useAuth', () => ({ AuthProvider: ({ children }) => children }));
jest.mock('../src/hooks/useAccessibility', () => ({ AccessibilityProvider: ({ children }) => children }));
jest.mock('../src/theme/ThemeProvider', () => ({ ThemeProvider: ({ children }) => children }));
jest.mock('../src/ui', () => ({ ToastProvider: ({ children }) => children }));
jest.mock('react-native-safe-area-context', () => ({ SafeAreaProvider: ({ children }) => children }));

let tree, listeners, focused, fieldFrame, viewportFrame, removers;
const native = () => tree.root.findByType(ScrollView);
const flush = async () => act(async () => { await jest.advanceTimersByTimeAsync(100); });
const show = async () => act(async () => listeners.keyboardDidShow({ endCoordinates: { screenY: 500, height: 300 } }));
const mount = async props => act(async () => { tree = TestRenderer.create(<KeyboardScrollView {...props} />); });
const focus = async () => act(async () => native().props.onFocus({ nativeEvent: {} }));
beforeEach(() => {
  jest.clearAllMocks();
  jest.useFakeTimers(); listeners = {}; removers = []; mockReduceMotion = false;
  fieldFrame = [20, 650, 280, 48]; viewportFrame = [0, 100, 320, 400];
  focused = { measureInWindow: callback => callback(...fieldFrame) };
  jest.spyOn(Keyboard, 'metrics').mockReturnValue(undefined);
  jest.spyOn(Keyboard, 'addListener').mockImplementation((name, callback) => {
    listeners[name] = callback; const remove = jest.fn(); removers.push(remove); return { remove };
  });
  jest.spyOn(TextInput.State, 'currentlyFocusedInput').mockImplementation(() => focused);
  jest.spyOn(ScrollView.prototype, 'measureInWindow').mockImplementation(callback => callback(...viewportFrame));
  jest.spyOn(ScrollView.prototype, 'scrollTo').mockImplementation(() => {});
});
afterEach(async () => { if (tree) await act(async () => tree.unmount()); tree = null; jest.restoreAllMocks(); jest.useRealTimers(); });

test('opening the keyboard reveals a bottom field with clearance above the keyboard', async () => {
  await mount(); await focus();
  await act(async () => native().props.onScroll({ nativeEvent: { contentOffset: { y: 200 } } }));
  await show(); await flush();
  expect(ScrollView.prototype.scrollTo).toHaveBeenCalledWith({ y: 414, animated: true });
});

test('an already resized viewport and an already visible field need no second adjustment', async () => {
  fieldFrame = [20, 430, 280, 48];
  await mount(); await focus(); await show(); await flush();
  expect(ScrollView.prototype.scrollTo).not.toHaveBeenCalled();
});

test('focus changes while the keyboard is open reveal the next field and respect reduced motion', async () => {
  mockReduceMotion = true;
  Keyboard.metrics.mockReturnValue({ screenY: 500 });
  await mount(); await focus(); await flush();
  expect(ScrollView.prototype.scrollTo).toHaveBeenLastCalledWith({ y: 214, animated: false });
  fieldFrame = [20, 720, 280, 48];
  focused = { measureInWindow: callback => callback(...fieldFrame) };
  await focus(); await flush();
  expect(ScrollView.prototype.scrollTo).toHaveBeenLastCalledWith({ y: 284, animated: false });
});

test('a field above the viewport can be revealed without producing a negative scroll offset', async () => {
  fieldFrame = [20, 70, 280, 48];
  await mount(); await focus(); await show(); await flush();
  expect(ScrollView.prototype.scrollTo).toHaveBeenLastCalledWith({ y: 0, animated: true });
});

test.each(['hide', 'blur', 'drag', 'other-input', 'unmount'])('%s cancels a delayed reveal instead of moving an inactive form', async action => {
  await mount(); await focus(); await show();
  await act(async () => {
    if (action === 'hide') listeners.keyboardDidHide();
    else if (action === 'blur') native().props.onBlur({});
    else if (action === 'drag') native().props.onScrollBeginDrag({});
    else if (action === 'other-input') focused = { measureInWindow: jest.fn() };
    else { tree.unmount(); tree = null; }
  });
  await flush();
  expect(ScrollView.prototype.scrollTo).not.toHaveBeenCalled();
  if (action === 'unmount') removers.forEach(remove => expect(remove).toHaveBeenCalled());
});

test('forwards form callbacks and the native scroll ref', async () => {
  const callbacks = { onFocus: jest.fn(), onBlur: jest.fn(), onLayout: jest.fn(), onScroll: jest.fn(), onContentSizeChange: jest.fn(), onScrollBeginDrag: jest.fn() };
  const ref = React.createRef();
  await mount({ ...callbacks, ref });
  await act(async () => {
    native().props.onFocus({}); native().props.onBlur({}); native().props.onLayout({});
    native().props.onScroll({ nativeEvent: { contentOffset: { y: 150 } } });
    native().props.onContentSizeChange(320, 1200); native().props.onScrollBeginDrag({});
  });
  Object.values(callbacks).forEach(callback => expect(callback).toHaveBeenCalledTimes(1));
  expect(ref.current).toBe(native().instance);
});

test('a measurement finishing after focus moves to another form cannot scroll the previous form', async () => {
  let finishMeasure;
  focused.measureInWindow = callback => { finishMeasure = callback; };
  await mount(); await focus(); await show(); await flush();
  expect(finishMeasure).toEqual(expect.any(Function));
  focused = { measureInWindow: jest.fn() };
  await act(async () => finishMeasure(...fieldFrame));
  expect(ScrollView.prototype.scrollTo).not.toHaveBeenCalled();
});

test.each(['android', 'ios'])('one application viewport restores its padding after the keyboard closes on %s', async os => {
  const original = Platform.OS;
  Platform.OS = os;
  try {
    await act(async () => { tree = TestRenderer.create(<App />); });
    expect(tree.root.findAllByType(KeyboardAvoidingView)).toHaveLength(1);
    const viewport = () => tree.root.findByType(KeyboardAvoidingView);
    expect(viewport().props.behavior).toBe('padding');
    await act(async () => viewport().instance._onKeyboardChange({ duration: 0, endCoordinates: { screenY: 500, height: 300 } }));
    expect(viewport().props.enabled).toBe(os === 'ios');
    await act(async () => viewport().instance._onKeyboardHide({ duration: 0, endCoordinates: { screenY: 780, height: 0 } }));
    expect(viewport().props.enabled).toBe(os === 'ios');
  } finally { Platform.OS = original; }
});

test.each(['native-resize', 'edge-to-edge'])('Android returns to full height after repeated keyboard cycles with %s', async mode => {
  const original = Platform.OS; Platform.OS = 'android';
  try {
    await act(async () => { tree = TestRenderer.create(<App />); });
    const viewport = () => tree.root.findByType(KeyboardAvoidingView);
    const instance = viewport().instance;
    const layout = height => instance._onLayout({ persist: jest.fn(), nativeEvent: { layout: { x: 0, y: 0, width: 360, height } } });
    const padding = () => StyleSheet.flatten(instance.render().props.style);
    await act(async () => layout(800));
    for (let cycle = 0; cycle < 3; cycle++) {
      const opened = { duration: 0, endCoordinates: { screenY: 500, height: 300 } };
      await act(async () => { instance._onKeyboardChange(opened); });
      await act(async () => layout(mode === 'native-resize' ? 500 : 800));
      expect(padding()).toMatchObject({ flex: 1, paddingBottom: 0 });
      expect(padding().height).toBeUndefined();
      // Android may restore the window before emitting hide, with screenY
      // excluding the system bar. Neither ordering nor that inset may stick.
      await act(async () => layout(800));
      const closed = { duration: 0, endCoordinates: { screenY: 780, height: 0 } };
      await act(async () => { instance._onKeyboardHide(closed); });
      expect(padding()).toMatchObject({ flex: 1, paddingBottom: 0 });
      expect(padding().height).toBeUndefined();
      expect(viewport().props.enabled).toBe(false);
    }
  } finally { Platform.OS = original; }
});
