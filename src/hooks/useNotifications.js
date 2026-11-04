import { useCallback, useEffect, useState } from 'react';
import { AppState, DeviceEventEmitter } from 'react-native';
import notifee, { AuthorizationStatus } from '@notifee/react-native';
import useAuth from './useAuth';
import { notificationsAllowed, setNotificationsAllowed } from '../services/notificationPreferences';

export default function useNotifications({ enabled: dataEnabled = true } = {}) {
  const { user } = useAuth();
  const [enabled, setEnabled] = useState(false);
  const refresh = useCallback(async () => {
    if (!dataEnabled) return;
    const settings = await notifee.getNotificationSettings();
    setEnabled(await notificationsAllowed(user?.uid) && settings.authorizationStatus >= AuthorizationStatus.AUTHORIZED);
  }, [dataEnabled, user?.uid]);
  useEffect(() => {
    if (!dataEnabled) return;
    refresh().catch(() => setEnabled(false));
    const listener = AppState.addEventListener('change', state => { if (state === 'active') refresh().catch(() => setEnabled(false)); });
    const changed = DeviceEventEmitter.addListener('notifications:changed', () => refresh().catch(() => setEnabled(false)));
    return () => { listener.remove(); changed.remove(); };
  }, [dataEnabled, refresh]);
  const toggleNotifications = async next => {
    if (!dataEnabled) return;
    const value = typeof next === 'boolean' ? next : !enabled;
    await setNotificationsAllowed(value);
    setEnabled(value);
  };
  return { notificationsEnabled: dataEnabled && enabled, toggleNotifications };
}
