import { AppState, DeviceEventEmitter, Keyboard, NativeModules, Platform } from 'react-native';

let snapshot = { native: false, visible: false, transitioning: false, height: 0, keyboardTop: null };
const listeners = new Set();
let subscriptions = [], generation = 0, sequence = -1;
const bridge = () => Platform.OS === 'android' ? NativeModules.SismorcegoWindow : null;
function update(patch) {
  const next = { ...snapshot, ...patch };
  if (Object.keys(next).every(key => next[key] === snapshot[key])) return;
  snapshot = next; listeners.forEach(listener => listener());
}
function start() {
  const current = ++generation;
  const native = bridge();
  const reconcile = () => {
    if (native?.getSnapshot) native.getSnapshot().then(value => {
      if (current === generation) receive(value);
    }).catch(() => {});
    else update({ visible: Boolean(Keyboard.isVisible?.()), transitioning: false });
  };
  const receive = value => {
    if (!Number.isFinite(value?.sequence) || value.sequence < sequence) return;
    sequence = value.sequence;
    update({ native: true, visible: value.visible === true, transitioning: value.transitioning === true,
      height: Math.max(0, Number(value.height) || 0), keyboardTop: Number.isFinite(value.keyboardTop) ? value.keyboardTop : null });
  };
  if (native?.getSnapshot) {
    update({ native: true });
    subscriptions.push(DeviceEventEmitter.addListener('sismorcego:windowState', receive));
  } else {
    update({ native: false, visible: Boolean(Keyboard.isVisible?.()), transitioning: false, height: 0, keyboardTop: null });
    const shown = event => update({ visible: true, transitioning: false,
      height: event?.endCoordinates?.height || 0, keyboardTop: event?.endCoordinates?.screenY ?? null });
    subscriptions.push(
      Keyboard.addListener('keyboardDidShow', shown),
      Keyboard.addListener('keyboardDidHide', () => update({ visible: false, transitioning: false, height: 0, keyboardTop: null })),
    );
    if (Platform.OS === 'ios') subscriptions.push(
      Keyboard.addListener('keyboardWillShow', () => update({ visible: true, transitioning: true })),
      Keyboard.addListener('keyboardWillHide', () => update({ transitioning: true })),
    );
  }
  subscriptions.push(AppState.addEventListener('change', state => { if (state === 'active') reconcile(); }));
  reconcile();
}
export function subscribeKeyboard(listener) {
  listeners.add(listener);
  if (listeners.size === 1) start();
  return () => {
    listeners.delete(listener);
    if (!listeners.size) {
      generation += 1; subscriptions.forEach(subscription => subscription?.remove()); subscriptions = [];
    }
  };
}
export const getKeyboardSnapshot = () => snapshot;
