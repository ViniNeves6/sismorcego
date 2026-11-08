// Push nativo desligado (FIREBASE_PUSH_BACKEND_READY = false); nada é chamado na web.
const off = () => () => {};
export const getMessaging = () => ({});
export const getToken = async () => null;
export const deleteToken = async () => {};
export const getInitialNotification = async () => null;
export const onMessage = off;
export const onNotificationOpenedApp = off;
export const onTokenRefresh = off;
export const setBackgroundMessageHandler = () => {};
export default () => ({});
