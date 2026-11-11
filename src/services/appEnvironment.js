import { NativeModules, Platform } from 'react-native';

// O tipo de build vem do módulo nativo SismorcegoBuild (Android: BuildConfig por
// variante). Um parâmetro de tela, preferência ou variável do Metro não
// transforma o APK local em homologação.
// No iOS e na versão web não há variantes: esta branch existe só para a
// avaliação, então eles são sempre a versão de treinamento com Firebase real.
const EVALUATION_BUILD = Object.freeze({ realFirebase: true, coordinatorEvaluation: true, firebaseEmulator: false });
const build = NativeModules.SismorcegoBuild || (['ios', 'web'].includes(Platform.OS) ? EVALUATION_BUILD : undefined);

export const USE_FIREBASE_EMULATORS = build?.firebaseEmulator === true;
export const COORDINATOR_EVALUATION = build?.coordinatorEvaluation === true;
export const REAL_FIREBASE_HOMOLOGATION = !USE_FIREBASE_EMULATORS && build?.realFirebase === true;
// Nenhuma credencial de avaliação vem do build nativo: o coordenador digita
// e-mail e senha, e o ACS entra com uma conta anônima por aparelho.
