// src/navigation/index.js
import React, { useEffect, useMemo, useState } from "react";
import { Image, StatusBar, StyleSheet } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withTiming, Easing } from "react-native-reanimated";
import { NavigationContainer } from "@react-navigation/native";
import AppTabs from "./AppTabs";
import AuthStack from "./AuthStack";
import BatSwarm from "./BatSwarm";
import useAuth from "../hooks/useAuth";
import useReduceMotion from "../ui/useReduceMotion";
import { useTheme, makeNavigationTheme } from "../theme/ThemeProvider";

// Tempo mínimo que a horda fica na tela, mesmo se o Firebase responder
// antes disso — pra animação nunca ser cortada no meio do voo.
const MIN_SPLASH_MS = 2900;
const FADE_MS = 250;

// Enquanto o Firebase restaura a sessão (e por um tempo mínimo depois,
// pra horda de morcegos terminar de voar): marca sobre o violeta da
// identidade, morcegos batendo asa atravessando a tela.
function Splash({ color, tint, fadeOut, overlay, reduced }) {
  const opacity = useSharedValue(1);

  useEffect(() => {
    if (fadeOut) opacity.set(withTiming(0, { duration: FADE_MS, easing: Easing.out(Easing.quad) }));
  }, [fadeOut]);

  const animatedStyle = useAnimatedStyle(() => ({ opacity: opacity.get() }));

  return (
    <Animated.View
      pointerEvents={fadeOut ? "none" : "auto"}
      style={[styles.splash, { backgroundColor: color }, overlay && StyleSheet.absoluteFillObject, animatedStyle]}
    >
      <BatSwarm reduced={reduced} />
      <Image
        source={require("../assets/images/Logomarca.png")}
        style={[styles.splashMark, { tintColor: tint }]}
        resizeMode="contain"
        accessibilityLabel="Sismorcego"
      />
    </Animated.View>
  );
}

export default function RootNavigation() {
  const { user, loading } = useAuth();
  const theme = useTheme();
  const navTheme = useMemo(() => makeNavigationTheme(theme), [theme]);
  const reduced = useReduceMotion();

  const [minTimeDone, setMinTimeDone] = useState(false);
  const [showSplash, setShowSplash] = useState(true);

  useEffect(() => {
    if (reduced) {
      setMinTimeDone(true);
      return;
    }
    const t = setTimeout(() => setMinTimeDone(true), MIN_SPLASH_MS);
    return () => clearTimeout(t);
  }, [reduced]);

  const readyToReveal = !loading && minTimeDone;

  useEffect(() => {
    if (!readyToReveal) return;
    const t = setTimeout(() => setShowSplash(false), FADE_MS + 20);
    return () => clearTimeout(t);
  }, [readyToReveal]);

  return (
    <NavigationContainer theme={navTheme}>
      {!loading && user ? (
        <>
          <StatusBar barStyle={theme.colors.statusBar} backgroundColor="transparent" translucent />
          <AppTabs />
        </>
      ) : !loading ? (
        <AuthStack />
      ) : null}
      {showSplash ? (
        <Splash
          color={theme.colors.brandDeep}
          tint={theme.colors.onBrand}
          fadeOut={readyToReveal}
          reduced={reduced}
          overlay
        />
      ) : null}
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  splash: { flex: 1, alignItems: "center", justifyContent: "center" },
  splashMark: { width: 120, height: 95 },
});
