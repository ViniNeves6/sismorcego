import React, { useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import { auth, db, app } from '../services/firebase';
import { REAL_FIREBASE_HOMOLOGATION, USE_FIREBASE_EMULATORS } from '../services/appEnvironment';
import { createEvaluationSession } from '../services/evaluationSession';
import AuthContext from './authContext';

const managedAccount = async () => { throw new Error('Esta conta é gerenciada pela equipe responsável pela avaliação.'); };
const unavailable = async () => { throw new Error('O acesso à avaliação ainda está sendo preparado.'); };
export default function EvaluationAuthProvider({ children }) {
  const controller = useRef(null);
  const [evaluation, setEvaluation] = useState({ status: 'checking', user: null, role: null, reason: null });
  useEffect(() => {
    // Own the controller in this effect so a StrictMode cleanup/setup cycle
    // never reuses a disposed session or duplicates Firebase listeners.
    const session = createEvaluationSession({ auth, db, projectId: app?.options?.projectId,
      firebaseEnabled: REAL_FIREBASE_HOMOLOGATION || USE_FIREBASE_EMULATORS,
      online: async () => { const net = await NetInfo.fetch(); return Boolean(net.isConnected && net.isInternetReachable !== false); } });
    controller.current = session;
    const unsubscribe = session.subscribe(setEvaluation);
    session.start();
    const foreground = AppState.addEventListener('change', state => session.setForeground(state === 'active'));
    const network = NetInfo.addEventListener(net => { if (net.isConnected && net.isInternetReachable !== false) session.revalidate(true); });
    // Bound detection time while the app remains foregrounded. Server rules
    // still enforce the real Firebase session and the chosen role.
    const periodic = setInterval(() => { if (AppState.currentState === 'active') session.revalidate(); }, 45000);
    return () => { clearInterval(periodic); foreground.remove(); network(); unsubscribe(); session.dispose();
      if (controller.current === session) controller.current = null; };
  }, []);
  const call = name => (...args) => controller.current ? controller.current[name](...args) : unavailable();
  return <AuthContext.Provider value={{ user: evaluation.user, role: evaluation.role, loading: false,
    evaluation, retrySession: () => controller.current?.revalidate(true),
    signInAcs: call('signInAcs'), signIn: call('signInCoordinator'), signOut: call('signOut'),
    signUp: managedAccount, resetPassword: managedAccount, updateUser: managedAccount }}>
    {children}
  </AuthContext.Provider>;
}
