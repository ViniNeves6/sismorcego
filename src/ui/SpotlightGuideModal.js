// src/ui/SpotlightGuideModal.js
import React, {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  useMemo,
} from 'react';
import {
  BackHandler,
  Easing,
  StyleSheet,
} from 'react-native';
import { Animated, Pressable, ScrollView, Text, View } from './AccessibleNative';
import Svg, { Path } from 'react-native-svg';
import useReduceMotion from './useReduceMotion';
import useFadeCompositing from './useFadeCompositing';
import useSpeakOnMount from '../hooks/useSpeakOnMount';
import {
  getSpotlightPanelTop,
  getSpotlightOverviewRect,
  getSpotlightAnchorScrollY,
  getSpotlightRect,
  getSpotlightScrollY,
  measureSpotlightNode,
  spotlightPaths,
} from './spotlightLayout';

const AnimatedPath = Animated.createAnimatedComponent(Path);
const afterLayout = () =>
  new Promise((resolve) =>
    requestAnimationFrame(() => requestAnimationFrame(resolve))
  );
const interpolateRect = (from, to, progress) =>
  Object.fromEntries(
    ['x', 'y', 'width', 'height'].map((key) => [
      key,
      from[key] + (to[key] - from[key]) * progress,
    ])
  );

export const SPOTLIGHT_STORAGE_KEY = 'sismorcego-spotlight-v1-seen';

// Common steps for both ACS and Coordenador (Steps 1 to 5)
export const SPOTLIGHT_COMMON_STEPS = [
  {
    screen: 'home',
    title: 'Registros disponíveis offline',
    description: 'Seus registros ficam no aparelho até a sincronização.',
    boldWords: [],
    targetKey: 'syncBanner',
  },
  {
    screen: 'home',
    title: 'Encontre e consulte registros',
    description:
      'Em Registros, pesquise, filtre e abra um cartão para modificar ou excluir.',
    adminDescription:
      'Em Registros, pesquise, filtre e abra um cartão para consultar ocorrências.',
    boldWords: ['Registros'],
    targetKey: 'recordsOverview',
    overview: true,
  },
  {
    screen: 'home',
    title: 'Inicie uma notificação',
    description: 'Em Notificar, o + vira X. Toque no X para limpar os campos.',
    boldWords: ['Notificar'],
    targetKey: 'dockFab',
  },
  {
    screen: 'new',
    title: 'Defina o responsável pelo registro',
    description: 'Em Nova notificação, confira ou altere o agente responsável.',
    boldWords: ['Nova notificação'],
    targetKey: 'reporterCard',
  },
  {
    screen: 'new',
    title: 'Preencha a notificação',
    description:
      'Escolha a espécie mordida, obtenha a localização pelo GPS, tire a foto, depois informe data, município e localidade.',
    boldWords: [],
    targetKey: 'notificationOverview',
    overview: true,
    scrollAnchor: 'victimSection',
    scrollAnchorOffset: 16,
  },
];

// Additional steps exclusively for Coordenador (Steps 6 to 8)
export const SPOTLIGHT_ADMIN_STEPS = [
  {
    screen: 'panel',
    title: 'Painel administrativo',
    description:
      'Este é o Painel administrativo: consulte indicadores e filtre ocorrências.',
    boldWords: ['Painel administrativo'],
    targetKey: 'panelOverview',
    overview: true,
    scrollAnchor: 'panelTop',
    scrollAnchorOffset: 16,
  },
  {
    screen: 'panel',
    title: 'Mapa de calor e registros por período',
    description:
      'Veja no Mapa de calor onde os registros se concentram e, em Registros por período, a evolução por dia ou por mês.',
    boldWords: ['Mapa de calor', 'Registros por período'],
    targetKey: 'panelOverview',
    overview: true,
    scrollAnchor: 'panelMapSection',
    scrollAnchorOffset: 18,
  },
  {
    screen: 'alerts',
    title: 'Notificações e alertas',
    description:
      'Esta é a tela de Notificações: consulte novos alertas e marque-os como lidos.',
    boldWords: ['Notificações'],
    targetKey: 'alertsOverview',
    overview: true,
  },
];

// Helper to get step list by role
export const getSpotlightSteps = (isCoordenador) => {
  if (!isCoordenador) return SPOTLIGHT_COMMON_STEPS;
  return [
    ...SPOTLIGHT_COMMON_STEPS.map((s) => ({
      ...s,
      description: s.adminDescription || s.description,
    })),
    ...SPOTLIGHT_ADMIN_STEPS,
  ];
};

// Backwards-compatible export
export const SPOTLIGHT_STEPS = SPOTLIGHT_COMMON_STEPS;

export default function SpotlightGuideModal({
  visible,
  currentTab,
  onSwitchTab,
  scrollTargets,
  dockRef,
  targetRefs,
  onComplete,
  onSkip,
  onExited,
  onReady,
  isCoordenador = false,
  bottomInset = 0,
  reduceMotion = false,
}) {
  const systemReduceMotion = useReduceMotion();
  const skipMotion = reduceMotion || systemReduceMotion;

  // Compute profile-dependent steps
  const steps = useMemo(
    () => getSpotlightSteps(isCoordenador),
    [isCoordenador]
  );
  const totalSteps = steps.length;

  const [rendered, setRendered] = useState(visible);
  const [stepIndex, setStepIndex] = useState(0);
  useSpeakOnMount(`Conheça o Sismorcego. Passo ${stepIndex + 1} de ${totalSteps}. ${steps[stepIndex]?.title}. ${steps[stepIndex]?.description}`, { active: visible, priority: 90 });
  const [frameSize, setFrameSize] = useState({ width: 0, height: 0 });
  const [focusMotion, setFocusMotion] = useState(null);
  const [measureFailed, setMeasureFailed] = useState(false);
  const [panelMeasuredHeight, setPanelMeasuredHeight] = useState(210);

  const rootRef = useRef(null);
  const wasVisible = useRef(false);
  const lastScreen = useRef(null);

  const callbacks = useRef({ onSwitchTab, onComplete, onSkip, onExited, onReady });
  callbacks.current = { onSwitchTab, onComplete, onSkip, onExited, onReady };

  const guideFade = useRef(new Animated.Value(0)).current;
  const compositing = useFadeCompositing(guideFade, visible ? 1 : 0, skipMotion);
  const focusProgress = useRef(new Animated.Value(1)).current;
  const focusProgressValue = useRef(1);
  const focusMotionRef = useRef(null);
  const panelTopAnim = useRef(new Animated.Value(12)).current;
  const backBtnAnim = useRef(new Animated.Value(0)).current;
  const hasFocus = Boolean(focusMotion);

  useEffect(() => {
    const listener = focusProgress.addListener(({ value }) => {
      focusProgressValue.current = value;
    });
    return () => focusProgress.removeListener(listener);
  }, [focusProgress]);

  useLayoutEffect(() => {
    if (visible && !wasVisible.current) {
      setRendered(true);
      setStepIndex(0);
      setFocusMotion(null);
      setMeasureFailed(false);
      focusMotionRef.current = null;
      lastScreen.current = null;
      guideFade.setValue(0);
    }
    wasVisible.current = visible;
  }, [visible, guideFade]);

  // Keep the whole guide mounted through its closing animation.
  useEffect(() => {
    if (!rendered) return;
    if (visible && !hasFocus && !measureFailed) return;
    let active = true;
    const animation = Animated.timing(guideFade, {
      toValue: visible ? 1 : 0,
      duration: skipMotion ? 0 : 220,
      easing: visible ? Easing.out(Easing.ease) : Easing.in(Easing.ease),
      useNativeDriver: true,
    });
    animation.start(({ finished }) => {
      if (!active || !finished) return;
      if (visible) callbacks.current.onReady?.();
      else {
        setRendered(false);
        callbacks.current.onExited?.();
      }
    });
    return () => { active = false; animation.stop(); };
  }, [visible, rendered, hasFocus, measureFailed, skipMotion, guideFade]);

  useEffect(() => {
    if (!visible) return;
    const animation = Animated.timing(backBtnAnim, {
      toValue: stepIndex === 0 ? 0 : 1,
      duration: skipMotion ? 0 : 260,
      easing: Easing.bezier(0.2, 0.8, 0.2, 1),
      useNativeDriver: false,
    });
    animation.start();
    return () => animation.stop();
  }, [visible, stepIndex, skipMotion, backBtnAnim]);

  // Align each step once, keeping its position until navigation changes.
  useEffect(() => {
    if (!visible || !rendered || !frameSize.width || !frameSize.height) return;

    const step = steps[stepIndex];
    if (!step) return;

    if (currentTab !== step.screen) {
      callbacks.current.onSwitchTab?.(step.screen);
      return;
    }

    let cancelled = false;
    let timer;

    const alignToKey = async (targetKey) => {
      await afterLayout();
      if (cancelled) return false;

      for (let attempt = 0; attempt < 6; attempt += 1) {
        let [target, frame, viewport, dock] = await Promise.all([
          measureSpotlightNode(targetRefs?.[targetKey]?.current),
          measureSpotlightNode(rootRef.current),
          measureSpotlightNode(scrollTargets?.[step.screen]?.node),
          measureSpotlightNode(dockRef?.current),
        ]);
        if (cancelled) return false;

        if (target && frame) {
          const scroll = scrollTargets?.[step.screen];
          if (!step.overview && targetKey !== 'dockFab' && viewport && scroll?.node) {
            const offset = scroll.offset || 0;
            const nextOffset = getSpotlightScrollY(target, viewport, offset, dock?.y);
            if (Math.abs(nextOffset - offset) > 1) {
              scroll.node.scrollTo({
                y: nextOffset,
                animated: false,
              });
              await afterLayout();
              if (cancelled) return false;

              [target, frame] = await Promise.all([
                measureSpotlightNode(targetRefs?.[targetKey]?.current),
                measureSpotlightNode(rootRef.current),
              ]);
            }
          }
          if (cancelled) return false;

          if (target && frame) {
            const rect = step.overview
              ? getSpotlightOverviewRect(target, frame, dock?.y)
              : getSpotlightRect(target, frame);
            const old = focusMotionRef.current;
            const from = old
              ? interpolateRect(old.from, old.to, focusProgressValue.current)
              : rect;
            const next = { from, to: rect };
            focusMotionRef.current = next;
            lastScreen.current = step.screen;
            setFocusMotion(next);
            return true;
          }
        }
        await new Promise((resolve) => {
          timer = setTimeout(resolve, 50);
        });
        if (cancelled) return false;
      }
      return false;
    };

    let scrollFrame;
    const scrollToAnchor = async (anchorKey) => {
      const scroll = scrollTargets?.[step.screen];
      if (!scroll?.node?.scrollTo) return;
      const [anchor, viewport] = await Promise.all([
        measureSpotlightNode(targetRefs?.[anchorKey]?.current),
        measureSpotlightNode(scroll.node),
      ]);
      if (cancelled || !anchor || !viewport) return;
      cancelAnimationFrame(scrollFrame);
      const start = scroll.offset || 0;
      const end = getSpotlightAnchorScrollY(anchor, viewport, start,
        scroll.contentHeight, step.scrollAnchorOffset ?? 16);
      const applyOffset = y => {
        scroll.offset = y;
        scroll.node.scrollTo({ y, animated: false });
      };
      if (skipMotion || Math.abs(end - start) < 2) {
        applyOffset(end);
        return;
      }
      let started;
      const tick = now => {
        if (cancelled) return;
        if (started === undefined) started = now;
        const progress = Math.min(1, (now - started) / 420);
        applyOffset(start + (end - start) * (1 - (1 - progress) ** 3));
        if (progress < 1) scrollFrame = requestAnimationFrame(tick);
      };
      scrollFrame = requestAnimationFrame(tick);
    };

    const runAlignment = async () => {
      const success = await alignToKey(step.targetKey);
      if (!success && !cancelled) {
        setMeasureFailed(true);
        return;
      }

      if (cancelled) return;
      if (step.scrollAnchor) await scrollToAnchor(step.scrollAnchor);

    };

    timer = setTimeout(
      runAlignment,
      !skipMotion && lastScreen.current !== step.screen ? 220 : 0
    );

    return () => {
      cancelled = true;
      clearTimeout(timer);
      cancelAnimationFrame(scrollFrame);
    };
  }, [
    visible,
    rendered,
    stepIndex,
    currentTab,
    steps,
    frameSize.width,
    frameSize.height,
    targetRefs,
    scrollTargets,
    dockRef,
    skipMotion,
  ]);

  useLayoutEffect(() => {
    if (!focusMotion) return;
    focusProgress.setValue(0);
    const animation = Animated.timing(focusProgress, {
      toValue: 1,
      duration: skipMotion ? 0 : 240,
      easing: Easing.bezier(0.2, 0.8, 0.2, 1),
      useNativeDriver: false,
    });
    animation.start();
    return () => animation.stop();
  }, [focusMotion, skipMotion, focusProgress]);

  useEffect(() => {
    if (!focusMotion) return;
    const animation = Animated.timing(panelTopAnim, {
      toValue: getSpotlightPanelTop(
        focusMotion.to,
        frameSize.height - bottomInset,
        panelMeasuredHeight,
        steps[stepIndex]?.overview
      ),
      duration: skipMotion ? 0 : 240,
      easing: Easing.bezier(0.2, 0.8, 0.2, 1),
      useNativeDriver: false,
    });
    animation.start();
    return () => animation.stop();
  }, [focusMotion, frameSize.height, bottomInset, panelMeasuredHeight, skipMotion, panelTopAnim, steps, stepIndex]);

  useEffect(() => {
    if (!rendered) return;
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      if (visible) {
        if (stepIndex > 0) setStepIndex((index) => index - 1);
        else callbacks.current.onSkip?.();
      }
      return true;
    });
    return () => subscription.remove();
  }, [rendered, visible, stepIndex]);

  const handleSkip = () => {
    callbacks.current.onSkip?.();
  };

  const goToStep = (nextIndex) => {
    if (!visible || nextIndex < 0) return;
    if (nextIndex >= totalSteps) {
      callbacks.current.onComplete?.();
    } else {
      setStepIndex(nextIndex);
    }
  };

  if (!rendered) return null;

  const currentStep = steps[stepIndex] || steps[0];
  const isLastStep = stepIndex === totalSteps - 1;
  const fromPaths = focusMotion && spotlightPaths(focusMotion.from, frameSize);
  const toPaths = focusMotion && spotlightPaths(focusMotion.to, frameSize);
  const animatedPath = (name) =>
    focusProgress.interpolate({
      inputRange: [0, 1],
      outputRange: [fromPaths[name], toPaths[name]],
    });

  // Render description with bold words
  const renderDescription = () => {
    const text = currentStep.description;
    const bolds = currentStep.boldWords || [];
    if (!bolds.length) {
      return <Text style={styles.description}>{text}</Text>;
    }

    const regex = new RegExp(`(${bolds.join('|')})`, 'g');
    const parts = text.split(regex);

    return (
      <Text style={styles.description}>
        {parts.map((part, i) => {
          if (bolds.includes(part)) {
            return (
              <Text key={i} style={styles.descriptionBold}>
                {part}
              </Text>
            );
          }
          return part;
        })}
      </Text>
    );
  };

  // Back button animated layout styles
  const backMaxWidth = backBtnAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 95],
  });
  const backOpacity = backBtnAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 1],
  });
  const backPadding = backBtnAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 7],
  });
  const backScale = backBtnAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.93, 1],
  });
  const backTranslateX = backBtnAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [-8, 0],
  });

  return (
    <Animated.View
      ref={rootRef}
      {...compositing}
      testID="spotlight-guide"
      accessibilityViewIsModal
      style={[styles.root, { opacity: guideFade }]}
      onLayout={(event) => {
        const { width, height } = event.nativeEvent.layout;
        setFrameSize((size) =>
          size.width === width && size.height === height
            ? size
            : { width, height }
        );
      }}
    >
      <Pressable style={StyleSheet.absoluteFill} accessible={false} />
      <Svg
        width={frameSize.width}
        height={frameSize.height}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      >
        {focusMotion ? (
          <>
            <AnimatedPath
              testID="spotlight-cutout"
              d={animatedPath('shade')}
              fill="rgba(22,12,42,0.78)"
              fillRule="evenodd"
            />
          </>
        ) : (
          <Path
            d={`M 0 0 H ${frameSize.width} V ${frameSize.height} H 0 Z`}
            fill="rgba(22,12,42,0.78)"
          />
        )}
      </Svg>

      {/* Floating Explanation Card */}
      <Animated.View
        testID="spotlight-panel"
        style={[
          styles.panel,
          {
            top: panelTopAnim,
            opacity: hasFocus || measureFailed ? 1 : 0,
            maxHeight: Math.max(0, frameSize.height - bottomInset - 24),
          },
        ]}
        onLayout={(e) => {
          const h = e.nativeEvent.layout.height;
          if (h && Math.abs(h - panelMeasuredHeight) > 1) {
            setPanelMeasuredHeight(h);
          }
        }}
      >
        <ScrollView style={styles.panelScroll} contentContainerStyle={styles.panelContent}
          showsVerticalScrollIndicator={false} bounces={false}>
        {/* Topline: Eyebrow + Counter */}
        <View style={styles.topline}>
          <Text style={styles.eyebrow}>CONHEÇA O SISMORCEGO</Text>
          <Text style={styles.counter}>
            {`${stepIndex + 1} de ${totalSteps}`}
          </Text>
        </View>

        {/* Title */}
        <Text style={styles.title}>{currentStep.title}</Text>

        {/* Description */}
        {renderDescription()}

        {/* Progress Bars */}
        <View style={styles.progressRow}>
          {steps.map((_, i) => (
            <View
              key={i}
              style={[
                styles.progressSegment,
                i <= stepIndex && styles.progressSegmentDone,
              ]}
            />
          ))}
        </View>

        {/* Actions Row */}
        <View style={styles.actionsRow}>
          <View style={styles.actionsLeft}>
            <Pressable
              onPress={handleSkip}
              hitSlop={8}
              style={({ pressed }) => [
                styles.skipBtn,
                pressed && { opacity: 0.6 },
              ]}
            >
              <Text style={styles.skipBtnText}>Pular</Text>
            </Pressable>

            {/* Back button: completely hidden on Step 1, visible without border on Step 2+ */}
            <Animated.View
              accessibilityElementsHidden={stepIndex === 0}
              importantForAccessibility={stepIndex === 0 ? 'no-hide-descendants' : 'auto'}
              style={{
                maxWidth: backMaxWidth,
                opacity: backOpacity,
                paddingLeft: backPadding,
                transform: [{ scale: backScale }, { translateX: backTranslateX }],
                overflow: 'hidden',
              }}
            >
              <Pressable
                onPress={() => goToStep(stepIndex - 1)}
                hitSlop={8}
                disabled={stepIndex === 0}
                style={({ pressed }) => [
                  styles.backBtn,
                  pressed && { opacity: 0.6 },
                ]}
              >
                <Text style={styles.backBtnText} numberOfLines={1}>Voltar</Text>
              </Pressable>
            </Animated.View>
          </View>

          {/* Next / Concluir button */}
          <Pressable
            accessibilityLabel="Próxima etapa do guia"
            onPress={() => goToStep(stepIndex + 1)}
            style={({ pressed }) => [
              styles.nextBtn,
              pressed && styles.nextBtnPressed,
            ]}
          >
            <Text style={styles.nextBtnText}>
              {isLastStep ? 'Concluir' : 'Próximo'}
            </Text>
          </Pressable>
        </View>
        </ScrollView>
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 350,
  },
  panel: {
    position: 'absolute',
    left: 16,
    right: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: 19,
    borderWidth: 1,
    borderColor: '#DFD2FA',
    shadowColor: '#160C2A',
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.32,
    shadowRadius: 28,
    elevation: 24,
  },
  panelScroll: { flexGrow: 0, borderRadius: 18 },
  panelContent: { paddingHorizontal: 17, paddingTop: 17, paddingBottom: 15 },
  topline: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 9,
  },
  eyebrow: {
    fontSize: 10,
    lineHeight: 15,
    fontFamily: 'PlusJakartaSans-ExtraBold',
    fontWeight: '800',
    color: '#6824D6',
    letterSpacing: 0.9,
    includeFontPadding: false,
  },
  counter: {
    fontSize: 11,
    lineHeight: 16.5,
    fontFamily: 'PlusJakartaSans-Bold',
    fontWeight: '700',
    color: '#796E92',
    includeFontPadding: false,
  },
  title: {
    fontSize: 17,
    lineHeight: 22.1,
    fontFamily: 'PlusJakartaSans-ExtraBold',
    fontWeight: '800',
    color: '#181126',
    letterSpacing: -0.3,
    includeFontPadding: false,
  },
  description: {
    fontSize: 12,
    fontFamily: 'PlusJakartaSans-Medium',
    color: '#5E5473',
    lineHeight: 18.6,
    marginTop: 7,
    includeFontPadding: false,
  },
  descriptionBold: {
    fontFamily: 'PlusJakartaSans-ExtraBold',
    fontWeight: '800',
    color: '#181126',
  },
  progressRow: {
    flexDirection: 'row',
    gap: 5,
    marginTop: 13,
    marginBottom: 14,
  },
  progressSegment: {
    flex: 1,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#EDE7F8',
  },
  progressSegmentDone: {
    backgroundColor: '#6824D6',
  },
  actionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 9,
  },
  actionsLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  skipBtn: {
    minHeight: 36,
    justifyContent: 'center',
    paddingHorizontal: 7,
  },
  skipBtnText: {
    fontSize: 12,
    fontFamily: 'PlusJakartaSans-Bold',
    fontWeight: '700',
    color: '#796E92',
    includeFontPadding: false,
  },
  backBtn: {
    minHeight: 36,
    justifyContent: 'center',
    paddingHorizontal: 12,
    borderWidth: 0,
  },
  backBtnText: {
    fontSize: 12,
    fontFamily: 'PlusJakartaSans-ExtraBold',
    fontWeight: '800',
    color: '#6824D6',
    includeFontPadding: false,
  },
  nextBtn: {
    backgroundColor: '#6824D6',
    minHeight: 36,
    paddingHorizontal: 12,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#6824D6',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.28,
    shadowRadius: 8,
    elevation: 4,
  },
  nextBtnPressed: {
    transform: [{ scale: 0.96 }],
    opacity: 0.92,
  },
  nextBtnText: {
    fontSize: 12,
    fontFamily: 'PlusJakartaSans-Bold',
    fontWeight: '700',
    color: '#FFFFFF',
    includeFontPadding: false,
  },
});
