// Histórico real: Firestore + cache/fila criptografada, separado por conta.
import NetInfo from '@react-native-community/netinfo';
import { collection, collectionGroup, getDocs, query, orderBy, limit } from 'firebase/firestore';
import { cacheCloudRecord, loadQueue, updateQueueItemIfRevision } from './offlineQueue';
import { recordIdentity } from './recordLifecycle';
import { removeOrCancelStoredRecord } from './recordMutations';
import { db, auth } from './firebase';

export const getSortTime = r => {
  const value = r?.createdAt || r?.dataRegistro;
  if (value?.toDate) return value.toDate().getTime();
  if (value?.seconds) return value.seconds * 1000;
  return new Date(value || 0).getTime() || 0;
};

export const mergeByRecordId = (cloudArr, localArr) => {
  const map = new Map();
  (cloudArr || []).forEach(r => map.set(recordIdentity(r), { ...r, _origin: 'cloud', status: 'synced' }));
  (localArr || []).forEach(r => {
    const key = recordIdentity(r);
    const remoteRevision = Number(map.get(key)?.serverRevision || 0);
    const localRevision = Math.max(Number(r.serverRevision || 0), Number(r.baseServerRevision || 0));
    if (!map.has(key) || r.status !== 'synced' || r.syncAction === 'delete' || localRevision > remoteRevision) map.set(key, { ...r, _origin: 'local' });
    else if (r.photoPolicyVersion === 1) {
      const localPhoto = Object.fromEntries(['photoBase64','photoMime','photoSize','photoUriLocal','photoLocalUri','hasLocalPhoto','photoPolicyVersion','photoHidden'].map(field=>[field,r[field] ?? null]));
      map.set(key,{...map.get(key),...localPhoto});
    }
  });
  return [...map.values()].sort((a, b) => getSortTime(b) - getSortTime(a));
};

export async function carregarLocais(role) {
  const uid = auth?.currentUser?.uid;
  if (!uid) return [];
  return (await loadQueue(role === 'coordenador' ? {} : { uid })).filter(r => role === 'coordenador' || r.uid === uid);
}

async function cloudRecords(all) {
  const uid = auth?.currentUser?.uid;
  if (!uid || !db) return [];
  const net = await NetInfo.fetch();
  if (!net.isConnected || net.isInternetReachable === false) return [];
  const ref = all ? collectionGroup(db, 'itens') : collection(db, 'registros', uid, 'itens');
  const snap = await getDocs(query(ref, orderBy('updatedAt', 'desc'), limit(all ? 500 : 300)));
  const records = [];
  snap.forEach(item => records.push({
    ...item.data(), id: item.id, recordId: item.id,
    uid: item.ref?.parent?.parent?.id || item.data().uid || uid,
    status: 'synced', _origin: 'cloud',
  }));
  return records;
}

export const carregarNuvem = () => cloudRecords(false);
export const carregarNuvemTodos = () => cloudRecords(true);

export async function carregarHistorico(role, { onCloudError } = {}) {
  const local = await carregarLocais(role);
  let cloud = [];
  try {
    cloud = await cloudRecords(role === 'coordenador');
    for (const record of cloud) {
      const cached = local.find(r => recordIdentity(r) === recordIdentity(record));
      if (!cached) await cacheCloudRecord(record);
      else if (cached.status === 'synced' && cached.syncAction !== 'delete') {
        const patch={...record};
        if (cached.photoPolicyVersion === 1) ['photoBase64','photoMime','photoSize','photoUriLocal','photoLocalUri','hasLocalPhoto','photoPolicyVersion','photoHidden'].forEach(field=>{delete patch[field];});
        await updateQueueItemIfRevision(cached.recordId, cached.localRevision || cached.updatedAtLocal, patch, { uid: record.uid, cloudRefresh: true });
      }
    }
  } catch (error) {
    if (!onCloudError) throw error;
    onCloudError(error);
  }
  // Releitura inclui edições salvas enquanto a nuvem estava sendo consultada.
  return mergeByRecordId(cloud, await carregarLocais(role));
}

export const excluirRegistro = removeOrCancelStoredRecord;
