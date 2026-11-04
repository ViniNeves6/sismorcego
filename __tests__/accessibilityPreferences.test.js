import React from 'react';
import Renderer, { act } from 'react-test-renderer';
import { AccessibilityInfo, AppState, TextInput as NativeInput } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Tts from 'react-native-tts';
import useAccessibility, { AccessibilityProvider, normalizeAccessibilitySettings } from '../src/hooks/useAccessibility';
import useSpeakOnMount from '../src/hooks/useSpeakOnMount';
import { FontTextInput } from '../src/ui/FontText';
import { ScreenTransitionReadyContext } from '../src/ui/ScreenTransitionContext';
import useReduceMotion from '../src/ui/useReduceMotion';

const KEY = '@sismorcego:accessibility';
const deferred = () => { let resolve, reject; const promise = new Promise((done, fail) => { resolve = done; reject = fail; }); return { promise, resolve, reject }; };
let tree, api, appChange, motionChange, motion;
function Probe() { api = useAccessibility(); motion = useReduceMotion(); return null; }
function Region({ text, priority = 0, active = true }) { useSpeakOnMount(text, { priority, active }); return null; }
const render = async children => act(async () => { tree = Renderer.create(<AccessibilityProvider><Probe />{children}</AccessibilityProvider>); });
const update = async children => act(async () => tree.update(<AccessibilityProvider><Probe />{children}</AccessibilityProvider>));
const tick = async () => act(async () => { jest.advanceTimersByTime(100); });

beforeEach(async () => {
  jest.useFakeTimers(); jest.clearAllMocks(); await AsyncStorage.clear();
  Tts.getInitStatus.mockResolvedValue(true); Tts.setDefaultLanguage.mockResolvedValue(); Tts.speak.mockResolvedValue();
  jest.spyOn(AppState, 'addEventListener').mockImplementation((event, callback) => { appChange = callback; return { remove: jest.fn() }; });
  jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(false);
  jest.spyOn(AccessibilityInfo, 'addEventListener').mockImplementation((event, callback) => { motionChange = callback; return { remove: jest.fn() }; });
});
afterEach(async () => {
  if (tree) await act(async () => tree.unmount()); tree = null;
  jest.restoreAllMocks(); jest.useRealTimers(); await AsyncStorage.clear();
});

test('normalizes damaged saved preferences and clamps legacy text sizes', () => {
  expect(normalizeAccessibilitySettings({ fontScale: 'not a number', highContrast: 'false', ttsEnabled: 1 })).toEqual({ fontScale: 1, highContrast: false, ttsEnabled: false, reduceMotion: false });
  expect(normalizeAccessibilitySettings({ fontScale: 10 }).fontScale).toBe(2);
  expect(normalizeAccessibilitySettings({ fontScale: 0.1 }).fontScale).toBe(0.8);
});

test('hydrates before merging concurrent changes, then persists their combined state', async () => {
  const storage = deferred(); AsyncStorage.getItem.mockReturnValueOnce(storage.promise);
  await render();
  let contrast, font;
  await act(async () => {
    contrast = api.updateSettings({ highContrast: true });
    font = api.increaseFont();
    storage.resolve(JSON.stringify({ fontScale: 1.1, reduceMotion: true }));
    await Promise.all([contrast, font]);
  });
  expect(api).toMatchObject({ highContrast: true, fontScale: 1.2, reduceMotion: true });
  expect(JSON.parse(await AsyncStorage.getItem(KEY))).toMatchObject({ highContrast: true, fontScale: 1.2, reduceMotion: true });
});

test('a failed save restores the last persisted settings and reports the error', async () => {
  await render();
  await act(async () => api.updateSettings({ fontScale: 1.15 }));
  AsyncStorage.setItem.mockRejectedValueOnce(new Error('disk full'));
  await act(async () => { await expect(api.updateSettings({ highContrast: true })).rejects.toThrow('Não foi possível salvar'); });
  expect(api).toMatchObject({ highContrast: false, fontScale: 1.15 });
});

test('OS reduced motion stays effective when the app preference is disabled', async () => {
  await render();
  await act(async () => motionChange(true));
  expect(motion).toBe(true); expect(api.settings).toMatchObject({ systemReduceMotion: true, preferredReduceMotion: false });
  await act(async () => api.updateSettings({ reduceMotion: true }));
  await act(async () => api.updateSettings({ reduceMotion: false }));
  expect(motion).toBe(true);
  await act(async () => motionChange(false)); expect(motion).toBe(false);
});

test('modal speech takes priority, resumes the visible page, and stops when muted', async () => {
  await render(<Region text="Painel. Total de registros: 3" />);
  await tick(); expect(Tts.speak).not.toHaveBeenCalled();
  await act(async () => api.updateSettings({ ttsEnabled: true })); await tick();
  expect(Tts.speak).toHaveBeenLastCalledWith('Painel. Total de registros: 3');
  await update(<><Region text="Painel. Total de registros: 3" /><Region text="Detalhes do registro. Agente: Ana" priority={20} /></>); await tick();
  expect(Tts.speak).toHaveBeenLastCalledWith('Detalhes do registro. Agente: Ana');
  await update(<Region text="Painel. Total de registros: 3" />); await tick();
  expect(Tts.speak).toHaveBeenLastCalledWith('Painel. Total de registros: 3');
  await act(async () => api.updateSettings({ ttsEnabled: false }));
  const count = Tts.speak.mock.calls.length;
  await update(<Region text="Alertas" />); await tick(); expect(Tts.speak).toHaveBeenCalledTimes(count);
  expect(Tts.stop).toHaveBeenCalled();
});

test('waits for screen entry, ignores hidden regions, and cancels scheduled speech in background', async () => {
  await render(<ScreenTransitionReadyContext.Provider value={false}><Region text="Tela anterior" /></ScreenTransitionReadyContext.Provider>);
  await act(async () => api.updateSettings({ ttsEnabled: true })); await tick();
  expect(Tts.speak).not.toHaveBeenCalled();
  await update(<><Region text="Tela pronta" /><Region text="Oculta" priority={100} active={false} /></>);
  await act(async () => appChange('background')); await tick(); expect(Tts.speak).not.toHaveBeenCalled();
  await act(async () => appChange('active')); await tick(); expect(Tts.speak).toHaveBeenLastCalledWith('Tela pronta');
  await update(<Region text="Não ler depois de desmontar" />);
  await act(async () => tree.unmount()); tree = null; const count = Tts.speak.mock.calls.length;
  await tick(); expect(Tts.speak).toHaveBeenCalledTimes(count);
});

test('enabling waits for voice initialization and can be canceled while pending', async () => {
  await render(); const init = deferred(); Tts.getInitStatus.mockReturnValueOnce(init.promise);
  let enabling;
  await act(async () => { enabling = api.toggleTTS(true); });
  expect(api.ttsInitializing).toBe(true); expect(api.ttsEnabled).toBe(false);
  await act(async () => api.toggleTTS(false));
  await act(async () => { init.resolve(true); await enabling; });
  expect(api.ttsEnabled).toBe(false); expect(api.ttsInitializing).toBe(false);
});

test('missing voice engine leaves the switch off and exposes a useful message', async () => {
  await render(); Tts.getInitStatus.mockRejectedValueOnce({ code: 'no_engine' });
  await act(async () => { await expect(api.toggleTTS(true)).rejects.toThrow('Não há um mecanismo'); });
  expect(api.ttsEnabled).toBe(false); expect(api.ttsError).toContain('Não há um mecanismo');
  await act(async () => api.toggleTTS(true)); expect(api.ttsEnabled).toBe(true); expect(api.ttsError).toBeNull();
});

test('focusing a password reads only its label, including when the password is revealed', async () => {
  const onFocus = jest.fn();
  await render(<FontTextInput accessibilityLabel="Nova senha" value="Segredo123" secureTextEntry onFocus={onFocus} />);
  await act(async () => api.toggleTTS(true));
  await act(async () => tree.root.findByType(NativeInput).props.onFocus({}));
  expect(Tts.speak).toHaveBeenLastCalledWith('Nova senha'); expect(onFocus).toHaveBeenCalledTimes(1);
  await update(<FontTextInput accessibilityLabel="Nova senha" value="Segredo123" secureTextEntry={false} />);
  await act(async () => tree.root.findByType(NativeInput).props.onFocus({}));
  expect(Tts.speak.mock.calls.every(([text]) => !text.includes('Segredo123'))).toBe(true);
});
