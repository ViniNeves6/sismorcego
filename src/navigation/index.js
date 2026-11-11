// src/navigation/index.js
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { ActivityIndicator, Animated, Easing, StyleSheet, View } from 'react-native';
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
import { COORDINATOR_EVALUATION } from '../services/appEnvironment';
import EvaluationSetupScreen from '../pages/Auth/EvaluationSetupScreen';
import AuthContext from '../hooks/authContext';

const Stack = createNativeStackNavigator();
const EVALUATION_ROLES = ['acs', 'coordenador'];

// Cobre o Shell com a tela de status da avaliação sem desmontá-lo, com
// entrada e saída em fade. O conteúdo por baixo (formulário em preenchimento,
// aba aberta) volta intacto quando o acesso é confirmado de novo.
function SessionCover({ visible, reduceMotion }) {
  const [rendered, setRendered] = useState(visible);
  const opacity = useRef(new Animated.Value(visible ? 1 : 0)).current;
  useEffect(() => {
    if (visible) setRendered(true);
    if (reduceMotion) { opacity.setValue(visible ? 1 : 0); if (!visible) setRendered(false); return undefined; }
    const animation = Animated.timing(opacity, { toValue: visible ? 1 : 0, duration: visible ? 200 : 180,
      easing: Easing.out(Easing.cubic), useNativeDriver: true });
    animation.start(({ finished }) => { if (finished && !visible) setRendered(false); });
    return () => animation.stop();
  }, [visible, reduceMotion, opacity]);
  if (!rendered) return null;
  return <Animated.View style={[styles.sessionCover, { opacity }]} pointerEvents={visible ? 'auto' : 'none'}>
    <EvaluationSetupScreen />
  </Animated.View>;
}

export default function Navigation() {
  const auth = useAuth();
  const { user: authenticatedUser, role, evaluation, loading } = auth;
  const sessionReady = !COORDINATOR_EVALUATION || (evaluation?.status === 'ready' && EVALUATION_ROLES.includes(role));
  // Avaliação: a revalidação (volta da galeria/GPS, rede, prazo) não pode
  // desmontar o Shell e apagar uma ficha em preenchimento. A sessão confirmada
  // fica retida e coberta pela tela de status; só sair da conta a descarta.
  const [retained, setRetained] = useState(null);
  useEffect(() => {
    if (!COORDINATOR_EVALUATION) return;
    if (sessionReady && authenticatedUser) {
      setRetained(previous => (previous?.user === authenticatedUser && previous?.role === role ? previous : { user: authenticatedUser, role }));
    } else if (evaluation?.status === 'signed-out') setRetained(null);
  }, [sessionReady, authenticatedUser, role, evaluation?.status]);
  const retainedSession = COORDINATOR_EVALUATION && !sessionReady && evaluation?.status !== 'signed-out' ? retained : null;
  const sessionCovered = Boolean(retainedSession);
  const user = sessionReady ? authenticatedUser : retainedSession?.user || null;
  const shellAuth = sessionCovered ? { ...auth, user: retainedSession.user, role: retainedSession.role } : auth;
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
            {user ? <View style={styles.fill}>
              <View style={styles.fill} accessibilityElementsHidden={sessionCovered}
                importantForAccessibility={sessionCovered ? 'no-hide-descendants' : 'auto'}>
                <AuthContext.Provider value={shellAuth}>
                  <Stack.Navigator key={user.uid} screenOptions={{ headerShown: false, animation: reduceMotion ? 'none' : 'slide_from_right' }}>
                    <Stack.Screen name="Inicio" component={SismorcegoShell} />
                  </Stack.Navigator>
                </AuthContext.Provider>
              </View>
              {COORDINATOR_EVALUATION && <SessionCover visible={sessionCovered} reduceMotion={reduceMotion} />}
            </View> : <View style={styles.fill} testID="startup-login-layout" onLayout={readyStartupLogin}>
              {COORDINATOR_EVALUATION ? <EvaluationSetupScreen /> : <AuthStack />}
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
  sessionCover: { ...StyleSheet.absoluteFillObject, zIndex: 900, elevation: 900 },
  startupOverlay: { ...StyleSheet.absoluteFillObject, zIndex: 1000, elevation: 1000, shadowColor: 'transparent' },
});
