/* eslint-env jest */
jest.mock('react-native-share', () => ({ __esModule: true, default: { open: jest.fn().mockResolvedValue({ success: true }) } }));
// Somente fronteiras nativas indisponíveis no processo Node dos testes.
jest.mock('@react-native-async-storage/async-storage', () => require('@react-native-async-storage/async-storage/jest/async-storage-mock'));
jest.mock('react-native-tts', () => ({
  getInitStatus: jest.fn().mockResolvedValue(true),
  setDefaultLanguage: jest.fn().mockResolvedValue(), setDucking: jest.fn(),
  stop: jest.fn().mockResolvedValue(), speak: jest.fn().mockResolvedValue(),
}));
jest.mock('@notifee/react-native', () => ({
  __esModule: true,
  AuthorizationStatus: { DENIED: 0, AUTHORIZED: 1, PROVISIONAL: 2 },
  AndroidImportance: { DEFAULT: 3 }, EventType: { PRESS: 1 },
  AndroidVisibility: { PRIVATE: 0 },
  default: {
    requestPermission: jest.fn().mockResolvedValue({ authorizationStatus: 1 }),
    getNotificationSettings: jest.fn().mockResolvedValue({ authorizationStatus: 1 }),
    cancelAllNotifications: jest.fn().mockResolvedValue(),
    createChannel: jest.fn().mockResolvedValue('registros'),
    displayNotification: jest.fn().mockResolvedValue(),
    onForegroundEvent: jest.fn(() => () => {}),
    getInitialNotification: jest.fn().mockResolvedValue(null),
  },
}));
jest.mock('@react-native-firebase/messaging', () => ({
  getMessaging: jest.fn(() => ({})), getToken: jest.fn().mockResolvedValue('mock-fcm-token'),
  deleteToken: jest.fn().mockResolvedValue(), onTokenRefresh: jest.fn(() => jest.fn()),
  onMessage: jest.fn(() => jest.fn()), onNotificationOpenedApp: jest.fn(() => jest.fn()),
  getInitialNotification: jest.fn().mockResolvedValue(null), setBackgroundMessageHandler: jest.fn(),
}));

// O preset do Jest simula iOS, onde a ausência do módulo nativo significa
// "versão de treinamento". Os testes partem de um build local explícito; cada
// suíte que testa homologação/avaliação simula o próprio ambiente.
require('react-native').NativeModules.SismorcegoBuild = {};
