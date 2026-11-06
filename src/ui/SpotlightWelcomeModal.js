import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import {
  BackHandler, Easing, Image, Modal, StyleSheet,
  useWindowDimensions,
} from 'react-native';
import { Animated, Pressable, Text, View } from './AccessibleNative';
import useSpeakOnMount from '../hooks/useSpeakOnMount';
import useAccessibility from '../hooks/useAccessibility';
import Svg, { Circle, Defs, RadialGradient, Rect, Stop } from 'react-native-svg';
import AsyncStorage from '@react-native-async-storage/async-storage';
import useReduceMotion from './useReduceMotion';
import useFadeCompositing from './useFadeCompositing';

const WING_LEFT_IMG = require('../assets/images/bat_wing_left.png');
const WING_RIGHT_IMG = require('../assets/images/bat_wing_right.png');
const BODY_IMG = require('../assets/images/bat_body.png');
// The PNG includes transparent margins; center its visible body within the stage.
const BAT_BODY_CENTER = { x: 482 / 960, y: 331.5 / 620 };

export const SPOTLIGHT_WELCOME_KEY = 'sismorcego-spotlight-welcome-v1-shown';

const STARS = [
  [40, 60, 0.6], [120, 30, 1], [300, 80, 0.6], [340, 200, 0.4], [60, 220, 0.4],
  [90, 330, 0.33], [330, 380, 0.47], [200, 14, 0.53], [20, 140, 0.47], [360, 30, 0.4],
];
const BACKGROUND_BATS = [
  { width: 43, height: 29, top: '9%', duration: 9000, delay: 1200 },
  { width: 31, height: 21, top: '20%', duration: 12000, delay: 3400 },
  { width: 37, height: 25, top: '66%', duration: 10000, delay: 2200 },
  { width: 28, height: 19, top: '34%', duration: 14000, delay: 6000 },
];
const timing = (value, toValue, duration, options = {}) => Animated.timing(value, {
  toValue, duration, useNativeDriver: true, isInteraction: false, ...options,
});
const oscillate = (value, duration, low = 0) => Animated.loop(Animated.sequence([
  timing(value, 1, duration / 2, { easing: Easing.inOut(Easing.ease) }),
  timing(value, low, duration / 2, { easing: Easing.inOut(Easing.ease) }),
]));

// Every image has explicit canvas dimensions: absolute fill alone leaves the
// PNG's intrinsic 960 x 620 size in React Native. Pivots match the HTML layers.
function BatLayers({ width, height, flap, mini = false, style, testID, onLayerLoad }) {
  const angle = mini ? 19 : 14;
  return <View testID={testID} pointerEvents="none" style={[styles.batLayers, { width, height }, style]}>
    <Animated.Image
      testID={`${testID}-left`}
      source={WING_LEFT_IMG}
      fadeDuration={0}
      onLoad={onLayerLoad ? () => onLayerLoad(1) : undefined}
      accessible={false}
      resizeMode={mini ? 'stretch' : 'contain'}
      style={[styles.batImage, {
        width, height, zIndex: 1,
        transformOrigin: [width * 0.484375, height * 0.5080645, 0],
        transform: [{ rotate: flap.interpolate({ inputRange: [0, 1], outputRange: [`-${angle}deg`, `${angle}deg`] }) }],
      }]}
    />
    <Animated.Image
      testID={`${testID}-right`}
      source={WING_RIGHT_IMG}
      fadeDuration={0}
      onLoad={onLayerLoad ? () => onLayerLoad(2) : undefined}
      accessible={false}
      resizeMode={mini ? 'stretch' : 'contain'}
      style={[styles.batImage, {
        width, height, zIndex: 2,
        transformOrigin: [width * 0.515625, height * 0.5064516, 0],
        transform: [{ rotate: flap.interpolate({ inputRange: [0, 1], outputRange: [`${angle}deg`, `-${angle}deg`] }) }],
      }]}
    />
    {!mini && <Image testID={`${testID}-body`} source={BODY_IMG} accessible={false} resizeMode="contain"
      fadeDuration={0} onLoad={onLayerLoad ? () => onLayerLoad(4) : undefined}
      style={[styles.batImage, { width, height, zIndex: 3 }]} />}
  </View>;
}

function BackgroundBat({ bat, index, active, flap, screenWidth }) {
  const travel = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!active) return;
    travel.setValue(0);
    const animation = Animated.sequence([
      Animated.delay(bat.delay),
      Animated.loop(timing(travel, 1, bat.duration, { easing: Easing.linear })),
    ]);
    animation.start();
    return () => animation.stop();
  }, [active, bat, travel]);
  const distance = Math.max(560, screenWidth + 110);
  return <Animated.View testID={`welcome-background-bat-${index}`} pointerEvents="none"
    style={[styles.miniBat, {
      width: bat.width, height: bat.height, top: bat.top,
      opacity: travel.interpolate({ inputRange: [0, 0.08, 0.92, 1], outputRange: [0, 0.85, 0.85, 0] }),
      transform: [
        { translateX: travel.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0, distance * 260 / 560, distance] }) },
        { translateY: travel.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0, -26, 10] }) },
      ],
    }]}>
    <BatLayers width={bat.width} height={bat.height} flap={flap} mini testID={`welcome-mini-${index}`} />
  </Animated.View>;
}

function Moon({ size, style }) {
  const canvas = size + 300;
  const center = canvas / 2;
  return <Animated.View testID="welcome-moon" style={[styles.moon, { width: size, height: size, borderRadius: size / 2 }, style]}>
    <Svg width={canvas} height={canvas} style={styles.moonGlow} pointerEvents="none">
      <Defs>
        <RadialGradient id="welcomeMoonGlow" cx={center} cy={center} rx={center} ry={center} gradientUnits="userSpaceOnUse">
          <Stop offset="0" stopColor="#FFE296" stopOpacity={0.38} />
          <Stop offset="0.35" stopColor="#FFE296" stopOpacity={0.3} />
          <Stop offset="0.6" stopColor="#FFE296" stopOpacity={0.12} />
          <Stop offset="1" stopColor="#FFE296" stopOpacity={0} />
        </RadialGradient>
        <RadialGradient id="welcomeMoonShade" cx={150 + size * 0.36} cy={150 + size * 0.32}
          rx={size * 0.934} ry={size * 0.934} gradientUnits="userSpaceOnUse">
          <Stop offset="0" stopColor="#FFFBE8" />
          <Stop offset="0.55" stopColor="#FFEAA8" />
          <Stop offset="1" stopColor="#F5CF7A" />
        </RadialGradient>
      </Defs>
      <Circle cx={center} cy={center} r={center} fill="url(#welcomeMoonGlow)" />
      <Circle cx={center} cy={center} r={size / 2} fill="url(#welcomeMoonShade)" />
    </Svg>
  </Animated.View>;
}

export default function SpotlightWelcomeModal({ visible, onClose, onExited, reduceMotion = false }) {
  const { highContrast, performance } = useAccessibility();
  useSpeakOnMount('Bem-vindo ao Sismorcego. Toque em Continuar para conhecer o aplicativo', { active: visible, priority: 100 });
  const systemReduceMotion = useReduceMotion();
  const skipMotion = reduceMotion || systemReduceMotion;
  const window = useWindowDimensions();
  const [frame, setFrame] = useState({ width: window.width, height: window.height });
  const [rendered, setRendered] = useState(visible);
  const [continueReady, setContinueReady] = useState(false);
  const [loadedLayers, setLoadedLayers] = useState(0);
  const [modalPresented, setModalPresented] = useState(false);
  const [layoutReady, setLayoutReady] = useState(false);
  const [sceneReady, setSceneReady] = useState(false);
  const onLayerLoad = useCallback(layer => setLoadedLayers(loaded => loaded | layer), []);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  const exitedRef = useRef(onExited);
  exitedRef.current = onExited;
  const motion = useRef({
    fade: new Animated.Value(0), moon: new Animated.Value(0), stars: new Animated.Value(0.35),
    swoop: new Animated.Value(0), hover: new Animated.Value(0), flap: new Animated.Value(0),
    miniFlap: new Animated.Value(0), title: new Animated.Value(0),
    buttonOpacity: new Animated.Value(0), buttonMove: new Animated.Value(0),
  }).current;
  const compositing = useFadeCompositing(motion.fade, visible ? 1 : 0, skipMotion);

  useLayoutEffect(() => {
    if (visible && !rendered) {
      motion.fade.setValue(0);
      setLoadedLayers(0);
      setModalPresented(false);
      setLayoutReady(false);
      setSceneReady(false);
      setRendered(true);
    }
  }, [visible, rendered, motion]);

  // Decode every PNG and let the native modal commit its layout before starting
  // the shared entrance clock. No individual layer may fade in on its own.
  useEffect(() => {
    if (!rendered || !modalPresented || !layoutReady || loadedLayers !== 7) return;
    let secondFrame;
    const firstFrame = requestAnimationFrame(() => {
      secondFrame = requestAnimationFrame(() => setSceneReady(true));
    });
    return () => {
      cancelAnimationFrame(firstFrame);
      if (secondFrame !== undefined) cancelAnimationFrame(secondFrame);
    };
  }, [rendered, modalPresented, layoutReady, loadedLayers]);

  const entranceReady = !visible || sceneReady;
  useEffect(() => {
    if (!rendered || !entranceReady) return;
    let cancelled = false;
    let readyTimer;
    const running = [];
    const start = (animation, complete) => {
      running.push(animation);
      animation.start(complete);
    };
    if (!visible) {
      setContinueReady(false);
      start(timing(motion.fade, 0, skipMotion ? 0 : 380, { easing: Easing.in(Easing.ease) }), ({ finished }) => {
        if (finished && !cancelled) {
          setRendered(false);
          exitedRef.current?.();
        }
      });
    } else {
      AsyncStorage.setItem(SPOTLIGHT_WELCOME_KEY, '1').catch(() => {});
      for (const key of ['moon', 'swoop', 'title', 'buttonOpacity', 'buttonMove']) motion[key].setValue(skipMotion ? 1 : 0);
      motion.hover.setValue(0);
      motion.flap.setValue(skipMotion ? 0.5 : 0);
      motion.miniFlap.setValue(0);
      motion.stars.setValue(skipMotion ? 1 : 0.35);
      setContinueReady(skipMotion);
      start(timing(motion.fade, 1, skipMotion ? 0 : 380, { easing: Easing.out(Easing.ease) }));
      if (!skipMotion) {
        start(timing(motion.moon, 1, 900, { delay: 100, easing: Easing.bezier(0.2, 0.8, 0.2, 1) }));
        start(Animated.sequence([Animated.delay(400), oscillate(motion.stars, 3200, 0.35)]));
        start(timing(motion.swoop, 1, 720, { easing: Easing.bezier(0.18, 0.82, 0.25, 1) }), ({ finished }) => {
          if (finished && !cancelled) start(oscillate(motion.hover, 1160));
        });
        start(oscillate(motion.flap, 580));
        start(oscillate(motion.miniFlap, 480));
        start(timing(motion.title, 1, 600, { delay: 950, easing: Easing.bezier(0.2, 0.8, 0.2, 1) }));
        readyTimer = setTimeout(() => {
          if (cancelled) return;
          setContinueReady(true);
          start(timing(motion.buttonOpacity, 1, 480, { easing: Easing.ease }));
          start(timing(motion.buttonMove, 1, 550, { easing: Easing.bezier(0.19, 1, 0.22, 1) }));
        }, 1000);
      }
    }
    return () => {
      cancelled = true;
      clearTimeout(readyTimer);
      running.forEach(animation => animation.stop());
    };
  }, [visible, rendered, entranceReady, skipMotion, motion]);

  useEffect(() => {
    if (!rendered) return;
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      if (visible) closeRef.current?.();
      return true;
    });
    return () => subscription.remove();
  }, [rendered, visible]);

  if (!rendered) return null;

  // The stage and the PNG canvas have different aspect ratios in the HTML.
  const stageWidth = Math.min(360, frame.width * 0.92);
  const stageHeight = stageWidth * 313 / 437;
  const layerHeight = stageWidth * 620 / 960;
  const moonSize = stageWidth * 0.46;
  const titleSize = Math.max(35, Math.min(43, frame.width * 0.09));
  const close = () => { if (visible) closeRef.current?.(); };

  return <Modal transparent visible={rendered} animationType="none" onRequestClose={close}
    onShow={() => setModalPresented(true)} statusBarTranslucent>
    <Animated.View testID="welcome-screen" {...compositing} style={[styles.root, { opacity: motion.fade }]}
      onLayout={event => {
        const { width, height } = event.nativeEvent.layout;
        setFrame(old => old.width === width && old.height === height ? old : { width, height });
        if (width > 0 && height > 0) setLayoutReady(true);
      }}>
      <Svg width={frame.width} height={frame.height} style={StyleSheet.absoluteFill} pointerEvents="none">
        <Defs>
          <RadialGradient id="welcomeSky" cx={frame.width * 0.5} cy={frame.height * 0.28}
            rx={frame.width * 1.2} ry={frame.height * 0.7} gradientUnits="userSpaceOnUse">
            <Stop offset="0" stopColor={highContrast ? '#18181F' : '#8346EE'} />
            <Stop offset="0.42" stopColor={highContrast ? '#08080C' : '#6624D6'} />
            <Stop offset="1" stopColor={highContrast ? '#08080C' : '#35107C'} />
          </RadialGradient>
        </Defs>
        <Rect width={frame.width} height={frame.height} fill="url(#welcomeSky)" />
      </Svg>
      <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { opacity: motion.stars }]}>
        {STARS.map(([left, top, opacity], index) => <View key={index} style={[styles.star, { left, top, opacity }]} />)}
      </Animated.View>
      {!skipMotion && BACKGROUND_BATS.slice(0, performance?.source === 'native' && performance.tier === 'medium' ? 2 : BACKGROUND_BATS.length).map((bat, index) => <BackgroundBat key={index} bat={bat} index={index}
        active={visible && sceneReady} flap={motion.miniFlap} screenWidth={frame.width} />)}
      <View testID="welcome-stage" pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants"
        style={[styles.stage, { width: stageWidth, height: stageHeight }]}>
        <Moon size={moonSize} style={{ left: (stageWidth - moonSize) / 2, top: (stageHeight - moonSize) / 2,
          opacity: motion.moon, transform: [{ scale: motion.moon.interpolate({ inputRange: [0, 1], outputRange: [0.4, 1] }) }],
        }} />
        <Animated.View testID="welcome-main-flight" style={[styles.mainFlight, {
          transformOrigin: ['50%', '54%', 0],
          transform: [
            { translateX: motion.swoop.interpolate({ inputRange: [0, 1], outputRange: [-90, 0] }) },
            { translateY: motion.swoop.interpolate({ inputRange: [0, 1], outputRange: [-95, 0] }) },
            { rotate: motion.swoop.interpolate({ inputRange: [0, 1], outputRange: ['-12deg', '0deg'] }) },
            { scale: motion.swoop.interpolate({ inputRange: [0, 1], outputRange: [0.58, 1] }) },
          ],
        }]}>
          <Animated.View style={[StyleSheet.absoluteFill, {
            transform: [{ translateY: motion.hover.interpolate({ inputRange: [0, 1], outputRange: [0, -3] }) }],
          }]}>
            <BatLayers testID="welcome-main-bat" width={stageWidth} height={layerHeight} flap={motion.flap} onLayerLoad={onLayerLoad}
              style={{ left: stageWidth / 2 - stageWidth * BAT_BODY_CENTER.x,
                top: stageHeight / 2 - layerHeight * BAT_BODY_CENTER.y }} />
          </Animated.View>
        </Animated.View>
      </View>
      <Animated.View testID="welcome-title" style={[styles.title, { opacity: motion.title, transform: [
        { translateY: motion.title.interpolate({ inputRange: [0, 1], outputRange: [16, 0] }) },
        { scale: motion.title.interpolate({ inputRange: [0, 1], outputRange: [0.97, 1] }) },
      ] }]}>
        <Text style={[styles.titleSmall, { fontSize: titleSize / 2, letterSpacing: titleSize * 0.005 }]}>Bem-vindo ao</Text>
        <Text testID="welcome-brand-name" style={[styles.titleMain, { fontSize: titleSize, letterSpacing: titleSize * -0.045 }]}>Sismorcego</Text>
      </Animated.View>
      <Animated.View style={[styles.continueWrapper, { opacity: motion.buttonOpacity, transform: [
        { translateY: motion.buttonMove.interpolate({ inputRange: [0, 1], outputRange: [28, 0] }) },
        { scale: motion.buttonMove.interpolate({ inputRange: [0, 1], outputRange: [0.95, 1] }) },
      ] }]}>
        <Pressable disabled={!continueReady || !visible} onPress={close} accessibilityRole="button" accessibilityLabel="Continuar para o aplicativo"
          style={({ pressed }) => [styles.continueButton, pressed && { transform: [{ scale: 0.98 }] }]}>
          <Text style={styles.continueText}>Continuar</Text>
        </Pressable>
      </Animated.View>
    </Animated.View>
  </Modal>;
}

const titleShadow = {
  textShadowColor: 'rgba(28,13,54,0.35)', textShadowOffset: { width: 0, height: 4 }, textShadowRadius: 24,
};
const styles = StyleSheet.create({
  root: {
    flex: 1, alignItems: 'center', justifyContent: 'center', gap: 26,
    paddingTop: 38, paddingHorizontal: 24, paddingBottom: 126, overflow: 'hidden', backgroundColor: '#35107C',
  },
  star: { position: 'absolute', width: 2, height: 2, borderRadius: 1, backgroundColor: '#FFFFFF' },
  miniBat: { position: 'absolute', left: -55 },
  stage: { position: 'relative', flexShrink: 0, zIndex: 1 },
  moon: { position: 'absolute' },
  moonGlow: { position: 'absolute', left: -150, top: -150 },
  mainFlight: { ...StyleSheet.absoluteFillObject, zIndex: 1 },
  batLayers: { position: 'absolute' },
  batImage: { position: 'absolute', left: 0, top: 0 },
  title: { alignItems: 'center', maxWidth: 340, zIndex: 1, overflow: 'visible' },
  titleSmall: { ...titleShadow, fontFamily: 'PlusJakartaSans-SemiBold', color: '#FFFFFF', opacity: 0.8, marginBottom: 4, includeFontPadding: false },
  titleMain: { ...titleShadow, fontFamily: 'PlusJakartaSans-ExtraBold', color: '#FFFFFF', includeFontPadding: false, paddingBottom: 4, overflow: 'visible' },
  continueWrapper: { position: 'absolute', left: 28, right: 28, bottom: 46, zIndex: 2 },
  continueButton: {
    minHeight: 56, borderRadius: 15, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center',
    shadowColor: '#1C0D36', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.3, shadowRadius: 18, elevation: 8,
  },
  continueText: { fontSize: 16, fontFamily: 'PlusJakartaSans-ExtraBold', color: '#6221D1', includeFontPadding: false },
});
