// src/hooks/useDuvidas.js
// FAQ (Firestore, coleção "duvidas", somente leitura — o conteúdo é mantido
// direto no console do Firebase, não pelo app).
import { useCallback, useEffect, useState } from 'react';
import { collection, getDocs, getDocsFromServer, query, orderBy } from 'firebase/firestore';
import { db } from '../services/firebase';
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

  return { duvidas, loading, error, reload };
}
