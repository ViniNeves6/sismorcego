import { useCallback, useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import notifee, { EventType } from '@notifee/react-native';
import useAuth from './useAuth';
import { canAccessCoordinatorArea } from '../services/roleAccess';
import { consumeNotificationPress } from '../services/notificationNavigation';
import { occurrencePushTarget } from '../services/alertContract';
import { listenCoordinatorPush } from '../services/coordinatorPush';

const COORDINATOR_SCREENS = ['Painel', 'Notificacoes'];

export default function useCoordinatorNavigation(navigation, showToast, onOpenRecord, { enabled = true } = {}) {
  const { user, role } = useAuth();
  const uid = user?.uid;
  const allowed = Boolean(uid && canAccessCoordinatorArea(role));
  const accessRef = useRef(allowed);
  accessRef.current = allowed;
  const recordCallback = useRef(onOpenRecord);
  recordCallback.current = onOpenRecord;

  const openCoordinatorScreen = useCallback(screen => {
    if (accessRef.current && COORDINATOR_SCREENS.includes(screen)) {
      navigation.navigate(screen);
    }
  }, [navigation]);

  useEffect(() => {
    if (!allowed || !enabled) return;
    let active = true;
    const openTarget = target => {
      if (!active || !accessRef.current || (target?.recipientUid && target.recipientUid !== uid)) return;
      openCoordinatorScreen('Notificacoes');
      if (target && typeof target === 'object') recordCallback.current?.(target);
    };
    const openPending = async () => {
      const initial = await notifee.getInitialNotification();
      if (!active) return;
      const pending = await consumeNotificationPress();
      if (active && (initial || pending)) openTarget(typeof pending === 'object' ? pending : occurrencePushTarget(initial?.notification?.data));
    };
    const checkPending = () => openPending().catch(error => {
      if (active) showToast(error.message);
    });
    checkPending();
    const foreground = notifee.onForegroundEvent(({ type, detail }) => {
      if (active && type === EventType.PRESS) openTarget(occurrencePushTarget(detail?.notification?.data));
    });
    const push = listenCoordinatorPush(uid, () => active && accessRef.current, openTarget, error => { if (active) showToast(error.message); });
    const listener = AppState.addEventListener('change', state => {
      if (state === 'active') checkPending();
    });
    return () => { active = false; foreground(); push(); listener.remove(); };
  }, [allowed, enabled, uid, openCoordinatorScreen, showToast]);

  return openCoordinatorScreen;
}
