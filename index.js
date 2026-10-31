/**
 * @format
 */

import 'react-native-get-random-values';
import { AppRegistry } from 'react-native';
import notifee, { EventType } from '@notifee/react-native';
import App from './App';
import { name as appName } from './app.json';
import { registerPushBackgroundHandler } from './src/services/coordinatorPush';
import { rememberNotificationPress } from './src/services/notificationNavigation';

AppRegistry.registerComponent(appName, () => App);
notifee.onBackgroundEvent(async ({ type, detail }) => {
  if (type === EventType.PRESS) await rememberNotificationPress(detail?.notification?.data);
});
registerPushBackgroundHandler();
