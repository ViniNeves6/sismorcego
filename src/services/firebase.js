// src/services/firebase.js
// Inicialização segura do Firebase com fallback offline para testes.
// Objetivo: não quebrar a aplicação quando o Firebase não estiver acessível/configurado.

import { initializeApp, getApps, getApp } from "firebase/app";
import {
  initializeFirestore,
  persistentLocalCache,
  // persistentMultipleTabManager, // não é necessário em React Native
  getFirestore,
} from "firebase/firestore";
import {
  initializeAuth,
  getAuth,
  getReactNativePersistence,
} from "firebase/auth";
import AsyncStorage from "@react-native-async-storage/async-storage";
import logger from '../utils/logger';

// =====================
// Configuração do Firebase
// =====================
const firebaseConfig = {
  apiKey: "AIzaSyBPZUnFdq82vSa0WCrbqMRXSpzkyRPQxdM",
  authDomain: "sismorcego-50b25.firebaseapp.com",
  projectId: "sismorcego-50b25",
  storageBucket: "sismorcego-50b25.firebasestorage.app",
  messagingSenderId: "698315766055",
  appId: "1:698315766055:web:4015ec00aae11bfbfe1102",
  measurementId: "G-28DFXY0X41",
};

// Valida se as chaves mínimas existem (evita crash em ambientes sem .env)
function hasMinimalConfig(cfg) {
  return Boolean(cfg && cfg.apiKey && cfg.projectId && cfg.appId);
}

// =====================
// Inicialização segura
// =====================
let app = null;
let db = null;
let auth = null;

// Tenta criar/obter o app
try {
  if (hasMinimalConfig(firebaseConfig)) {
    app = getApps().length ? getApp() : initializeApp(firebaseConfig);
  } else {
    logger.warn(
      "[firebase] Configuração mínima ausente. Executando em modo offline."
    );
  }
} catch (e) {
  logger.warn("[firebase] Falha ao inicializar o app. Continuando offline.", e);
  app = null;
}

// Firestore com cache local persistente (em RN, sem tabManager)
if (app) {
  try {
    // Em RN o cache local persistente já é suficiente
    db = initializeFirestore(app, {
      localCache: persistentLocalCache(),
    });
  } catch (e1) {
    logger.warn(
      "[firebase] initializeFirestore falhou; tentando getFirestore.",
      e1
    );
    try {
      db = getFirestore(app);
    } catch (e2) {
      logger.warn("[firebase] getFirestore também falhou. Continuando sem db.", e2);
      db = null;
    }
  }
}

// Auth com persistência em AsyncStorage (não recria no hot reload)
if (app) {
  try {
    auth = initializeAuth(app, {
      persistence: getReactNativePersistence(AsyncStorage),
    });
  } catch (e1) {
    // Se já tiver sido inicializado (ex.: hot reload), usa getAuth
    try {
      auth = getAuth(app);
    } catch (e2) {
      logger.warn("[firebase] Auth indisponível. Continuando sem auth.", e2);
      auth = null;
    }
  }
}

// =====================
// Utilitários/Fallback
// =====================

// Indica se firebase está pronto para uso (db e/ou auth)
const isFirebaseReady = Boolean(app) && (Boolean(db) || Boolean(auth));

/**
 * ✅ Em produção: NUNCA retorna UID fake
 * - Retorna uid real ou null
 * ✅ Em DEV: opcionalmente retorna "dev-offline" para testes
 */
function getUserIdOrDevOffline() {
  const uid = auth?.currentUser?.uid || null;
  if (uid) return uid;

  // DEV only fallback
  return __DEV__ ? "dev-offline" : null;
}

/**
 * ✅ Coleções DEV apenas em __DEV__
 * Em produção, não use coleções de teste por falta de Firebase.
 */
function useDevCollections() {
  return __DEV__;
}

// =====================
// Exports
// =====================

export { app, db, auth };
export { isFirebaseReady, getUserIdOrDevOffline, useDevCollections };

/*
Uso recomendado nas telas (ex.: NovoRegistro / Buscar):

import { db, isFirebaseReady, getUserIdOrDevOffline, useDevCollections } from '@/services/firebase';

// UID seguro para criar/filtrar documentos
const uid = getUserIdOrDevOffline();

// Exemplo: escolher coleção de teste quando em dev
const colName = useDevCollections() ? 'registros_dev' : 'registros';

// Se precisar garantir que Firestore existe:
if (!isFirebaseReady || !db) {
  // usar SQLite/fallback local aqui
}

// Verificação segura antes de operações:
if (uid) {
  // Só executa operações que dependem de UID se tiver um usuário autenticado
} else {
  // Em produção sem usuário, não tenta escrever no Firestore
}

*/