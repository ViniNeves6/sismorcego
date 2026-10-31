// src/navigation/index.js
import React, { useCallback, useEffect, useState } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { ActivityIndicator, BackHandler, Keyboard, Modal, StyleSheet, View } from 'react-native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import SismorcegoShell from './SismorcegoShell';
import AuthStack from './AuthStack';
import StartupSplash from './StartupSplash';
import useAuth from '../hooks/useAuth';
import { makeNavigationTheme, useTheme } from '../theme/ThemeProvider';
import useReduceMotion from '../ui/useReduceMotion';
import { REAL_FIREBASE_HOMOLOGATION } from '../services/appEnvironment';
import { ScreenTransitionReadyContext } from '../ui/ScreenTransitionContext';

const Stack = createNativeStackNavigator();

export default function Navigation() {
  const { user, loading } = useAuth();
  const theme = useTheme();
  const reduceMotion = useReduceMotion();
  const [startupComplete, setStartupComplete] = useState(false);
  const finishStartup = useCallback(() => setStartupComplete(true), []);
  const [startupCovered, setStartupCovered] = useState(false);
  const [startupLoginReady, setStartupLoginReady] = useState(false);
  const coverStartup = useCallback(() => setStartupCovered(true), []);
  const readyStartupLogin = useCallback(() => setStartupLoginReady(true), []);
  const uid = user?.uid || null;
  useEffect(() => {
    if (!startupComplete && (loading || uid)) {
      setStartupCovered(false);
      setStartupLoginReady(false);
    }
  }, [startupComplete, loading, uid]);
  const [session, setSession] = useState(() => ({ uid, login: null }));
  // Derive the cover before committing an authenticated frame. A restored
  // session is already covered by startup; only a later signed-out -> login
  // transition needs another splash, exclusively in the homologation build.
  if (session.uid !== uid) {
    setSession({ uid, login: REAL_FIREBASE_HOMOLOGATION && startupComplete && uid && !session.uid
      ? { id: {}, presented: false, ready: false } : null });
  }
  const login = session.uid === uid ? session.login : null;
  const loginId = login?.id;
  const presentLogin = useCallback(() => {
    Keyboard.dismiss();
    setSession(current => current.login && current.login.id === loginId
      ? { ...current, login: { ...current.login, presented: true } } : current);
  }, [loginId]);
  const readyLogin = useCallback(() => {
    setSession(current => current.login && current.login.id === loginId && !current.login.ready
      ? { ...current, login: { ...current.login, ready: true } } : current);
  }, [loginId]);
  const finishLogin = useCallback(() => {
    setSession(current => current.login && current.login.id === loginId
      ? { ...current, login: null } : current);
  }, [loginId]);
  // Prepare login behind the fully opaque cover, then retain the same navigator
  // through the reveal. Authenticated Shell must still wait for startup to exit
  // so its first native tutorial/welcome overlay cannot cover the splash.
  const showNavigation = startupComplete ? !loading || Boolean(login) : startupCovered && !loading && !user;
  const covered = !startupComplete || Boolean(login);
  return (
    <View style={styles.fill}>
      <View style={styles.fill} accessibilityElementsHidden={covered}
        pointerEvents={covered ? 'none' : 'auto'} importantForAccessibility={covered ? 'no-hide-descendants' : 'auto'}>
        <ScreenTransitionReadyContext.Provider value={!covered}>
          {showNavigation ? <NavigationContainer theme={makeNavigationTheme(theme)}>
            {user && (!login || login.presented) ? (
              <Stack.Navigator key={user.uid} screenOptions={{ headerShown: false, animation: reduceMotion ? 'none' : 'slide_from_right' }}>
                <Stack.Screen name="Inicio">
                  {props => <SismorcegoShell {...props} onInitialScreenReady={readyLogin} />}
                </Stack.Screen>
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
        <StartupSplash ready={!loading} onExited={finishStartup} screenTransition={!user}
          onCovered={coverStartup} revealReady={startupLoginReady} />
      </View>}
      {login && <Modal key={uid} testID="post-login-splash" visible transparent animationType="none"
        statusBarTranslucent hardwareAccelerated onShow={presentLogin} onRequestClose={BackHandler.exitApp}>
        <StartupSplash ready={login.ready && !loading} onExited={finishLogin} screenTransition />
      </Modal>}
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  loading: { flex: 1, justifyContent: 'center' },
  startupOverlay: { ...StyleSheet.absoluteFillObject, zIndex: 1000, elevation: 1000, shadowColor: 'transparent' },
});
