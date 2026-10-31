import { NativeModules } from 'react-native';

// Somente o tipo nativo homologation pode usar a nuvem. Um parâmetro de tela,
// preferência ou variável do Metro não transforma o APK local em homologação.
export const USE_FIREBASE_EMULATORS = NativeModules.SismorcegoBuild?.firebaseEmulator === true;
export const REAL_FIREBASE_HOMOLOGATION = !USE_FIREBASE_EMULATORS && NativeModules.SismorcegoBuild?.realFirebase === true;
