// src/hooks/useDuvidas.js
// Dúvidas e respostas (Firestore, coleção "duvidas").
import { useCallback, useEffect, useState } from 'react';
import {
  collection,
  addDoc,
  getDocs,
  getDocsFromServer,
  query,
  orderBy,
  serverTimestamp,
} from 'firebase/firestore';
import { db, auth } from '../services/firebase';
import logger from '../utils/logger';

const normalize = (doc) => {
  const item = { id: doc.id, ...doc.data() };
  return {
    ...item,
    titulo: item.titulo || item.pergunta || item.duvida || 'Sem título',
    resposta: item.resposta || item.respostaTexto || item.answer || 'Sem resposta ainda.',
    key: `duvidas:${item.id}`,
  };
};

const byNewest = (a, b) => (b?.createdAt?.seconds || 0) - (a?.createdAt?.seconds || 0);

// Erros expostos como `error`: { kind: 'unavailable' | 'permission' | 'generic' }
export default function useDuvidas() {
  const [duvidas, setDuvidas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const reload = useCallback(async () => {
    setError(null);

    if (!db) {
      setDuvidas([]);
      setError({ kind: 'unavailable' });
      setLoading(false);
      return;
    }

    try {
      let snap;
      try {
        const q = query(collection(db, 'duvidas'), orderBy('createdAt', 'desc'));
        snap = await getDocsFromServer(q);
      } catch {
        // fallback para documentos sem createdAt/índice
        snap = await getDocsFromServer(collection(db, 'duvidas'));
      }
      setDuvidas(snap.docs.map(normalize).sort(byNewest));
    } catch (err) {
      logger.error('Duvidas: erro', err);
      if (err?.code === 'permission-denied') {
        // Última tentativa: dados em cache.
        try {
          const cached = await getDocs(collection(db, 'duvidas'));
          const lista = cached.docs.map(normalize);
          setDuvidas(lista);
          if (lista.length > 0) return;
        } catch (cacheErr) {
          logger.error('Duvidas: cache fallback erro', cacheErr);
        }
        setError({ kind: 'permission' });
      } else {
        setError({ kind: 'generic' });
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  // Lança erro com `kind` para a tela decidir a mensagem.
  const add = useCallback(
    async (titulo) => {
      if (!db) throw Object.assign(new Error('unavailable'), { kind: 'unavailable' });

      try {
        await addDoc(collection(db, 'duvidas'), {
          titulo,
          resposta: 'Dúvida registrada, resposta em breve.',
          userId: auth?.currentUser?.uid || 'anon',
          createdAt: serverTimestamp(),
        });
      } catch (err) {
        logger.error('Duvidas: erro', err);
        throw Object.assign(err, { kind: err?.code === 'permission-denied' ? 'permission' : 'generic' });
      }
      await reload();
    },
    [reload]
  );

  return { duvidas, loading, error, reload, add };
}
