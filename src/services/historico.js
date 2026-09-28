// src/services/historico.js
// Carrega o histórico de registros: fila local (SQLite) + nuvem (Firestore).
// Regra de mescla: a versão da nuvem vence a local (por recordId).
import NetInfo from "@react-native-community/netinfo";
import { collection, collectionGroup, deleteDoc, doc, getDocs, query, orderBy, limit } from "firebase/firestore";
import { loadQueue, removeFromQueue } from "./offlineQueue";
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

// Coordenador: todos os registros de todos os ACS (collectionGroup atravessa
// a subcoleção "itens" de qualquer uid). Exige regra do Firestore liberando
// a leitura para quem tiver usuarios/{uid}.role == "coordenador".
export async function carregarNuvemTodos() {
  try {
    const user = auth?.currentUser;
    if (!user || !db) return [];

    const net = await NetInfo.fetch();
    const isOnline = !!(net.isConnected && net.isInternetReachable !== false);
    if (!isOnline) return [];

    const col = collectionGroup(db, "itens");
    const q = query(col, orderBy("updatedAt", "desc"), limit(500));
    const snap = await getDocs(q);

    const cloud = [];
    snap.forEach((docSnap) => {
      cloud.push({ id: docSnap.id, ...docSnap.data(), _origin: "cloud" });
    });
    return cloud;
  } catch (e) {
    logger.error("Erro ao carregar nuvem (todos):", e);
    return [];
  }
}

// Apaga um registro (nuvem + fila local, o que existir). Só funciona se as
// regras do Firestore permitirem — dono sempre pode; coordenador também,
// por decisão explícita (ver firestore.rules, "allow delete").
export async function excluirRegistro(registro) {
  const recordId = registro?.recordId;
  if (!recordId) throw new Error("Registro sem recordId.");

  if (registro?.uid && db) {
    await deleteDoc(doc(db, "registros", registro.uid, "itens", String(recordId)));
  }

  try {
    await removeFromQueue([recordId]);
  } catch (e) {
    logger.warn("excluirRegistro: falha ao remover da fila local", e);
  }
}

// Local e nuvem são independentes: carrega em paralelo.
// Coordenador vê os registros de todos (sem fila local, que é só do aparelho dele).
export async function carregarHistorico(role) {
  if (role === "coordenador") {
    const cloud = await carregarNuvemTodos();
    return mergeByRecordId(cloud, []);
  }
  const [local, cloud] = await Promise.all([carregarLocais(), carregarNuvem()]);
  return mergeByRecordId(cloud, local);
}
