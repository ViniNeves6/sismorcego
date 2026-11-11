// src/services/firebase.js
// Firebase real. Os registros offline são persistidos na fila SQLite criptografada.

import { initializeApp, getApps, getApp } from "firebase/app";
import {
  initializeFirestore,
  memoryLocalCache,
  getFirestore,
  connectFirestoreEmulator,
} from "firebase/firestore";
import {
  initializeAuth,
  getAuth,
  getReactNativePersistence,
  connectAuthEmulator,
} from "firebase/auth";
import AsyncStorage from "@react-native-async-storage/async-storage";
import logger from '../utils/logger';
import { COORDINATOR_EVALUATION, USE_FIREBASE_EMULATORS } from './appEnvironment';
import { secureEvaluationStorage } from './secureEvaluationStorage';

// =====================
// Configuração do Firebase
// =====================
const firebaseConfig = USE_FIREBASE_EMULATORS ? {
  apiKey: 'fake-emulator-key', projectId: 'demo-sismorcego-spark', appId: 'demo-sismorcego-android',
} : {
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

// O SDK web do Firestore não dispõe de IndexedDB no React Native.
if (app) {
  try {
    db = initializeFirestore(app, {
      localCache: memoryLocalCache(),
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

// Exclusivo do APK com pacote .emulador: projeto demo e destinos fixos locais.
// Não há fallback para o Firebase real se os emuladores estiverem desligados.
if (USE_FIREBASE_EMULATORS) {
  if (db) connectFirestoreEmulator(db, '10.0.2.2', 8088);
}

// Auth com persistência em AsyncStorage (não recria no hot reload)
if (app) {
  try {
    auth = initializeAuth(app, {
      persistence: getReactNativePersistence(COORDINATOR_EVALUATION ? secureEvaluationStorage : AsyncStorage),
    });
  } catch (e1) {
    // Se já tiver sido inicializado (ex.: hot reload), usa getAuth
    try {
      if (COORDINATOR_EVALUATION && e1.code !== 'auth/already-initialized') throw e1;
      auth = getAuth(app);
    } catch (e2) {
      logger.warn("[firebase] Auth indisponível. Continuando sem auth.", e2);
      auth = null;
    }
  }
}

if (USE_FIREBASE_EMULATORS && auth) connectAuthEmulator(auth, 'http://10.0.2.2:9099', { disableWarnings: true });

// =====================
// Utilitários/Fallback
// =====================

// Indica se firebase está pronto para uso (db e/ou auth)
const isFirebaseReady = Boolean(app) && (Boolean(db) || Boolean(auth));

export { app, db, auth, isFirebaseReady };
