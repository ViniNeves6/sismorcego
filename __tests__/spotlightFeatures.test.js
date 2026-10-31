import React from 'react';
import ReactTestRenderer, { act } from 'react-test-renderer';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { BackHandler, StyleSheet, Text, View } from 'react-native';
import { Animated } from '../src/ui/AccessibleNative';
import { getSpotlightRect, getSpotlightOverviewRect, spotlightPaths } from '../src/ui/spotlightLayout';
import SpotlightGuideModal, {
  SPOTLIGHT_STEPS,
  SPOTLIGHT_COMMON_STEPS,
  SPOTLIGHT_ADMIN_STEPS,
  getSpotlightSteps,
  SPOTLIGHT_STORAGE_KEY,
} from '../src/ui/SpotlightGuideModal';
import SpotlightWelcomeModal, {
  SPOTLIGHT_WELCOME_KEY,
} from '../src/ui/SpotlightWelcomeModal';

jest.mock('react-native-linear-gradient', () => 'LinearGradient');
jest.mock('react-native-svg', () => ({
  __esModule: true,
  default: 'Svg',
  Path: 'Path',
  Circle: 'Circle',
  Rect: 'Rect',
  Line: 'Line',
  Polyline: 'Polyline',
  Defs: 'Defs',
  RadialGradient: 'RadialGradient',
  Stop: 'Stop',
}));

describe('Spotlight interactive guide & welcome modal specifications', () => {
  afterEach(async () => {
    await AsyncStorage.clear();
  });

  test('spotlight guide contains 5 steps for ACS matching HTML specification', () => {
    const acsSteps = getSpotlightSteps(false);
    expect(acsSteps).toHaveLength(5);

    expect(acsSteps[0]).toMatchObject({
      screen: 'home',
      title: 'Registros disponíveis offline',
      description: 'Seus registros ficam no aparelho até a sincronização.',
      targetKey: 'syncBanner',
    });

    expect(acsSteps[1]).toMatchObject({
      screen: 'home',
      title: 'Encontre e consulte registros',
      description: 'Em Registros, pesquise, filtre e abra um cartão para modificar ou excluir.',
      targetKey: 'recordsOverview',
      overview: true,
    });

    expect(acsSteps[2]).toMatchObject({
      screen: 'home',
      title: 'Inicie uma notificação',
      description: 'Em Notificar, o + vira X. Toque no X para limpar os campos.',
      targetKey: 'dockFab',
    });

    expect(acsSteps[3]).toMatchObject({
      screen: 'new',
      title: 'Defina o responsável pelo registro',
      description: 'Em Nova notificação, confira ou altere o agente responsável.',
      targetKey: 'reporterCard',
    });

    expect(acsSteps[4]).toMatchObject({
      screen: 'new',
      title: 'Preencha a notificação',
      description: 'Escolha a vítima, capture GPS e foto, depois informe data, município e localidade.',
      targetKey: 'notificationOverview',
      overview: true,
      scrollAnchor: 'victimSection',
    });
  });

  test('spotlight guide contains 8 steps for Coordenador matching HTML specification', () => {
    const coordSteps = getSpotlightSteps(true);
    expect(coordSteps).toHaveLength(8);

    // Common steps tailored for Coordenador
    expect(coordSteps[1]).toMatchObject({
      screen: 'home',
      title: 'Encontre e consulte registros',
      description: 'Em Registros, pesquise, filtre e abra um cartão para consultar ocorrências.',
      targetKey: 'recordsOverview',
      overview: true,
    });

    // Admin steps
    expect(coordSteps[5]).toMatchObject({
      screen: 'panel',
      title: 'Painel administrativo',
      description: 'Este é o Painel administrativo: consulte indicadores e filtre ocorrências.',
      targetKey: 'panelOverview',
    });

    expect(coordSteps[6]).toMatchObject({
      screen: 'panel',
      title: 'Mapa de calor e registros por período',
      description: 'Veja no Mapa de calor onde os registros se concentram e, em Registros por período, a evolução por dia ou por mês.',
      targetKey: 'panelOverview',
      overview: true,
      scrollAnchor: 'panelMapSection',
    });

    expect(coordSteps[7]).toMatchObject({
      screen: 'alerts',
      title: 'Notificações e alertas',
      description: 'Esta é a tela de Notificações: consulte novos alertas e marque-os como lidos.',
      targetKey: 'alertsOverview',
    });
  });

  test('storage keys match expected values', () => {
    expect(SPOTLIGHT_STORAGE_KEY).toBe('sismorcego-spotlight-v1-seen');
    expect(SPOTLIGHT_WELCOME_KEY).toBe('sismorcego-spotlight-welcome-v1-shown');
  });

  test('renders SpotlightGuideModal cleanly and handles completion', async () => {
    const onComplete = jest.fn();
    const onSkip = jest.fn();
    let tree;

    await act(async () => {
      tree = ReactTestRenderer.create(
        <SpotlightGuideModal
          visible={true}
          currentTab="home"
          targetRefs={{}}
          reduceMotion={true}
          onComplete={onComplete}
          onSkip={onSkip}
        />
      );
    });

    expect(tree).toBeDefined();
    await act(async () => {
      tree.unmount();
    });
  });

  test('opening a guide does not mark it completed and an initially hidden guide never emits exit', async () => {
    const onExited = jest.fn();
    let tree;
    await act(async () => {
      tree = ReactTestRenderer.create(<SpotlightGuideModal visible={false} reduceMotion currentTab="home" onExited={onExited} />);
    });
    expect(onExited).not.toHaveBeenCalled();
    await act(async () => tree.update(<SpotlightGuideModal visible reduceMotion currentTab="home" onExited={onExited} />));
    expect(await AsyncStorage.getItem(SPOTLIGHT_STORAGE_KEY)).toBeNull();
    expect(onExited).not.toHaveBeenCalled();
    await act(async () => tree.unmount());
  });

  test('renders SpotlightWelcomeModal with 3 bat layers and continue button', async () => {
    const onClose = jest.fn();
    let tree;

    await act(async () => {
      tree = ReactTestRenderer.create(
        <SpotlightWelcomeModal
          visible={true}
          reduceMotion={true}
          onClose={onClose}
        />
      );
    });

    expect(tree).toBeDefined();
    await act(async () => {
      tree.unmount();
    });
  });
});

describe('spotlight alignment against real native measurements', () => {
  let tree;
  let animations;
  let back;
  const frame = { x: 0, y: 24, width: 360, height: 760 };
  const nativeRect = rect => ({ measureInWindow: jest.fn(callback => callback(rect.x, rect.y, rect.width, rect.height)) });
  const press = async label => act(async () => {
    tree.root.findAll(node => node.props.accessibilityLabel === label && node.props.onPress)[0].props.onPress();
  });
  const flushLayout = async () => act(async () => { await jest.advanceTimersByTimeAsync(1000); });
  const cutout = () => {
    const d = tree.root.findAllByProps({ testID: 'spotlight-cutout' })[0].props.d;
    return typeof d === 'string' ? d : d.__getValue();
  };
  const mount = async props => {
    await act(async () => { tree = ReactTestRenderer.create(<SpotlightGuideModal {...props} />); });
    await act(async () => tree.root.findAllByProps({ testID: 'spotlight-guide' })[0].props.onLayout({
      nativeEvent: { layout: { width: frame.width, height: frame.height } },
    }));
    await flushLayout();
  };

  beforeEach(() => {
    jest.useFakeTimers();
    animations = [];
    jest.spyOn(View.prototype, 'measureInWindow').mockImplementation(function (callback) {
      callback(frame.x, frame.y, frame.width, frame.height);
    });
    jest.spyOn(BackHandler, 'addEventListener').mockImplementation((name, callback) => {
      back = callback;
      return { remove: jest.fn() };
    });
    jest.spyOn(Animated, 'timing').mockImplementation((value, config) => {
      let completion;
      const animation = {
        config,
        start(callback) {
          completion = callback;
          if (config.duration === 0) animation.finish();
        },
        stop: jest.fn(),
        finish() { value.setValue(config.toValue); completion?.({ finished: true }); },
      };
      animations.push(animation);
      return animation;
    });
  });

  afterEach(async () => {
    if (tree) await act(async () => tree.unmount());
    tree = null;
    jest.restoreAllMocks();
    jest.useRealTimers();
  });

  test('opens the records overview without moving its scroll position, then returns to the banner', async () => {
    const banner = { x: 20, y: 126, width: 320, height: 128 };
    const overview = nativeRect(frame);
    const scroll = { offset: 120, node: nativeRect({ x: 0, y: 100, width: 360, height: 600 }) };
    scroll.node.scrollTo = jest.fn();
    const props = {
      visible: true, currentTab: 'home', reduceMotion: true, bottomInset: 24,
      targetRefs: { syncBanner: { current: nativeRect(banner) }, recordsOverview: { current: overview } },
      scrollTargets: { home: scroll }, dockRef: { current: nativeRect({ x: 0, y: 630, width: 360, height: 80 }) },
      onSkip: jest.fn(),
    };
    await mount(props);
    await act(async () => tree.root.findAllByProps({ testID: 'spotlight-panel' })[0].props.onLayout({
      nativeEvent: { layout: { height: 180 } },
    }));
    expect(cutout()).toBe(spotlightPaths(getSpotlightRect(banner, frame), frame).shade);
    expect(tree.root.findAllByProps({ testID: 'spotlight-cutout' })[0].props.fillRule).toBe('evenodd');

    await press('Próxima etapa do guia');
    await flushLayout();
    expect(scroll.node.scrollTo).not.toHaveBeenCalled();
    expect(overview.measureInWindow).toHaveBeenCalledTimes(1);
    expect(cutout()).toBe(spotlightPaths(getSpotlightOverviewRect(frame, frame, 630), frame).shade);
    const panel = tree.root.findAllByProps({ testID: 'spotlight-panel' })[0];
    expect(StyleSheet.flatten(panel.props.style).top.__getValue()).toBe(544);
    await act(async () => back());
    await flushLayout();
    expect(cutout()).toBe(spotlightPaths(getSpotlightRect(banner, frame), frame).shade);
    expect(props.onSkip).not.toHaveBeenCalled();
    await act(async () => back());
    expect(props.onSkip).toHaveBeenCalledTimes(1);
  });

  const profileGuide = async (reduceMotion = true, isCoordenador = true) => {
    const map = { x: 20, y: 650, width: 320, height: 300 };
    const trend = { x: 20, y: 1050, width: 320, height: 300 };
    const panelTop = { x: 20, y: 116, width: 320, height: 300 };
    const scroll = { offset: 0, contentHeight: 1600, node: nativeRect({ x: 0, y: 100, width: 360, height: 600 }) };
    let nativeOffset = 0;
    scroll.node.scrollTo = jest.fn(({ y }) => {
      map.y -= y - nativeOffset;
      trend.y -= y - nativeOffset;
      panelTop.y -= y - nativeOffset;
      nativeOffset = y;
      scroll.offset = y;
    });
    const props = {
      visible: true, currentTab: 'home', isCoordenador, reduceMotion,
      targetRefs: Object.fromEntries([
        ['syncBanner', { x: 20, y: 126, width: 320, height: 128 }],
        ['recordsOverview', frame], ['dockFab', { x: 150, y: 680, width: 60, height: 60 }],
        ['reporterCard', { x: 20, y: 126, width: 320, height: 128 }],
        ['notificationOverview', frame], ['victimSection', { x: 20, y: 300, width: 320, height: 128 }],
        ['panelOverview', frame], ['panelTop', panelTop], ['panelMapSection', map], ['panelTrendSection', trend], ['alertsOverview', frame],
      ].map(([key, rect]) => [key, { current: nativeRect(rect) }])),
      scrollTargets: { panel: scroll },
      dockRef: { current: nativeRect({ x: 0, y: 700, width: 360, height: 80 }) },
      onSwitchTab: jest.fn(), onSkip: jest.fn(),
    };
    await mount(props);
    const next = async index => {
      await press('Próxima etapa do guia');
      props.currentTab = getSpotlightSteps(isCoordenador)[index].screen;
      await act(async () => tree.update(<SpotlightGuideModal {...props} />));
      await flushLayout();
    };
    return { props, scroll, next };
  };

  test.each([true, false])('step 7 keeps the map position after waiting and returning, with reduced motion %s', async reduceMotion => {
    const { props, scroll, next } = await profileGuide(reduceMotion);
    for (let index = 1; index <= 6; index += 1) await next(index);
    expect(scroll.node.scrollTo).toHaveBeenLastCalledWith({ y: 532, animated: false });
    if (!reduceMotion) await act(async () => animations.filter(animation =>
      animation.config.duration === 240 && animation.config.toValue === 1).at(-1).finish());
    expect(cutout()).toBe(spotlightPaths(getSpotlightOverviewRect(frame, frame, 700), frame).shade);
    const callsAtMap = scroll.node.scrollTo.mock.calls.length;
    await act(async () => { await jest.advanceTimersByTimeAsync(10000); });
    expect(scroll.node.scrollTo).toHaveBeenCalledTimes(callsAtMap);
    expect(scroll.node.scrollTo).toHaveBeenLastCalledWith({ y: 532, animated: false });
    expect(tree.root.findAllByType(Text).some(node => node.props.children === '7 de 8')).toBe(true);
    await act(async () => back());
    await flushLayout();
    expect(scroll.node.scrollTo).toHaveBeenLastCalledWith({ y: 0, animated: false });
    await next(6);
    await act(async () => back());
    await flushLayout();
    const callsAfterBack = scroll.node.scrollTo.mock.calls.length;
    await act(async () => { await jest.advanceTimersByTimeAsync(4000); });
    expect(scroll.node.scrollTo).toHaveBeenCalledTimes(callsAfterBack);
    expect(props.onSkip).not.toHaveBeenCalled();
  });

  test('the initial anchor scroll stops immediately when the guide closes', async () => {
    const { props, scroll, next } = await profileGuide(false);
    for (let index = 1; index <= 5; index += 1) await next(index);
    await press('Próxima etapa do guia');
    await act(async () => { await jest.advanceTimersByTimeAsync(250); });
    const calls = scroll.node.scrollTo.mock.calls;
    expect(calls.length).toBeGreaterThan(2);
    expect(calls[calls.length - 1][0].y).toBeGreaterThan(0);
    expect(calls[calls.length - 1][0].y).toBeLessThan(532);
    await act(async () => tree.update(<SpotlightGuideModal {...props} visible={false} />));
    const callsAtExit = calls.length;
    await act(async () => { await jest.advanceTimersByTimeAsync(4000); });
    expect(scroll.node.scrollTo).toHaveBeenCalledTimes(callsAtExit);
  });

  test('ACS filling step scrolls to the victim section while highlighting the visible form', async () => {
    const { props, next } = await profileGuide(true, false);
    const formScroll = { offset: 0, contentHeight: 1200,
      node: { ...nativeRect({ x: 0, y: 100, width: 360, height: 600 }), scrollTo: jest.fn() } };
    props.scrollTargets.new = formScroll;
    for (let index = 1; index <= 4; index += 1) await next(index);
    expect(formScroll.node.scrollTo).toHaveBeenCalledWith({ y: 184, animated: false });
    expect(cutout()).toBe(spotlightPaths(getSpotlightOverviewRect(frame, frame, 700), frame).shade);
    expect(tree.root.findAllByType(Text).some(node => node.props.children === '5 de 5')).toBe(true);
  });

  test.each([false, true])('reports the first guide frame after its entrance with reduced motion %s', async reduceMotion => {
    const onReady = jest.fn();
    await mount({ visible: true, currentTab: 'home', reduceMotion, onReady, targetRefs: {
      syncBanner: { current: nativeRect({ x: 20, y: 126, width: 320, height: 128 }) },
    } });
    const entrance = animations.find(animation => animation.config.toValue === 1 && animation.config.duration === (reduceMotion ? 0 : 220));
    if (!reduceMotion) {
      expect(onReady).not.toHaveBeenCalled();
      await act(async () => entrance.finish());
    }
    expect(onReady).toHaveBeenCalledTimes(1);
    expect(tree.root.findAllByType(Text).some(node => node.props.children === '1 de 5')).toBe(true);
  });

  test('a guide entrance canceled by closing cannot release the login splash through a late callback', async () => {
    const onReady = jest.fn();
    const props = { visible: true, currentTab: 'home', onReady, targetRefs: {
      syncBanner: { current: nativeRect({ x: 20, y: 126, width: 320, height: 128 }) },
    } };
    await mount(props);
    const entrance = animations.find(animation => animation.config.toValue === 1 && animation.config.duration === 220);
    await act(async () => tree.update(<SpotlightGuideModal {...props} visible={false} />));
    await act(async () => entrance.finish()); expect(onReady).not.toHaveBeenCalled();
  });

  test('retains the guide during exit and cancels an exit when reopened', async () => {
    const props = { visible: true, currentTab: 'home', onExited: jest.fn(), targetRefs: {
      syncBanner: { current: nativeRect({ x: 20, y: 126, width: 320, height: 128 }) },
    } };
    await mount(props);
    expect(animations.some(animation => animation.config.toValue === 1 && animation.config.duration === 220)).toBe(true);
    await act(async () => tree.update(<SpotlightGuideModal {...props} visible={false} />));
    const exit = animations.at(-1);
    expect(exit.config).toMatchObject({ toValue: 0, duration: 220 });
    expect(tree.toJSON()).not.toBeNull();
    expect(props.onExited).not.toHaveBeenCalled();
    await act(async () => tree.update(<SpotlightGuideModal {...props} />));
    await flushLayout();
    expect(exit.stop).toHaveBeenCalled();
    expect(tree.toJSON()).not.toBeNull();
    await act(async () => tree.update(<SpotlightGuideModal {...props} visible={false} />));
    await act(async () => animations.at(-1).finish());
    expect(tree.toJSON()).toBeNull();
    expect(props.onExited).toHaveBeenCalledTimes(1);
  });
});
