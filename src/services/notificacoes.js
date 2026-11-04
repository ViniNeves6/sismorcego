import { doc, updateDoc } from 'firebase/firestore';
import { db, auth } from './firebase';
import { LOCAL_TEST_MODE } from './debugTestSession';

export async function marcarNotificacaoComoLida(coordenadorUid, notifId) {
  if (LOCAL_TEST_MODE) throw new Error('Modo de testes: leitura remota desabilitada.');
  if (!db || !coordenadorUid || !notifId || auth?.currentUser?.uid !== coordenadorUid) throw new Error('Invalid notification owner');
  await updateDoc(doc(db, "usuarios", coordenadorUid, "notificacoes", notifId), { lida: true });
}
