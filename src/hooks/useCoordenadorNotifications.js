// src/hooks/useCoordenadorNotifications.js
// Permissão/canal e contador opcional. Alertas são gerados pelo servidor.
import { useEffect, useState } from "react";
import { DeviceEventEmitter } from 'react-native';
import { collection, onSnapshot, query, where } from "firebase/firestore";
import notifee from "@notifee/react-native";
import { db } from "../services/firebase";
import { garantirCanalNotificacoes } from "../services/notificacaoLocal";
import useAuth from "./useAuth";
import logger from "../utils/logger";
import { notificationsAllowed } from '../services/notificationPreferences';
import { canAccessCoordinatorArea } from '../services/roleAccess';
import { LOCAL_TEST_MODE } from '../services/debugTestSession';
import { pushBackendEnabled } from '../services/pushDevices';

export default function useCoordenadorNotifications({ trackUnread = true, enabled = true } = {}) {
  const { user, role } = useAuth();
  const [naoLidas, setNaoLidas] = useState(0);
  const isCoordenador = canAccessCoordinatorArea(role) && !LOCAL_TEST_MODE;
  const uid = user?.uid;

  // Contador de não lidas em tempo real.
  useEffect(() => {
    if (!enabled || !trackUnread || !isCoordenador || !db || !uid) {
      setNaoLidas(0);
      return;
    }
    let active = true;
    const q = query(collection(db, "usuarios", uid, "notificacoes"), where("lida", "==", false));
    const unsub = onSnapshot(
      q,
      (snap) => { if (active) setNaoLidas(snap.size); },
      () => { if (active) setNaoLidas(0); }
    );
    return () => { active = false; unsub(); };
  }, [enabled, isCoordenador, uid, trackUnread]);

  // Permissão + canal; não consulta ocorrências para gerar alertas no aparelho.
  useEffect(() => {
    if (!enabled || !isCoordenador || !uid || !pushBackendEnabled()) return;

    (async () => {
      try {
        if (await notificationsAllowed(uid)) {
          await notifee.requestPermission();
          await garantirCanalNotificacoes();
          DeviceEventEmitter.emit('notifications:changed');
        }
      } catch (e) {
        logger.warn("useCoordenadorNotifications: permissão/canal falhou", e);
      }

    })();

  }, [enabled, isCoordenador, uid]);

  return { naoLidas: enabled && isCoordenador ? naoLidas : 0 };
}
