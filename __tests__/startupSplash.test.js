import React from 'react';
import Renderer, { act } from 'react-test-renderer';
import { ActivityIndicator, Animated, BackHandler, Image, Modal, StyleSheet, View } from 'react-native';
import StartupSplash, { MIN_SPLASH_MS, SPLASH_FADE_MS } from '../src/navigation/StartupSplash';
import Navigation from '../src/navigation';
import { SCREEN_FADE_IN_MS, SCREEN_FADE_OUT_MS, screenFadeTiming } from '../src/ui/screenFade';

let mockAuth, mockReducedMotion = false, mockColors, mockHomologation = false;
jest.mock('../src/services/appEnvironment', () => ({ get REAL_FIREBASE_HOMOLOGATION() { return mockHomologation; } }));
jest.mock('../src/hooks/useAuth', () => () => mockAuth);
jest.mock('../src/ui/useReduceMotion', () => () => mockReducedMotion);
jest.mock('../src/hooks/useSpeakOnMount', () => jest.fn());
jest.mock('../src/navigation/BatSwarm', () => 'BatSwarm');
jest.mock('../src/navigation/SismorcegoShell', () => 'SismorcegoShell');
jest.mock('../src/navigation/AuthStack', () => 'AuthStack');
jest.mock('../src/theme/ThemeProvider', () => ({ useTheme: () => ({ colors: mockColors }), makeNavigationTheme: () => ({}) }));
jest.mock('@react-navigation/native', () => ({ NavigationContainer: 'NavigationContainer' }));
jest.mock('@react-navigation/native-stack', () => ({ createNativeStackNavigator: () => ({
  Navigator: ({ children }) => children,
  Screen: ({ component: Component, children }) => Component ? <Component /> : children({}),
}) }));

let tree, animations, back, removeBack, onExited;
const render = async element => act(async () => { tree = Renderer.create(element); });
const update = async element => act(async () => tree.update(element));
const tick = async ms => act(async () => { jest.advanceTimersByTime(ms); });
const fade = () => animations.filter(animation => animation.config.toValue === 0).at(-1);
const finish = async animation => act(async () => animation.finish());
const splashLayer = () => tree.root.findAllByType(View).find(node => node.props.testID === 'startup-splash');
beforeEach(() => {
  jest.useFakeTimers(); animations = []; mockReducedMotion = false; mockHomologation = false;
  mockColors = { brandDeep: '#2E1065', onBrand: '#FFFFFF', canvas: '#FFFFFF' };
  mockAuth = { user: null, loading: false }; onExited = jest.fn(); removeBack = jest.fn();
  jest.spyOn(BackHandler, 'addEventListener').mockImplementation((event, callback) => { back = callback; return { remove: removeBack }; });
  jest.spyOn(Animated, 'timing').mockImplementation((value, config) => {
    let completion;
    const animation = { value, config, stop: jest.fn(),
      start(callback) { completion = callback; animations.push(animation); },
      finish() { value.setValue(config.toValue); completion?.({ finished: true }); },
    };
    return animation;
  });
});
afterEach(async () => {
  if (tree) await act(async () => tree.unmount()); tree = null;
  jest.clearAllTimers(); jest.restoreAllMocks(); jest.useRealTimers();
});

test('restores the original violet canvas, centered 120 x 95 logo and automatic swarm with a short entrance', async () => {
  await render(<StartupSplash ready onExited={onExited} />);
  expect(StyleSheet.flatten(splashLayer().props.style).backgroundColor).toBe('#2E1065');
  const logo = tree.root.findByType(Image);
  expect(StyleSheet.flatten(logo.props.style)).toMatchObject({ width: 120, height: 95, tintColor: '#FFFFFF' });
  const stage = tree.root.findAllByType(View).find(node => StyleSheet.flatten(node.props.style)?.justifyContent === 'center');
  expect(StyleSheet.flatten(stage.props.style).alignItems).toBe('center');
  expect(tree.root.findByType('BatSwarm').props.reduced).toBe(false);
  expect(animations[0].config).toMatchObject({ toValue: 1, duration: 150, useNativeDriver: true });
  expect(tree.root.findAll(node => typeof node.props.onPress === 'function')).toHaveLength(0);
});

test('keeps the complete splash mounted for 2900 ms and until its 250 ms fade finishes', async () => {
  await render(<StartupSplash ready onExited={onExited} />);
  await tick(MIN_SPLASH_MS - 1); expect(fade()).toBeUndefined(); expect(onExited).not.toHaveBeenCalled();
  await tick(1);
  expect(fade().config).toMatchObject({ duration: SPLASH_FADE_MS, toValue: 0, useNativeDriver: true });
  await act(async () => fade().value.setValue(0.5));
  expect(splashLayer()).toBeTruthy(); expect(tree.root.findByType(Image)).toBeTruthy();
  expect(onExited).not.toHaveBeenCalled();
  await finish(fade()); expect(onExited).toHaveBeenCalledTimes(1);
});

test('waits for authentication if it takes longer than the minimum duration', async () => {
  await render(<StartupSplash ready={false} onExited={onExited} />);
  await tick(10000); expect(fade()).toBeUndefined();
  await update(<StartupSplash ready onExited={onExited} />);
  expect(fade()).toBeTruthy(); await finish(fade()); expect(onExited).toHaveBeenCalledTimes(1);
});

test('auth becoming busy during the exit cancels it and ignores a stale completion', async () => {
  await render(<StartupSplash ready onExited={onExited} />); await tick(MIN_SPLASH_MS);
  const abandoned = fade(); await act(async () => abandoned.value.setValue(0.5));
  await update(<StartupSplash ready={false} onExited={onExited} />);
  expect(abandoned.stop).toHaveBeenCalled(); expect(abandoned.value.__getValue()).toBe(1);
  await finish(abandoned); expect(onExited).not.toHaveBeenCalled();
  await update(<StartupSplash ready onExited={onExited} />); await finish(fade());
  expect(onExited).toHaveBeenCalledTimes(1);
});

test('reduced motion preserves the minimum display time with no flight or fade', async () => {
  mockReducedMotion = true; await render(<StartupSplash ready onExited={onExited} />);
  expect(tree.root.findByType('BatSwarm').props.reduced).toBe(true); expect(animations).toHaveLength(0);
  await tick(MIN_SPLASH_MS - 1); expect(onExited).not.toHaveBeenCalled();
  await tick(1); expect(onExited).toHaveBeenCalledTimes(1); expect(animations).toHaveLength(0);
});

test('turning reduced motion on during exit stops the old fade and completes once', async () => {
  await render(<StartupSplash ready onExited={onExited} />); await tick(MIN_SPLASH_MS);
  const oldFade = fade(); mockReducedMotion = true;
  await update(<StartupSplash ready onExited={onExited} />);
  expect(oldFade.stop).toHaveBeenCalled(); expect(onExited).toHaveBeenCalledTimes(1);
  await finish(oldFade); expect(onExited).toHaveBeenCalledTimes(1);
});

test('high contrast retains the theme colors instead of forcing the violet palette', async () => {
  mockColors = { ...mockColors, brandDeep: '#000000', onBrand: '#FFD700' };
  await render(<StartupSplash ready onExited={onExited} />);
  expect(StyleSheet.flatten(splashLayer().props.style).backgroundColor).toBe('#000000');
  expect(StyleSheet.flatten(tree.root.findByType(Image).props.style).tintColor).toBe('#FFD700');
});

test('Android Back keeps its default exit action, with startup resources released on unmount', async () => {
  const setTimer = jest.spyOn(global, 'setTimeout');
  const clearTimer = jest.spyOn(global, 'clearTimeout');
  await render(<StartupSplash ready onExited={onExited} />);
  const minimumTimer = setTimer.mock.results[setTimer.mock.calls.findIndex(([, duration]) => duration === MIN_SPLASH_MS)].value;
  expect(back()).toBe(false); expect(onExited).not.toHaveBeenCalled();
  const entrance = animations[0]; await act(async () => tree.unmount()); tree = null;
  await tick(10000); expect(onExited).not.toHaveBeenCalled();
  expect(removeBack).toHaveBeenCalledTimes(1); expect(entrance.stop).toHaveBeenCalled();
  expect(clearTimer).toHaveBeenCalledWith(minimumTimer);
});

test('unmount during the fade cannot invoke a late navigation callback', async () => {
  await render(<StartupSplash ready onExited={onExited} />); await tick(MIN_SPLASH_MS);
  const exiting = fade(); await act(async () => tree.unmount()); tree = null;
  expect(exiting.stop).toHaveBeenCalled(); await finish(exiting); expect(onExited).not.toHaveBeenCalled();
});

test.each(['acs', 'coordenador'])('already authenticated %s still sees startup before the Shell can mount', async role => {
  mockAuth = { user: { uid: role }, role, loading: false };
  await render(<Navigation />);
  expect(splashLayer()).toBeTruthy(); expect(tree.root.findAllByType('SismorcegoShell')).toHaveLength(0);
  await tick(MIN_SPLASH_MS); expect(tree.root.findAllByType('SismorcegoShell')).toHaveLength(0);
  await act(async () => fade().value.setValue(0.4));
  expect(tree.root.findAllByType('SismorcegoShell')).toHaveLength(0);
  await finish(fade()); expect(tree.root.findAllByType('SismorcegoShell')).toHaveLength(1);
  expect(tree.root.findAllByType(StartupSplash)).toHaveLength(0); expect(removeBack).toHaveBeenCalled();
});

test('startup covers its artwork, prepares login layout, and reveals the same login instance with the guide fade', async () => {
  await render(<Navigation />);
  expect(tree.root.findAllByType('AuthStack')).toHaveLength(0);
  await tick(MIN_SPLASH_MS - 1); expect(loginCover()).toBeUndefined();
  await tick(1); expect(loginCover().config).toMatchObject({ duration: SCREEN_FADE_OUT_MS, toValue: 1 });
  await act(async () => loginCover().value.setValue(0.5));
  expect(tree.root.findAllByType(Image)).toHaveLength(1);
  expect(tree.root.findAllByType('AuthStack')).toHaveLength(0);
  await finish(loginCover());
  const login = tree.root.findByType('AuthStack');
  expect(tree.root.findAllByType(Image)).toHaveLength(0);
  expect(fade()).toBeUndefined();
  await tick(2000); expect(fade()).toBeUndefined();
  await layoutStartupLogin();
  expect(fade().config).toMatchObject({ duration: SCREEN_FADE_IN_MS, toValue: 0, useNativeDriver: true });
  await act(async () => fade().value.setValue(0.5));
  expect(tree.root.findByType('AuthStack')).toBe(login);
  expect(tree.root.findAllByType(View).some(node => node.props.importantForAccessibility === 'no-hide-descendants')).toBe(true);
  await finish(fade());
  expect(tree.root.findAllByType('AuthStack')).toHaveLength(1);
  expect(tree.root.findByType('AuthStack')).toBe(login);
  expect(tree.root.findAllByType('SismorcegoShell')).toHaveLength(0);
  expect(tree.root.findAllByType(StartupSplash)).toHaveLength(0);
  expect(tree.root.findAllByType(View).some(node => node.props.importantForAccessibility === 'no-hide-descendants')).toBe(false);
});

test('session restored after the timer enters the latest user route only after exit', async () => {
  mockAuth = { user: null, loading: true }; await render(<Navigation />); await tick(5000);
  expect(fade()).toBeUndefined(); expect(tree.root.findAllByType('NavigationContainer')).toHaveLength(0);
  mockAuth = { user: { uid: 'restored' }, loading: false }; await update(<Navigation />);
  expect(tree.root.findAllByType('SismorcegoShell')).toHaveLength(0);
  await finish(fade()); expect(tree.root.findAllByType('SismorcegoShell')).toHaveLength(1);
});

test('login, logout and a later auth refresh do not replay startup; a fresh root does', async () => {
  await completeStartup();
  mockAuth = { user: { uid: 'signed-in' }, loading: false }; await update(<Navigation />);
  expect(tree.root.findAllByType('SismorcegoShell')).toHaveLength(1);
  mockAuth = { user: null, loading: true }; await update(<Navigation />);
  expect(tree.root.findAllByType(ActivityIndicator)).toHaveLength(1); expect(tree.root.findAllByType(StartupSplash)).toHaveLength(0);
  mockAuth.loading = false; await update(<Navigation />);
  expect(tree.root.findAllByType('AuthStack')).toHaveLength(1);
  await act(async () => tree.unmount()); tree = null;
  await render(<Navigation />); expect(splashLayer()).toBeTruthy(); expect(tree.root.findAllByType('AuthStack')).toHaveLength(0);
});

const completeStartup = async () => {
  await render(<Navigation />); await tick(MIN_SPLASH_MS);
  if (tree.root.findAllByType(StartupSplash).length === 0) return;
  if (tree.root.findByType(StartupSplash).props.screenTransition) {
    await finish(loginCover()); await layoutStartupLogin();
  }
  await finish(fade());
};
const layoutStartupLogin = async () => act(async () => tree.root.findAllByType(View)
  .find(node => node.props.testID === 'startup-login-layout').props.onLayout());
const authenticate = async (uid = 'signed-in', role = 'acs') => {
  mockAuth = { user: { uid }, role, loading: false }; await update(<Navigation />);
};
const loginCover = () => animations.filter(animation => animation.config.toValue === 1 && animation.config.duration === SCREEN_FADE_OUT_MS).at(-1);
const revealLogin = async () => finish(loginCover());

test('a delayed unauthenticated auth check still waits for the mounted login layout before revealing it', async () => {
  mockAuth = { user: null, loading: true }; await render(<Navigation />); await tick(5000);
  expect(loginCover()).toBeUndefined(); expect(tree.root.findAllByType('AuthStack')).toHaveLength(0);
  mockAuth.loading = false; await update(<Navigation />); await finish(loginCover());
  expect(tree.root.findAllByType('AuthStack')).toHaveLength(1); expect(fade()).toBeUndefined();
  await layoutStartupLogin(); await finish(fade());
  expect(tree.root.findAllByType('AuthStack')).toHaveLength(1);
});

test('auth changing during the initial login reveal cancels it and enters only the restored user route', async () => {
  await render(<Navigation />); await tick(MIN_SPLASH_MS); await finish(loginCover());
  await layoutStartupLogin(); const oldReveal = fade();
  mockAuth = { user: null, loading: true }; await update(<Navigation />);
  expect(oldReveal.stop).toHaveBeenCalled();
  await finish(oldReveal);
  expect(tree.root.findAllByType('AuthStack')).toHaveLength(0);
  expect(tree.root.findAllByType(StartupSplash)).toHaveLength(1);
  mockAuth = { user: { uid: 'restored' }, loading: false }; await update(<Navigation />);
  expect(tree.root.findAllByType('SismorcegoShell')).toHaveLength(0);
  await finish(fade()); expect(tree.root.findAllByType('SismorcegoShell')).toHaveLength(1);
  expect(tree.root.findAllByType('AuthStack')).toHaveLength(0);
});

test('reduced motion enters login automatically after the startup minimum without waiting for a fade layout', async () => {
  mockReducedMotion = true; await render(<Navigation />);
  await tick(MIN_SPLASH_MS - 1); expect(tree.root.findAllByType('AuthStack')).toHaveLength(0);
  await tick(1); expect(tree.root.findAllByType('AuthStack')).toHaveLength(1);
  expect(tree.root.findAllByType(StartupSplash)).toHaveLength(0); expect(animations).toHaveLength(0);
});

test('startup screen transition uses the screen fade without fading elevated cards or removing the old artwork before cover completion', async () => {
  await render(<StartupSplash ready screenTransition onExited={onExited} />); await tick(MIN_SPLASH_MS);
  const cover = loginCover();
  for (const progress of [0.1, 0.5, 0.9]) {
    await act(async () => cover.value.setValue(progress));
    const opacity = StyleSheet.flatten(splashLayer().props.style).opacity;
    expect(opacity.__getValue ? opacity.__getValue() : opacity).toBe(1);
    expect(tree.root.findAllByType(Image)).toHaveLength(1); expect(onExited).not.toHaveBeenCalled();
  }
  expect(cover.config.easing(0.4)).toBeCloseTo(screenFadeTiming(false).easing(0.4));
  await finish(cover);
  expect(tree.root.findAllByType(Image)).toHaveLength(0);
  expect(StyleSheet.flatten(splashLayer().props.style).backgroundColor).toBe('#FFFFFF');
  expect(fade().config).toMatchObject({ duration: SCREEN_FADE_IN_MS, useNativeDriver: true });
  expect(fade().config.easing(0.4)).toBeCloseTo(screenFadeTiming(true).easing(0.4));
  await finish(fade()); expect(onExited).toHaveBeenCalledTimes(1);
});

test.each(['cover', 'reveal'])('auth resuming during startup screen transition %s cancels it and ignores stale completions', async phase => {
  await render(<StartupSplash ready screenTransition onExited={onExited} />); await tick(MIN_SPLASH_MS);
  let old = loginCover();
  if (phase === 'reveal') { await revealLogin(); old = fade(); }
  await update(<StartupSplash ready={false} screenTransition onExited={onExited} />);
  expect(old.stop).toHaveBeenCalled(); await finish(old); expect(onExited).not.toHaveBeenCalled();
  expect(tree.root.findAllByType(Image)).toHaveLength(1);
  await update(<StartupSplash ready screenTransition onExited={onExited} />);
  await revealLogin(); await finish(fade()); expect(onExited).toHaveBeenCalledTimes(1);
});

test('startup screen transition high contrast uses a black transition cover', async () => {
  mockColors = { ...mockColors, canvas: '#000000', brandDeep: '#000000', onBrand: '#FFD700' };
  await render(<StartupSplash ready screenTransition onExited={onExited} />);
  const coverLayer = tree.root.findAllByProps({ testID: 'splash-screen-fade' })[0];
  expect(StyleSheet.flatten(coverLayer.props.style).backgroundColor).toBe('#000000');
  await tick(MIN_SPLASH_MS); await revealLogin();
  expect(StyleSheet.flatten(splashLayer().props.style).backgroundColor).toBe('#000000');
});

test.each([false, true])('login, signup, logout, profile and role updates never replay startup (homologation=%s)', async homologation => {
  mockHomologation = homologation; await completeStartup();
  const initialAnimations = animations.length;
  const noReplay = () => {
    expect(tree.root.findAllByType(StartupSplash)).toHaveLength(0);
    expect(tree.root.findAllByType(Modal)).toHaveLength(0);
    expect(animations).toHaveLength(initialAnimations);
  };
  await authenticate('login', 'acs'); noReplay();
  expect(tree.root.findAllByType('SismorcegoShell')).toHaveLength(1);
  mockAuth = { ...mockAuth, user: { uid: 'login', displayName: 'Updated' }, role: 'coordenador' };
  await update(<Navigation />); noReplay();
  for (const uid of ['login', 'newly-registered']) {
    mockAuth = { user: null, loading: false }; await update(<Navigation />); noReplay();
    expect(tree.root.findAllByType('AuthStack')).toHaveLength(1);
    await authenticate(uid); noReplay();
  }
  await tick(10000); noReplay();
});

test('reduced motion does not add a login cover, delay or Back-handler after startup', async () => {
  mockHomologation = true; mockReducedMotion = true; await completeStartup();
  const handlers = BackHandler.addEventListener.mock.calls.length;
  await authenticate();
  expect(tree.root.findAllByType(StartupSplash)).toHaveLength(0);
  expect(tree.root.findAllByType(Modal)).toHaveLength(0);
  expect(tree.root.findAllByType('SismorcegoShell')).toHaveLength(1);
  expect(animations).toHaveLength(0);
  expect(BackHandler.addEventListener).toHaveBeenCalledTimes(handlers);
});
