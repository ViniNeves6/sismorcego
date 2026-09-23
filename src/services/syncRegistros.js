// src/services/syncRegistros.js
import { doc, serverTimestamp, setDoc } from "firebase/firestore";
import NetInfo from "@react-native-community/netinfo";
import { loadQueue, updateQueueItem, removeFromQueue } from "./offlineQueue";
import { db, auth } from "../services/firebase";

let syncing = false;

/**
 * Remove campos que NÃO devem subir para o servidor
 * e padroniza timestamps do Firestore.
 */
  function buildCloudPayload(registro, uid) {
    if (!registro || !uid) return null;

    return {
      // Identificação
      recordId: String(registro.recordId),
      uid: uid,

      // Dados essenciais do registro
      nomeAcs: registro.nomeAcs ?? null,
      nomeAgredido: registro.nomeAgredido ?? null,
      apelido: registro.apelido ?? null,
      idade: typeof registro.idade === "number" ? registro.idade : null,
      sexo: registro.sexo ?? null,
      tratamentoAntirrabico: registro.tratamentoAntirrabico ?? null,
      dataRegistro: registro.dataRegistro ?? null,
      dataAgressao: registro.dataAgressao ?? null,
      municipio: registro.municipio ?? null,
      animalAgredido: registro.animalAgredido ?? null,
      circunstancia: registro.circunstancia ?? null,
      possivelAbrigo: registro.possivelAbrigo ?? null,
      abrigoOpcao: registro.abrigoOpcao ?? null,
      abrigoOutro: registro.abrigoOutro ?? null,

      // Localização (somente o necessário)
      location: registro.location
        ? {
            latitude: registro.location.latitude ?? null,
            longitude: registro.location.longitude ?? null,
            accuracy: registro.location.accuracy ?? null,
            isHighAccuracy: !!registro.location.isHighAccuracy,
            source: registro.location.source ?? null,
          }
        : null,

      // Foto (somente o que for realmente usado no servidor)
      photoBase64: registro.photoBase64 ?? null,
      photoMime: registro.photoMime ?? null,
      photoSize: registro.photoSize ?? null,

      // Status controlado pela nuvem
      status: "synced",

      // Timestamps padronizados
      createdAt: registro.createdAt ?? serverTimestamp(),
      updatedAt: serverTimestamp(),
    };
  }

export async function syncPendingRegistros({ notify } = {}) {
  if (syncing) return { synced: 0, skipped: true, reason: "already-syncing" };
  syncing = true;

  try {
    const user = auth?.currentUser;
    if (!user) return { synced: 0, reason: "no-user" };

    if (!db) return { synced: 0, reason: "no-db" };

    const net = await NetInfo.fetch();
    const isOnline = !!(net.isConnected && net.isInternetReachable !== false);
    if (!isOnline) return { synced: 0, reason: "offline" };

    const queue = await loadQueue();
    const pending = (Array.isArray(queue) ? queue : []).filter((r) => {
      return r?.recordId && r?.status !== "synced";
    });

    if (pending.length === 0) return { synced: 0, reason: "empty" };

    const okIds = [];
    let syncedCount = 0;
    let failedCount = 0;

    for (const registro of pending) {
      const recordId = registro?.recordId;
      if (!recordId) {
        failedCount += 1;
        continue;
      }

      try {
        // marca syncing no SQLite (fila)
        try {
          await updateQueueItem(recordId, {
            status: "syncing",
            lastError: null,
            retryCount: registro?.retryCount || 0,
          });
        } catch (_e) {}

        // registros/{uid}/itens/{recordId}
        const ref = doc(db, "registros", user.uid, "itens", String(recordId));

        const payload = buildCloudPayload(registro, user.uid);

        await setDoc(ref, payload, { merge: true });

        okIds.push(String(recordId));
        syncedCount += 1;
      } catch (err) {
        failedCount += 1;

        try {
          await updateQueueItem(recordId, {
            status: "failed",
            lastError: String(err?.message || err),
            retryCount: (registro?.retryCount || 0) + 1,
          });
        } catch (_e) {}
      }
    }

    if (okIds.length > 0) {
      try {
        await removeFromQueue(okIds);
      } catch (_e) {}
    }

    if (typeof notify === "function" && okIds.length > 0) {
      try {
        notify(okIds.length);
      } catch (_e) {}
    }

    return {
      synced: syncedCount,
      failed: failedCount,
      attempted: pending.length,
      okIds,
    };
  } catch (e) {
    return {
      synced: 0,
      reason: "error",
      error: String(e?.message || e),
    };
  } finally {
    syncing = false;
  }
}