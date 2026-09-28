// src/services/notificacoes.js
// Lógica de dados do feed de notificações do coordenador (sem UI, sem
// dependência de React — usada tanto no app aberto quanto na tarefa
// headless de segundo plano).
import AsyncStorage from "@react-native-async-storage/async-storage";
import { collection, collectionGroup, doc, getDocs, orderBy, query, setDoc, updateDoc, where } from "firebase/firestore";
import { db } from "./firebase";

const LAST_CHECK_KEY = "@sismorcego/ultimaChecagemNotificacoes";

const getUltimaChecagem = async () => {
  try {
    return await AsyncStorage.getItem(LAST_CHECK_KEY);
  } catch {
    return null;
  }
};

const setUltimaChecagem = async (iso) => {
  try {
    if (iso) await AsyncStorage.setItem(LAST_CHECK_KEY, iso);
  } catch {
    // falha de storage: a próxima checagem tenta de novo a partir do mesmo ponto
  }
};

// Registros (de qualquer ACS) criados desde a última checagem local.
// Na primeira execução (sem marco salvo), só define o marco a partir de
// agora — não notifica o histórico inteiro de uma vez.
export async function buscarRegistrosNovos() {
  if (!db) return [];
  const ultima = await getUltimaChecagem();

  if (!ultima) {
    const snapInicial = await getDocs(query(collectionGroup(db, "itens"), orderBy("createdAt", "desc")));
    const maisRecente = snapInicial.docs[0]?.data()?.createdAt || new Date().toISOString();
    await setUltimaChecagem(maisRecente);
    return [];
  }

  const snap = await getDocs(
    query(collectionGroup(db, "itens"), where("createdAt", ">", ultima), orderBy("createdAt", "asc"))
  );
  const registros = [];
  snap.forEach((docSnap) => registros.push({ id: docSnap.id, ...docSnap.data() }));
  return registros;
}

// Grava o feed no Firestore do coordenador e avança o marco local.
export async function registrarNotificacoes(coordenadorUid, registrosNovos) {
  if (!db || !coordenadorUid || !registrosNovos?.length) return;

  for (const registro of registrosNovos) {
    const notifRef = doc(collection(db, "usuarios", coordenadorUid, "notificacoes"));
    await setDoc(notifRef, {
      registroId: registro.recordId || registro.id,
      uidAcs: registro.uid || null,
      nomeAcs: registro.nomeAcs || null,
      municipio: registro.municipio || null,
      createdAt: registro.createdAt || new Date().toISOString(),
      lida: false,
    });
  }

  const maisRecente = registrosNovos[registrosNovos.length - 1]?.createdAt;
  await setUltimaChecagem(maisRecente);
}

export async function marcarNotificacaoComoLida(coordenadorUid, notifId) {
  if (!db || !coordenadorUid || !notifId) return;
  await updateDoc(doc(db, "usuarios", coordenadorUid, "notificacoes", notifId), { lida: true });
}
