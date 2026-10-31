import React from 'react';
import Renderer, { act } from 'react-test-renderer';
import { AccessibilityInfo, Text as NativeText } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import useAccessibility, { AccessibilityProvider } from '../src/hooks/useAccessibility';
import { Animated } from '../src/ui/AccessibleNative';
import HowToModal from '../src/ui/HowToModal';
import { ReporterModal, ThemedInfoModal } from '../src/ui/ThemedDialogs';
import BottomSheetModal from '../src/ui/BottomSheetModal';
import RegistrosScreen from '../src/pages/Main/RegistrosScreen';
import AdminAlertsScreen from '../src/pages/Admin/AdminAlertsScreen';
import MaisScreens from '../src/pages/Extras/MaisScreens';
import AuthStack from '../src/navigation/AuthStack';

jest.mock('../src/services/redesignData', () => ({}));
jest.mock('../src/services/deviceCapture', () => ({ pickRegistroPhoto: jest.fn() }));
jest.mock('../src/pages/Auth/Login', () => 'Login');
jest.mock('../src/pages/Auth/Cadastro', () => 'Cadastro');
jest.mock('../src/pages/Auth/EsqueciSenha', () => 'EsqueciSenha');
jest.mock('@react-navigation/native-stack', () => ({ createNativeStackNavigator: () => ({ Navigator: 'StackNavigator', Screen: 'StackScreen' }) }));
jest.mock('react-native-linear-gradient', () => 'LinearGradient');
jest.mock('react-native-svg', () => ({ __esModule: true, default: 'Svg', Path: 'Path', Circle: 'Circle', Rect: 'Rect', Text: 'SvgText', Line: 'Line', Polyline: 'Polyline' }));

let tree, api, animations, loops;
function Probe() { api = useAccessibility(); return null; }
const wrap = children => <AccessibilityProvider><Probe />{children}</AccessibilityProvider>;
const mount = async (children, reduceMotion = true) => {
  await AsyncStorage.setItem('@sismorcego:accessibility', JSON.stringify({ reduceMotion }));
  await act(async () => { tree = Renderer.create(wrap(null)); });
  await act(async () => tree.update(wrap(children)));
};
const press = async label => {
  const button = tree.root.findAll(node => typeof node.props.onPress === 'function').find(node =>
    node.props.accessibilityLabel === label || node.findAllByType(NativeText).some(text => text.props.children === label));
  expect(button).toBeTruthy(); await act(async () => button.props.onPress());
};
beforeEach(() => {
  animations = []; loops = []; jest.useFakeTimers();
  jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(false);
  jest.spyOn(Animated, 'timing').mockImplementation((value, config) => {
    const animation = { value, config, start: jest.fn(), stop: jest.fn() };
    animations.push(animation); return animation;
  });
  jest.spyOn(Animated, 'loop').mockImplementation(() => {
    const loop = { start: jest.fn(), stop: jest.fn() }; loops.push(loop); return loop;
  });
});
afterEach(async () => {
  if (tree) await act(async () => tree.unmount()); tree = null;
  await AsyncStorage.clear(); jest.restoreAllMocks(); jest.useRealTimers();
});

test.each([
  ['help', visible => <HowToModal visible={visible} reduceMotion={false} />],
  ['reporter', visible => <ReporterModal visible={visible} reduceMotion={false} />],
  ['info', visible => <ThemedInfoModal visible={visible} reduceMotion={false} title="Informação" message="Orientação" />],
  ['sheet', visible => <BottomSheetModal visible={visible} reduceMotion={false} title="Município" options={['Belém']} />],
])('app preference opens and closes %s without motion even when its explicit prop is false', async (_, popup) => {
  await mount(popup(true)); expect(tree.toJSON()).not.toBeNull(); expect(animations).toHaveLength(0);
  await act(async () => tree.update(wrap(popup(false))));
  expect(tree.toJSON()).toBeNull(); expect(animations).toHaveLength(0);
});

test('changing reduced motion while filters animate cancels their running animations', async () => {
  await mount(<><RegistrosScreen /><AdminAlertsScreen /></>, false);
  const filters = animations.filter(animation => animation.config.duration === 450);
  expect(filters).toHaveLength(6);
  await act(async () => api.updateSettings({ reduceMotion: true }));
  expect(filters.every(animation => animation.stop.mock.calls.length > 0)).toBe(true);
  const count = animations.length;
  await press('Pendentes'); await press('Não lidos');
  expect(animations).toHaveLength(count);
  await act(async () => api.updateSettings({ reduceMotion: false }));
  expect(animations.length).toBeGreaterThan(count);
});

test('native authentication navigation switches motion off and restores it when requested', async () => {
  await mount(<AuthStack />);
  expect(tree.root.findByType('StackNavigator').props.screenOptions.animation).toBe('none');
  await act(async () => api.updateSettings({ reduceMotion: false }));
  expect(tree.root.findByType('StackNavigator').props.screenOptions.animation).toBe('slide_from_right');
  await act(async () => api.updateSettings({ reduceMotion: true }));
  expect(tree.root.findByType('StackNavigator').props.screenOptions.animation).toBe('none');
});

test('question bubble stops floating as soon as reduced motion becomes effective', async () => {
  await mount(<MaisScreens activeSubscreen="sub-faq" doubts={[]} doubtsView="list" />, false);
  expect(loops).toHaveLength(1); expect(loops[0].start).toHaveBeenCalled();
  await act(async () => api.updateSettings({ reduceMotion: true }));
  expect(loops[0].stop).toHaveBeenCalled();
});
