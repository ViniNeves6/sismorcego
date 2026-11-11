import { COORDINATOR_EVALUATION, REAL_FIREBASE_HOMOLOGATION, USE_FIREBASE_EMULATORS } from './appEnvironment';
// Debug/release preservam o acesso local; homologação possui pacote separado.
export const LOCAL_TEST_MODE = !COORDINATOR_EVALUATION && !REAL_FIREBASE_HOMOLOGATION && !USE_FIREBASE_EMULATORS;
export const LOCAL_TEST_ROLE = 'acs'; // 'acs' | 'coordenador'
export const LOCAL_TEST_USER = Object.freeze({
  uid: 'sismorcego-debug-local',
  displayName: 'Agente de Teste',
  email: 'teste@local.invalid',
  emailVerified: false,
});
