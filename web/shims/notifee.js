// Notificações locais não fazem parte da versão web.
export const AuthorizationStatus = { NOT_DETERMINED: -1, DENIED: 0, AUTHORIZED: 1, PROVISIONAL: 2 };
export const AndroidImportance = { DEFAULT: 3, HIGH: 4, LOW: 2, MIN: 1, NONE: 0 };
export const AndroidVisibility = { PRIVATE: 0, PUBLIC: 1, SECRET: -1 };
export const EventType = { UNKNOWN: -1, DISMISSED: 0, PRESS: 1, ACTION_PRESS: 2, DELIVERED: 3 };
const denied = { authorizationStatus: AuthorizationStatus.DENIED };
const notifee = {
  createChannel: async () => 'web', displayNotification: async () => null, cancelNotification: async () => {},
  cancelAllNotifications: async () => {}, getNotificationSettings: async () => denied,
  requestPermission: async () => denied, onForegroundEvent: () => () => {}, onBackgroundEvent: () => {},
  getInitialNotification: async () => null, setBadgeCount: async () => {}, getBadgeCount: async () => 0,
  openNotificationSettings: async () => {},
};
export default notifee;
