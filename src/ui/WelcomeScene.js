// Cena animada de abertura: céu roxo, lua, estrelas, morcegos ao fundo e o
// morcego principal com asas articuladas, seguido de "Bem-vindo ao Sismorcego".
// Usada pela StartupSplash (antes era a tela de boas-vindas após o tutorial).
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Easing, Image, StyleSheet, useWindowDimensions } from 'react-native';
import Svg, { Circle, Defs, RadialGradient, Rect, Stop } from 'react-native-svg';
import { Animated, Text, View } from './AccessibleNative';
import useAccessibility from '../hooks/useAccessibility';
import useReduceMotion from './useReduceMotion';

const WING_LEFT_IMG = require('../assets/images/bat_wing_left.png');
const WING_RIGHT_IMG = require('../assets/images/bat_wing_right.png');
const BODY_IMG = require('../assets/images/bat_body.png');
// The PNG includes transparent margins; center its visible body within the stage.
const BAT_BODY_CENTER = { x: 482 / 960, y: 331.5 / 620 };
const ALL_LAYERS = 7; // left | right | body
// A abertura tem duração limitada: se alguma camada demorar a decodificar, a
// entrada começa assim mesmo (as camadas aparecem quando chegarem).
export const SCENE_START_FALLBACK_MS = 1200;

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
// Vai-e-vem 100% nativo: um único timing linear (fase 0→1) em loop, convertido
// numa onda suave por interpolação. Loop de *sequência* é reiniciado pelo JS a
// cada volta e trava (e "reseta") quando o JS está ocupado, como na abertura.
const cycle = (phase, duration) => Animated.loop(timing(phase, 1, duration, { easing: Easing.linear }));
const WAVE_POINTS = Array.from({ length: 17 }, (_, i) => i / 16);
// 0 → 1 → 0 ao longo de uma volta, com a mesma suavidade de ease-in-out.
const waveAt = t => Math.round(((1 - Math.cos(2 * Math.PI * t)) / 2) * 1e6) / 1e6;
const wave = (phase, low, high, unit = '') => phase.interpolate({
  inputRange: WAVE_POINTS,
  outputRange: WAVE_POINTS.map(t => {
    const v = Math.round((low + (high - low) * waveAt(t)) * 1e6) / 1e6;
    return unit ? `${v}${unit}` : v;
  }),
});
// Fase em que a onda está no meio (asas abertas, sem inclinação).
const MID_PHASE = 0.25;

// Every image has explicit canvas dimensions: absolute fill alone leaves the
// PNG's intrinsic 960 x 620 size in React Native. Pivots match the HTML layers.
function BatLayers({ width, height, flap, mini = false, style, testID, onLayerLoad }) {
  const angle = mini ? 19 : 14;
  // Nós de animação estáveis: recriá-los a cada render reconecta a asa ao
  // driver nativo e ela "volta ao lugar" por um quadro (as asas travavam).
  const leftRotate = useMemo(() => wave(flap, -angle, angle, 'deg'), [flap, angle]);
  const rightRotate = useMemo(() => wave(flap, angle, -angle, 'deg'), [flap, angle]);
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
        transform: [{ rotate: leftRotate }],
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
        transform: [{ rotate: rightRotate }],
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
    if (!active) return undefined;
    travel.setValue(0);
    const animation = Animated.sequence([
      Animated.delay(bat.delay),
      Animated.loop(timing(travel, 1, bat.duration, { easing: Easing.linear })),
    ]);
    animation.start();
    return () => animation.stop();
  }, [active, bat, travel]);
  const distance = Math.max(560, screenWidth + 110);
  const flight = useMemo(() => ({
    opacity: travel.interpolate({ inputRange: [0, 0.08, 0.92, 1], outputRange: [0, 0.85, 0.85, 0] }),
    translateX: travel.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0, distance * 260 / 560, distance] }),
    translateY: travel.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0, -26, 10] }),
  }), [travel, distance]);
  return <Animated.View testID={`welcome-background-bat-${index}`} pointerEvents="none"
    style={[styles.miniBat, {
      width: bat.width, height: bat.height, top: bat.top, opacity: flight.opacity,
      transform: [{ translateX: flight.translateX }, { translateY: flight.translateY }],
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

export default function WelcomeScene({ reduceMotion = false }) {
  const { highContrast, performance } = useAccessibility();
  const systemReduceMotion = useReduceMotion();
  const skipMotion = reduceMotion || systemReduceMotion;
  // No Android o "movimento reduzido" fica ligado por precaução até a medição
  // de desempenho do aparelho terminar; só então a cena decide se anima.
  const motionDecided = performance?.ready !== false;
  const window = useWindowDimensions();
  const [frame, setFrame] = useState({ width: window.width, height: window.height });
  const [loadedLayers, setLoadedLayers] = useState(0);
  const [layoutReady, setLayoutReady] = useState(false);
  const [sceneReady, setSceneReady] = useState(false);
  const onLayerLoad = useCallback(layer => setLoadedLayers(loaded => loaded | layer), []);
  const motion = useRef({
    // stars/hover/flap/miniFlap são fases (0→1) de ondas nativas.
    moon: new Animated.Value(0), stars: new Animated.Value(0), swoop: new Animated.Value(0),
    hover: new Animated.Value(0), flap: new Animated.Value(0), miniFlap: new Animated.Value(0), title: new Animated.Value(0),
  }).current;
  const nodes = useMemo(() => ({
    stars: wave(motion.stars, 0.35, 1),
    hover: wave(motion.hover, 0, -3),
    moonScale: motion.moon.interpolate({ inputRange: [0, 1], outputRange: [0.4, 1] }),
    swoopX: motion.swoop.interpolate({ inputRange: [0, 1], outputRange: [-90, 0] }),
    swoopY: motion.swoop.interpolate({ inputRange: [0, 1], outputRange: [-95, 0] }),
    swoopRotate: motion.swoop.interpolate({ inputRange: [0, 1], outputRange: ['-12deg', '0deg'] }),
    swoopScale: motion.swoop.interpolate({ inputRange: [0, 1], outputRange: [0.58, 1] }),
    titleY: motion.title.interpolate({ inputRange: [0, 1], outputRange: [16, 0] }),
    titleScale: motion.title.interpolate({ inputRange: [0, 1], outputRange: [0.97, 1] }),
  }), [motion]);

  // Decode every PNG and commit the layout before starting the shared entrance
  // clock, so no layer fades in on its own (with a bounded fallback).
  useEffect(() => {
    if (sceneReady) return undefined;
    if (layoutReady && loadedLayers === ALL_LAYERS) {
      let secondFrame;
      const firstFrame = requestAnimationFrame(() => {
        secondFrame = requestAnimationFrame(() => setSceneReady(true));
      });
      return () => {
        cancelAnimationFrame(firstFrame);
        if (secondFrame !== undefined) cancelAnimationFrame(secondFrame);
      };
    }
    const fallback = setTimeout(() => setSceneReady(true), SCENE_START_FALLBACK_MS);
    return () => clearTimeout(fallback);
  }, [sceneReady, layoutReady, loadedLayers]);

  useEffect(() => {
    const running = [];
    const start = (animation, complete) => { running.push(animation); animation.start(complete); };
    let cancelled = false;
    if (!motionDecided) return undefined;
    if (skipMotion) {
      for (const key of ['moon', 'swoop', 'title']) motion[key].setValue(1);
      motion.stars.setValue(0.5); motion.hover.setValue(0); motion.flap.setValue(MID_PHASE); motion.miniFlap.setValue(0);
      return undefined;
    }
    if (!sceneReady) return undefined;
    // A entrada sempre parte do início (inclusive se o movimento foi liberado depois).
    for (const key of ['moon', 'swoop', 'title', 'stars', 'hover', 'flap', 'miniFlap']) motion[key].setValue(0);
    start(timing(motion.moon, 1, 900, { delay: 100, easing: Easing.bezier(0.2, 0.8, 0.2, 1) }));
    start(Animated.sequence([Animated.delay(400), cycle(motion.stars, 3200)]));
    start(timing(motion.swoop, 1, 720, { easing: Easing.bezier(0.18, 0.82, 0.25, 1) }), ({ finished }) => {
      if (finished && !cancelled) start(cycle(motion.hover, 1160));
    });
    start(cycle(motion.flap, 580));
    start(cycle(motion.miniFlap, 480));
    start(timing(motion.title, 1, 600, { delay: 950, easing: Easing.bezier(0.2, 0.8, 0.2, 1) }));
    return () => { cancelled = true; running.forEach(animation => animation.stop()); };
  }, [sceneReady, skipMotion, motionDecided, motion]);

  // The stage and the PNG canvas have different aspect ratios in the HTML.
  const stageWidth = Math.min(360, frame.width * 0.92);
  const stageHeight = stageWidth * 313 / 437;
  const layerHeight = stageWidth * 620 / 960;
  const moonSize = stageWidth * 0.46;
  const titleSize = Math.max(35, Math.min(43, frame.width * 0.09));

  return <View testID="welcome-screen" style={styles.root} pointerEvents="none"
    onLayout={event => {
      const { width, height } = event.nativeEvent.layout;
      setFrame(old => (old.width === width && old.height === height ? old : { width, height }));
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
    <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { opacity: nodes.stars }]}>
      {STARS.map(([left, top, opacity], index) => <View key={index} style={[styles.star, { left, top, opacity }]} />)}
    </Animated.View>
    {motionDecided && !skipMotion && BACKGROUND_BATS.slice(0, performance?.source === 'native' && performance.tier === 'medium' ? 2 : BACKGROUND_BATS.length)
      .map((bat, index) => <BackgroundBat key={index} bat={bat} index={index}
        active={sceneReady} flap={motion.miniFlap} screenWidth={frame.width} />)}
    <View testID="welcome-stage" pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants"
      style={[styles.stage, { width: stageWidth, height: stageHeight }]}>
      <Moon size={moonSize} style={{ left: (stageWidth - moonSize) / 2, top: (stageHeight - moonSize) / 2,
        opacity: motion.moon, transform: [{ scale: nodes.moonScale }],
      }} />
      <Animated.View testID="welcome-main-flight" style={[styles.mainFlight, {
        transformOrigin: ['50%', '54%', 0],
        transform: [
          { translateX: nodes.swoopX }, { translateY: nodes.swoopY },
          { rotate: nodes.swoopRotate }, { scale: nodes.swoopScale },
        ],
      }]}>
        <Animated.View style={[StyleSheet.absoluteFill, {
          transform: [{ translateY: nodes.hover }],
        }]}>
          <BatLayers testID="welcome-main-bat" width={stageWidth} height={layerHeight} flap={motion.flap} onLayerLoad={onLayerLoad}
            style={{ left: stageWidth / 2 - stageWidth * BAT_BODY_CENTER.x,
              top: stageHeight / 2 - layerHeight * BAT_BODY_CENTER.y }} />
        </Animated.View>
      </Animated.View>
    </View>
    <Animated.View testID="welcome-title" accessibilityElementsHidden importantForAccessibility="no-hide-descendants"
      style={[styles.title, { opacity: motion.title, transform: [
        { translateY: nodes.titleY }, { scale: nodes.titleScale },
      ] }]}>
      <Text style={[styles.titleSmall, { fontSize: titleSize / 2, letterSpacing: titleSize * 0.005 }]}>Bem-vindo ao</Text>
      <Text testID="welcome-brand-name" style={[styles.titleMain, { fontSize: titleSize, letterSpacing: titleSize * -0.045 }]}>Sismorcego</Text>
    </Animated.View>
  </View>;
}

const titleShadow = {
  textShadowColor: 'rgba(28,13,54,0.35)', textShadowOffset: { width: 0, height: 4 }, textShadowRadius: 24,
};
const styles = StyleSheet.create({
  root: {
    flex: 1, alignItems: 'center', justifyContent: 'center', gap: 26,
    paddingTop: 38, paddingHorizontal: 24, paddingBottom: 60, overflow: 'hidden', backgroundColor: '#35107C',
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
});
