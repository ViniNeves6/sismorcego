// src/hooks/useSalvarRegistro.js
// Salvar um registro (qualquer tipo de vítima): fila local + sync quando
// há internet. Compartilhado pelas 4 telas de registro/registro/*.js.
import { useCallback, useEffect, useState } from "react";
import { DeviceEventEmitter } from "react-native";
import NetInfo from "@react-native-community/netinfo";
import "react-native-get-random-values";
import { completeRecordDraft, getRecordDraftIdentity, newRecordId } from '../services/recordDraftIdentity';

import { addToQueue } from "../services/offlineQueue";
import { syncPendingRegistros } from "../services/syncRegistros";
import { auth } from "../services/firebase";
import { useToast } from "../ui";
import logger from "../utils/logger";

export default function useSalvarRegistro() {
  const toast = useToast();
  const [saving, setSaving] = useState(false);

  const safeSync = useCallback((opts) => {
    syncPendingRegistros(opts).catch(() => {});
  }, []);

  useEffect(() => {
    if (auth?.currentUser?.uid) getRecordDraftIdentity(auth.currentUser.uid).catch(() => {});
    const notify = (n) => {
      toast.show(`${n} registro(s) enviados para o servidor.`, { tone: "success" });
      DeviceEventEmitter.emit("registros:changed");
    };

    const unsub = NetInfo.addEventListener((state) => {
      if (state.isConnected && state.isInternetReachable) safeSync({ notify });
    });

    safeSync();
    return () => unsub();
  }, [safeSync, toast]);

  const salvar = useCallback(
    async ({ comum, tipoVitima, detalhes }) => {
      const user = auth?.currentUser;
      if (!user) {
        toast.show("Faça login para criar registros e sincronizar depois.", { tone: "danger" });
        return false;
      }

      setSaving(true);
      const now = new Date().toISOString();

      const registroData = {
        tipoVitima,
        ...comum,
        uid: user.uid,
        lifecycleVersion: 2,
        detalhes,
        status: "pending",
        retryCount: 0,
        lastError: null,
        localRevision: newRecordId(),
        updatedAtLocal: now,
      };

      try {
        const identity = await getRecordDraftIdentity(user.uid);
        registroData.recordId = identity.id;
        registroData.createdAt = identity.createdAt;
        await addToQueue(registroData);
        await completeRecordDraft(user.uid, identity.id);

        toast.show("Registro salvo no aparelho. Será enviado quando houver internet.", { tone: "success" });
        DeviceEventEmitter.emit("registros:changed");

        safeSync({
          notify: (n) => {
            toast.show(`${n} registro(s) enviados para o servidor.`, { tone: "success" });
            DeviceEventEmitter.emit("registros:changed");
          },
        });

        return true;
      } catch (error) {
        logger.error("Erro ao salvar registro:", error);
        toast.show("Não foi possível salvar o registro no aparelho.", { tone: "danger" });
        return false;
      } finally {
        setSaving(false);
      }
    },
    [safeSync, toast]
  );

  return { salvar, saving };
}
