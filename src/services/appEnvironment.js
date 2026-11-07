import { NativeModules } from 'react-native';

// Somente o tipo nativo homologation pode usar a nuvem. Um parâmetro de tela,
// preferência ou variável do Metro não transforma o APK local em homologação.
export const USE_FIREBASE_EMULATORS = NativeModules.SismorcegoBuild?.firebaseEmulator === true;
export const COORDINATOR_EVALUATION = NativeModules.SismorcegoBuild?.coordinatorEvaluation === true;
export const REAL_FIREBASE_HOMOLOGATION = !USE_FIREBASE_EMULATORS && NativeModules.SismorcegoBuild?.realFirebase === true;
// Evaluation-only application credentials supplied by the native build. They
// can be recovered from this temporary APK, as accepted by its distributor.
// Administrative credentials are never supplied to the application.
export const EVALUATION_CREDENTIALS = COORDINATOR_EVALUATION && (REAL_FIREBASE_HOMOLOGATION || USE_FIREBASE_EMULATORS)
  ? { email: NativeModules.SismorcegoBuild?.evaluationEmail || '', password: NativeModules.SismorcegoBuild?.evaluationPassword || '' }
  : null;
