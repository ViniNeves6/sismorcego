// src/hooks/useCoordenadorNotifications.js
// Só faz algo quando o papel logado é "coordenador": pede permissão de
// notificação, registra a tarefa de checagem em segundo plano (alvo de
// 1h, sem garantia — ver docs/superpowers/specs) e mantém o contador de
// não lidas em tempo real pro badge da aba.
import { useEffect, useState } from "react";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import BackgroundFetch from "react-native-background-fetch";
import notifee from "@notifee/react-native";
import { db } from "../services/firebase";
import { garantirCanalNotificacoes } from "../services/notificacaoLocal";
import { executarChecagemNotificacoes } from "../services/checagemNotificacoes";
import useAuth from "./useAuth";
import logger from "../utils/logger";

export default function useCoordenadorNotifications() {
  const { user, role } = useAuth();
  const [naoLidas, setNaoLidas] = useState(0);
  const isCoordenador = role === "coordenador";
  const uid = user?.uid;

  // Contador de não lidas em tempo real.
  useEffect(() => {
    if (!isCoordenador || !db || !uid) {
      setNaoLidas(0);
      return;
    }
    const q = query(collection(db, "usuarios", uid, "notificacoes"), where("lida", "==", false));
    const unsub = onSnapshot(
      q,
      (snap) => setNaoLidas(snap.size),
      () => setNaoLidas(0)
    );
    return () => unsub();
  }, [isCoordenador, uid]);

  // Permissão + canal + tarefa de segundo plano (registrada uma vez).
  useEffect(() => {
    if (!isCoordenador || !uid) return;
    let cancelled = false;

    (async () => {
      try {
        await notifee.requestPermission();
        await garantirCanalNotificacoes();
      } catch (e) {
        logger.warn("useCoordenadorNotifications: permissão/canal falhou", e);
      }
      if (cancelled) return;

      try {
        await BackgroundFetch.configure(
          { minimumFetchInterval: 60, stopOnTerminate: false, startOnBoot: true, enableHeadless: true },
          async (taskId) => {
            await executarChecagemNotificacoes(uid);
            BackgroundFetch.finish(taskId);
          },
          (taskId) => BackgroundFetch.finish(taskId)
        );
      } catch (e) {
        logger.warn("useCoordenadorNotifications: configurar BackgroundFetch falhou", e);
      }

      // Checagem imediata: não espera a primeira hora pra dar o primeiro sinal.
      executarChecagemNotificacoes(uid);
    })();

    return () => {
      cancelled = true;
    };
  }, [isCoordenador, uid]);

  return { naoLidas };
}
