// src/hooks/useDuvidas.js
// Dúvidas e respostas (Firestore, coleção "duvidas").
import { useCallback, useEffect, useState } from 'react';
import {
  collection,
  addDoc,
  getDocs,
  getDocsFromServer,
  query,
  where,
  serverTimestamp,
} from 'firebase/firestore';
import { db, auth } from '../services/firebase';
import logger from '../utils/logger';
import useAuth from './useAuth';

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
  const { role } = useAuth();
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
      if (!auth?.currentUser) throw Object.assign(new Error('Faça login para consultar as dúvidas.'),{ code:'permission-denied' });
      const ref = collection(db,'duvidas');
      const targets = role === 'coordenador' ? [ref] : [query(ref,where('userId','==',auth.currentUser.uid)),query(ref,where('publicada','==',true))];
      const snapshots = await Promise.all(targets.map(target => getDocsFromServer(target)));
      setDuvidas([...new Map(snapshots.flatMap(s => s.docs.map(normalize)).map(item => [item.id,item])).values()].sort(byNewest));
    } catch (err) {
      logger.error('Duvidas: erro', err);
      if (err?.code === 'permission-denied') {
        // Última tentativa: dados em cache.
        try {
          const cached = await getDocs(query(collection(db, 'duvidas'),where('userId','==',auth.currentUser?.uid || '')));
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
  }, [role]);

  useEffect(() => {
    reload();
  }, [reload]);

  // Lança erro com `kind` para a tela decidir a mensagem.
  const add = useCallback(
    async (titulo) => {
      if (!db || !auth?.currentUser) throw Object.assign(new Error('Faça login para enviar sua dúvida.'), { kind: 'unavailable' });

      try {
        await addDoc(collection(db, 'duvidas'), {
          titulo,
          resposta: null,
          userId: auth.currentUser.uid,
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
