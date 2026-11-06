// src/hooks/useAuth.js
import React, { createContext, useContext, useEffect, useRef, useState } from "react";

// Autenticação Firebase em produção; acesso local isolado em Debug.
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  signOut as firebaseSignOut,
  updateProfile,
  updateEmail,
  updatePassword,
} from "firebase/auth";

import { auth, db } from "../services/firebase";
import logger from "../utils/logger";
import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import { LOCAL_TEST_MODE, LOCAL_TEST_USER, LOCAL_TEST_ROLE } from '../services/debugTestSession';
import { isSharedPhotoUrl, saveLocalProfilePhoto, validateRegistration } from '../services/accountProfile';
import { detachPushDevice } from '../services/pushDevices';
import { ensureAccountRole } from '../services/accountBootstrap';
import { normalizeName, normalizeEmail } from '../services/editChanges';

// Busca o papel do usuário (usuarios/{uid}.role); cria o doc como "acs" se não existir.
const ensureUserRole = (uid,email) => ensureAccountRole(db,uid,email);

const AuthContext = createContext({
  user: null,
  role: null,
  loading: false,
  signIn: async () => {},
  signUp: async () => {},
  resetPassword: async () => {},
  signOut: async () => {},
  updateUser: async () => {},
});

export const AuthProvider = ({ children }) => {
  const registering = useRef(false);
  const [user, setUser] = useState(LOCAL_TEST_MODE ? LOCAL_TEST_USER : null);      // usuário atual (ou null)
  const [role, setRole] = useState(
    LOCAL_TEST_MODE ? (LOCAL_TEST_ROLE || 'acs') : null
  ); // "acs" | "coordenador" | null
  const [loading, setLoading] = useState(!LOCAL_TEST_MODE); // estado de carregamento inicial

  useEffect(() => {
    if (LOCAL_TEST_MODE) return undefined;
    // Se por algum motivo 'auth' não estiver configurado, não quebra a aplicação
    if (!auth) {
      logger.warn("useAuth: Firebase auth nao configurado");
      setUser(null);
      setLoading(false);
      return;
    }

    // Modo normal (autenticação real)
    let revision = 0;
    let sessionUser = null;
    const refreshRole = async (currentUser, request) => {
      const cacheKey = `@sismorcego:${currentUser.uid}:role`;
      const cached = await AsyncStorage.getItem(cacheKey).catch(() => null);
      if (request !== revision) return;
      setRole(cached === 'coordenador' ? 'coordenador' : 'acs');
      // A sessão autenticada continua disponível sem conexão. O cache de papel
      // só controla a navegação; as permissões da nuvem continuam nas regras.
      setLoading(false);
      try {
        const net = await NetInfo.fetch();
        if (!net.isConnected || net.isInternetReachable === false) return;
        const nextRole = await ensureUserRole(currentUser.uid, currentUser.email);
        if (request !== revision) return;
        setRole(nextRole);
        await AsyncStorage.setItem(cacheKey, nextRole);
      } catch (error) { logger.warn('useAuth: falha ao atualizar papel do usuário', error); }
    };
    const unsubscribe = onAuthStateChanged(auth, currentUser => {
      const changedAccount = sessionUser?.uid !== currentUser?.uid;
      sessionUser = currentUser;
      const request = ++revision;
      if (registering.current) return;
      if (changedAccount) setRole(null);
      setUser(currentUser || null);
      if (currentUser) refreshRole(currentUser, request);
      else {
        setRole(null);
        setLoading(false);
      }
    });
    const networkListener = NetInfo.addEventListener(net => {
      if (sessionUser && net.isConnected && net.isInternetReachable !== false) refreshRole(sessionUser, ++revision);
    });

    return () => {
      revision += 1;
      networkListener();
      try {
        unsubscribe && unsubscribe();
      } catch {
        // evita crash se unsubscribe for inválido
      }
    };
  }, []);

  // Helpers para evitar repetição
  const ensureAuthEnabled = () => {
    if (LOCAL_TEST_MODE) throw new Error('Modo de testes: autenticação Firebase desabilitada.');
    if (!auth) {
      const err = new Error("Firebase Auth não configurado.");
      err.code = "auth/not-configured";
      throw err;
    }
  };

  // Login. O papel (ACS/coordenador) é decidido pelo Firestore, não por
  // uma escolha na tela — quem for coordenador já ganha as telas extras
  // automaticamente (ver AppTabs.js), sem precisar de nenhum passo a mais aqui.
  const signIn = async (email, password) => {
    ensureAuthEnabled();
    const cred = await signInWithEmailAndPassword(auth, email, password);
    // Retorna o user para telas que verificam emailVerified
    return cred.user;
  };

  // Cadastro
  const signUp = async (email, password, { name, photoUri } = {}) => {
    ensureAuthEnabled();
    const errors = validateRegistration({ name, email, password, confirmPassword: password });
    if (Object.keys(errors).length) throw new Error(Object.values(errors)[0]);
    registering.current = true;
    setLoading(true);
    let createdUser;
    try {
      const cred = await createUserWithEmailAndPassword(auth, email.trim(), password);
      createdUser = cred.user;
      await updateProfile(cred.user, { displayName: name.trim() });
      if (photoUri) await saveLocalProfilePhoto(cred.user.uid, photoUri);
      await AsyncStorage.setItem(`@sismorcego:${cred.user.uid}:reporter`, name.trim());
      const nextRole = await ensureUserRole(cred.user.uid, cred.user.email);
      await AsyncStorage.setItem(`@sismorcego:${cred.user.uid}:role`, nextRole);
      setUser({ ...cred.user, displayName: name.trim() });
      setRole(nextRole);
      return cred.user;
    } catch (error) {
      if (createdUser && auth.currentUser?.uid === createdUser.uid) {
        // Auth e Firestore não formam uma transação. A conta já existe: abre a
        // sessão recuperável, em vez de exigir um segundo cadastro do email.
        setUser({ ...createdUser });
        setRole('acs');
        const incomplete = new Error('A conta foi criada. Complete seu nome em Minha conta; parte dos dados do perfil não pôde ser salva agora.');
        incomplete.code = 'auth/profile-incomplete';
        throw incomplete;
      }
      throw error;
    } finally {
      registering.current = false;
      setLoading(false);
    }
  };

  // Reset de senha
  const resetPassword = async (email) => {
    ensureAuthEnabled();
    await sendPasswordResetEmail(auth, email);
  };

  // Logout
  const signOut = async () => {
    ensureAuthEnabled();
    await detachPushDevice(auth.currentUser?.uid);
    await firebaseSignOut(auth);
  };

  // Atualizar perfil (nome, email, senha, foto)
  const updateUser = async ({ nome, email, senha, foto }) => {
    ensureAuthEnabled();
    if (!auth.currentUser) throw new Error("Nenhum usuário logado.");
    if (foto && !isSharedPhotoUrl(foto)) throw new Error('A foto local deve ser salva no aparelho até a integração com Storage estar disponível.');
    const currentUser = auth.currentUser;
    const nextName = nome === undefined ? undefined : normalizeName(nome);
    const nextEmail = email === undefined ? undefined : normalizeEmail(email);
    const nameChanged = nextName !== undefined && nextName !== normalizeName(currentUser.displayName);
    const emailChanged = Boolean(nextEmail) && nextEmail !== normalizeEmail(currentUser.email);
    const photoChanged = foto !== undefined && (foto ?? currentUser.photoURL ?? null) !== (currentUser.photoURL || null);
    if (!nameChanged && !emailChanged && !photoChanged && !senha) return;

    try {
      if (nameChanged || photoChanged) {
        await updateProfile(currentUser, {
          ...(nameChanged ? { displayName: nextName } : {}),
          ...(photoChanged ? { photoURL: foto ?? currentUser.photoURL } : {}),
        });
      }

      if (emailChanged) {
        try {
          await updateEmail(currentUser, nextEmail);
        } catch (err) {
          if (err.code === "auth/requires-recent-login") {
            throw new Error("⚠️ Refaça login antes de alterar o email.");
          }
          throw err;
        }
      }

      if (senha) {
        try {
          await updatePassword(auth.currentUser, senha);
        } catch (err) {
          if (err.code === "auth/requires-recent-login") {
            throw new Error("⚠️ Refaça login antes de alterar a senha.");
          }
          throw err;
        }
      }

      // Atualiza estado local com o usuário atualizado
      setUser({ ...auth.currentUser });
      if (nameChanged) await AsyncStorage.setItem(`@sismorcego:${auth.currentUser.uid}:reporter`, nextName);
    } catch (error) {
      logger.error("useAuth: updateUser failed", error);
      throw error;
    }
  };

  const contextValue = { user, role, loading, signIn, signUp, resetPassword, signOut, updateUser };

  return <AuthContext.Provider value={contextValue}>{children}</AuthContext.Provider>;
};

export default function useAuth() {
  return useContext(AuthContext);
}

