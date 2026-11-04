import React, { useEffect, useRef, useState } from 'react';
import { Animated, BackHandler, Easing, Image, StatusBar, StyleSheet } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';
import useReduceMotion from '../ui/useReduceMotion';
import useSpeakOnMount from '../hooks/useSpeakOnMount';
import BatSwarm from './BatSwarm';
import { screenFadeTiming } from '../ui/screenFade';

export const MIN_SPLASH_MS = 2900;
export const SPLASH_FADE_MS = 250;

// Startup is automatic and separate from the interactive Spotlight welcome.
export default function StartupSplash({ ready, onExited, screenTransition = false, onCovered, revealReady = true }) {
  const { colors } = useTheme();
  const reduced = useReduceMotion();
  const [minimumElapsed, setMinimumElapsed] = useState(false);
  const contentOpacity = useRef(new Animated.Value(reduced ? 1 : 0)).current;
  const opacity = useRef(new Animated.Value(1)).current;
  const coverOpacity = useRef(new Animated.Value(0)).current;
  const [revealing, setRevealing] = useState(false);
  const completed = useRef(false);
  const exitCallback = useRef(onExited);
  exitCallback.current = onExited;
  const coveredCallback = useRef(onCovered);
  coveredCallback.current = onCovered;
  useSpeakOnMount('Sismorcego. Iniciando aplicativo', { priority: 100 });

  useEffect(() => {
    const timer = setTimeout(() => setMinimumElapsed(true), MIN_SPLASH_MS);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    // Back keeps Android's default exit action; it never skips into the Shell.
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => false);
    return () => subscription.remove();
  }, []);

  useEffect(() => {
    if (reduced) { contentOpacity.setValue(1); return; }
    const entrance = Animated.timing(contentOpacity, {
      toValue: 1, duration: 150, easing: Easing.out(Easing.quad), useNativeDriver: true,
    });
    entrance.start();
    return () => entrance.stop();
  }, [reduced, contentOpacity]);

  useEffect(() => {
    if (!ready || !minimumElapsed) {
      opacity.setValue(1); coverOpacity.setValue(0); setRevealing(false); return;
    }
    let cancelled = false;
    const finish = () => {
      if (!cancelled && !completed.current) {
        completed.current = true;
        exitCallback.current?.();
      }
    };
    if (reduced) { opacity.setValue(0); finish(); return; }
    if (screenTransition && revealing && !revealReady) return;
    const covering = screenTransition && !revealing;
    const exit = Animated.timing(covering ? coverOpacity : opacity, screenTransition ? {
      toValue: covering ? 1 : 0, ...screenFadeTiming(!covering),
    } : {
      toValue: 0, duration: SPLASH_FADE_MS, easing: Easing.out(Easing.quad), useNativeDriver: true,
    });
    exit.start(({ finished }) => {
      if (!finished || cancelled) return;
      if (covering) { coveredCallback.current?.(); setRevealing(true); }
      else finish();
    });
    return () => { cancelled = true; exit.stop(); };
  }, [ready, minimumElapsed, reduced, opacity, coverOpacity, screenTransition, revealing, revealReady]);

  return <Animated.View testID="startup-splash" style={[styles.splash, { backgroundColor: revealing ? colors.canvas : colors.brandDeep, opacity }]}
    collapsable={false} needsOffscreenAlphaCompositing pointerEvents="auto">
    <StatusBar barStyle={revealing ? colors.statusBar || 'dark-content' : 'light-content'}
      backgroundColor={revealing ? colors.canvas : colors.brandDeep} translucent />
    {!revealing && <Animated.View testID="splash-artwork" style={[styles.content, { opacity: contentOpacity }]}>
      <BatSwarm reduced={reduced} />
      <Image source={require('../assets/images/Logomarca.png')} resizeMode="contain"
        style={[styles.mark, { tintColor: colors.onBrand }]} accessibilityLabel="Sismorcego. Iniciando aplicativo" />
    </Animated.View>}
    {screenTransition && !revealing && <Animated.View testID="splash-screen-fade" pointerEvents="none"
      accessible={false} importantForAccessibility="no-hide-descendants"
      style={[StyleSheet.absoluteFill, { backgroundColor: colors.canvas, opacity: coverOpacity }]} />}
  </Animated.View>;
}

const styles = StyleSheet.create({
  splash: { flex: 1 },
  content: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  mark: { width: 120, height: 95 },
});
