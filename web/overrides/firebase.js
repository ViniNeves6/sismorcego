// Web: substitui src/services/firebase.js. Mesmo projeto Firebase; a sessão fica
// no IndexedDB do navegador (persistência padrão do SDK web).
import { initializeApp, getApps, getApp } from 'firebase/app';
import { initializeFirestore, memoryLocalCache, getFirestore } from 'firebase/firestore';
import { initializeAuth, getAuth, indexedDBLocalPersistence, browserLocalPersistence } from 'firebase/auth';

const firebaseConfig = {
  apiKey: 'AIzaSyBPZUnFdq82vSa0WCrbqMRXSpzkyRPQxdM',
  authDomain: 'sismorcego-50b25.firebaseapp.com',
  projectId: 'sismorcego-50b25',
  storageBucket: 'sismorcego-50b25.firebasestorage.app',
  messagingSenderId: '698315766055',
  appId: '1:698315766055:web:4015ec00aae11bfbfe1102',
  measurementId: 'G-28DFXY0X41',
};

const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
let db;
try { db = initializeFirestore(app, { localCache: memoryLocalCache() }); } catch { db = getFirestore(app); }
let auth;
try { auth = initializeAuth(app, { persistence: [indexedDBLocalPersistence, browserLocalPersistence] }); } catch { auth = getAuth(app); }

const isFirebaseReady = true;
export { app, db, auth, isFirebaseReady };
