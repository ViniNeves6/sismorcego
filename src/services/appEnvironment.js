import { NativeModules } from 'react-native';

// Somente o tipo nativo homologation pode usar a nuvem. Um parâmetro de tela,
// preferência ou variável do Metro não transforma o APK local em homologação.
export const USE_FIREBASE_EMULATORS = NativeModules.SismorcegoBuild?.firebaseEmulator === true;
export const COORDINATOR_EVALUATION = NativeModules.SismorcegoBuild?.coordinatorEvaluation === true;
export const REAL_FIREBASE_HOMOLOGATION = !USE_FIREBASE_EMULATORS && NativeModules.SismorcegoBuild?.realFirebase === true;
export const EVALUATION_ACCESS_URL = !COORDINATOR_EVALUATION ? '' : USE_FIREBASE_EMULATORS
  ? 'http://10.0.2.2:5001/demo-sismorcego-spark/southamerica-east1/evaluationAccess'
  : REAL_FIREBASE_HOMOLOGATION ? 'https://southamerica-east1-sismorcego-50b25.cloudfunctions.net/evaluationAccess' : '';
