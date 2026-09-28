// src/services/historico.js
// Carrega o histórico de registros: fila local (SQLite) + nuvem (Firestore).
// Regra de mescla: a versão da nuvem vence a local (por recordId).
import NetInfo from "@react-native-community/netinfo";
import { collection, getDocs, query, orderBy, limit } from "firebase/firestore";
import { loadQueue } from "./offlineQueue";
import { db, auth } from "./firebase";
import logger from "../utils/logger";

export const getSortTime = (r) => {
  const a = r?.createdAt;
  if (a?.toDate) return a.toDate().getTime();
  if (typeof a === "string") return new Date(a).getTime() || 0;
  const dr = r?.dataRegistro;
  if (typeof dr === "string") return new Date(dr).getTime() || 0;
  return 0;
};

export const mergeByRecordId = (cloudArr, localArr) => {
  const map = new Map();

  (Array.isArray(localArr) ? localArr : []).forEach((r, idx) => {
    const key = r?.recordId || r?.id || String(idx);
    map.set(key, { id: key, ...r, _origin: "local" });
  });

  (Array.isArray(cloudArr) ? cloudArr : []).forEach((r, idx) => {
    const key = r?.recordId || r?.id || String(idx);
    map.set(key, { id: key, ...r, _origin: "cloud" });
  });

  return Array.from(map.values()).sort((a, b) => getSortTime(b) - getSortTime(a));
};

export async function carregarLocais() {
  try {
    const arr = await loadQueue();
    if (!Array.isArray(arr)) return [];
    return arr.map((r, idx) => ({ id: r?.recordId || String(idx), ...r, _origin: "local" }));
  } catch (e) {
    logger.error("Erro ao carregar dados locais:", e);
    return [];
  }
}

export async function carregarNuvem() {
  try {
    const user = auth?.currentUser;
    if (!user) return [];

    if (!db) {
      logger.log("db não disponível, pulando carregamento da nuvem");
      return [];
    }

    const net = await NetInfo.fetch();
    const isOnline = !!(net.isConnected && net.isInternetReachable !== false);
    if (!isOnline) return [];

    const col = collection(db, "registros", user.uid, "itens");
    const q = query(col, orderBy("updatedAt", "desc"), limit(300));
    const snap = await getDocs(q);

    const cloud = [];
    snap.forEach((docSnap) => {
      cloud.push({ id: docSnap.id, ...docSnap.data(), _origin: "cloud" });
    });
    return cloud;
  } catch (e) {
    logger.error("Erro ao carregar nuvem:", e);
    return [];
  }
}

// Local e nuvem são independentes: carrega em paralelo.
export async function carregarHistorico() {
  const [local, cloud] = await Promise.all([carregarLocais(), carregarNuvem()]);
  return mergeByRecordId(cloud, local);
}
