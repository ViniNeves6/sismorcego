// src/navigation/index.js
import React, { useCallback, useEffect, useState } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import SismorcegoShell from './SismorcegoShell';
import AuthStack from './AuthStack';
import StartupSplash from './StartupSplash';
import useAuth from '../hooks/useAuth';
import { makeNavigationTheme, useTheme } from '../theme/ThemeProvider';
import useReduceMotion from '../ui/useReduceMotion';
import useAccessibility from '../hooks/useAccessibility';
import { observeStartupPerformance } from '../services/devicePerformance';
import { ScreenTransitionReadyContext } from '../ui/ScreenTransitionContext';

const Stack = createNativeStackNavigator();

export default function Navigation() {
  const { user, loading } = useAuth();
  const theme = useTheme();
  const reduceMotion = useReduceMotion();
  const { performance } = useAccessibility();
  const performanceReady = performance?.ready !== false;
  const [startupComplete, setStartupComplete] = useState(false);
  const finishStartup = useCallback(() => setStartupComplete(true), []);
  const [startupCovered, setStartupCovered] = useState(false);
  const [startupLoginReady, setStartupLoginReady] = useState(false);
  const coverStartup = useCallback(() => setStartupCovered(true), []);
  const readyStartupLogin = useCallback(() => setStartupLoginReady(true), []);
  const uid = user?.uid || null;
  useEffect(() => {
    if (!startupComplete && performance?.ready) return observeStartupPerformance(performance);
  }, [startupComplete, performance]);
  useEffect(() => {
    if (!startupComplete && (loading || uid)) {
      setStartupCovered(false);
      setStartupLoginReady(false);
    }
  }, [startupComplete, loading, uid]);
  // Prepare login behind the fully opaque cover, then retain the same navigator
  // through the reveal. Authenticated Shell must still wait for startup to exit
  // so its first native tutorial/welcome overlay cannot cover the splash.
  const showNavigation = startupComplete ? !loading : startupCovered && !loading && !user;
  const covered = !startupComplete;
  return (
    <View style={styles.fill}>
      <View style={styles.fill} accessibilityElementsHidden={covered}
        pointerEvents={covered ? 'none' : 'auto'} importantForAccessibility={covered ? 'no-hide-descendants' : 'auto'}>
        <ScreenTransitionReadyContext.Provider value={!covered}>
          {showNavigation ? <NavigationContainer theme={makeNavigationTheme(theme)}>
            {user ? (
              <Stack.Navigator key={user.uid} screenOptions={{ headerShown: false, animation: reduceMotion ? 'none' : 'slide_from_right' }}>
                <Stack.Screen name="Inicio" component={SismorcegoShell} />
              </Stack.Navigator>
            ) : <View style={styles.fill} testID="startup-login-layout" onLayout={readyStartupLogin}>
              <AuthStack />
            </View>}
          </NavigationContainer> : startupComplete ? <View style={styles.loading}>
            <ActivityIndicator color="#6824D6" accessibilityLabel="Carregando sessão" />
          </View> : null}
        </ScreenTransitionReadyContext.Provider>
      </View>
      {!startupComplete && <View style={styles.startupOverlay}>
        <StartupSplash ready={!loading && performanceReady} onExited={finishStartup} screenTransition={!user}
          onCovered={coverStartup} revealReady={startupLoginReady} />
      </View>}
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  loading: { flex: 1, justifyContent: 'center' },
  startupOverlay: { ...StyleSheet.absoluteFillObject, zIndex: 1000, elevation: 1000, shadowColor: 'transparent' },
});
