import { addDoc, collection, deleteDoc, doc, onSnapshot, query, where, serverTimestamp } from 'firebase/firestore';
import { auth, db } from './firebase';
import NetInfo from '@react-native-community/netinfo';

async function requireConnection() {
  const net = await NetInfo.fetch();
  if (!net.isConnected || net.isInternetReachable === false) throw new Error('Sem conexão. Conecte-se à internet para enviar ou excluir uma dúvida.');
}

const waitingMessages = ['Sem resposta ainda.', 'Dúvida registrada, resposta em breve.'];
export function normalizeDoubt(item) {
  const data = item.data();
  const response = data.resposta || data.respostaTexto || data.answer || '';
  const date = data.createdAt?.toDate?.() || (data.createdAt?.seconds ? new Date(data.createdAt.seconds * 1000) : null);
  return {
    id: item.id, userId: data.userId, question: data.titulo || data.pergunta || data.duvida || '',
    answer: waitingMessages.includes(response) ? '' : response,
    createdAt: date ? date.toLocaleString('pt-BR') : 'Enviada agora', sortTime: date?.getTime() || Date.now(),
  };
}
export function subscribeDoubts(onChange, onError, role = 'acs') {
  if (!db || !auth?.currentUser) {
    onError(new Error('Faça login para consultar as dúvidas.'));
    return () => {};
  }
  const ref = collection(db,'duvidas');
  const targets = role === 'coordenador' ? [ref] : [query(ref,where('userId','==',auth.currentUser.uid)), query(ref,where('publicada','==',true))];
  const groups = new Map();
  let active = true;
  const stops = targets.map((target,index) => onSnapshot(target,snap => {
    if (!active) return;
    groups.set(index,snap.docs.map(normalizeDoubt));
    const result = new Map([...groups.values()].flat().map(item => [item.id,item]));
    onChange([...result.values()].sort((a,b) => b.sortTime-a.sortTime));
  },error => { if (active) onError(error); }));
  return () => { active=false; stops.forEach(stop => stop()); };
}
export async function createDoubt(question) {
  const uid = auth?.currentUser?.uid;
  const text = question.trim();
  if (!db || !uid) throw new Error('Faça login para enviar sua dúvida.');
  if (text.length < 10 || text.length > 500) throw new Error('Escreva uma dúvida entre 10 e 500 caracteres.');
  await requireConnection();
  await addDoc(collection(db, 'duvidas'), { titulo: text, resposta: null, userId: uid, createdAt: serverTimestamp() });
}
export async function deleteDoubt(item) {
  if (!auth?.currentUser || item.userId !== auth.currentUser.uid) throw new Error('Você só pode excluir suas próprias dúvidas.');
  await requireConnection();
  await deleteDoc(doc(db, 'duvidas', item.id));
}
