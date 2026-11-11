import { DeviceEventEmitter } from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import { loadQueue, updateQueueItemIfRevision } from './offlineQueue';
import { db, auth } from './firebase';
import { writeRecordTransaction } from './recordSyncProtocol';
import { LOCAL_TEST_MODE } from './debugTestSession';
import { recordIdentity } from './recordLifecycle';
import { withRecordLock } from './recordDraftIdentity';
import { syncRecordPhoto } from './recordPhotoCloud';

let syncing = false;
let syncRequested = false;

export { buildCloudPayload } from './recordSyncProtocol';
export const writeSyncedRecord = (registro, uid) => writeRecordTransaction(db, registro, uid);

export async function syncPendingRegistros({ notify } = {}) {
  if (LOCAL_TEST_MODE) return { synced: 0, reason: 'test-mode' };
  if (syncing) { syncRequested = true; return { synced: 0, skipped: true, reason: 'already-syncing' }; }
  syncing = true;
  try {
    const uid = auth?.currentUser?.uid;
    if (!uid) return { synced: 0, reason: 'no-user' };
    if (!db) return { synced: 0, reason: 'no-db' };
    const net = await NetInfo.fetch();
    if (!net.isConnected || net.isInternetReachable === false) return { synced: 0, reason: 'offline' };
    const pending = (await loadQueue({ uid })).filter(r => r.recordId && r.uid === uid && r.status !== 'synced');
    if (!pending.length) return { synced: 0, reason: 'empty' };
    const okIds = [];
    let failed = 0;
    for (const registro of pending) {
      if (auth.currentUser?.uid !== uid) break;
      const revision = registro.localRevision || registro.updatedAtLocal;
      try {
        if (registro.syncAction === 'delete') throw new Error('Exclusão antiga bloqueada. Abra o registro e informe o motivo para convertê-la em cancelamento.');
        const claimed = await withRecordLock(recordIdentity(registro), () => updateQueueItemIfRevision(registro.recordId, revision,
          { status: 'syncing', serverWriteAttempted: true, lastError: null }, { uid }));
        if (!claimed) continue;
        const receipt = await writeSyncedRecord(registro, uid);
        // A foto vai num documento à parte, depois da ficha. Se falhar, o registro
        // fica para nova tentativa (a ficha já gravada não é escrita de novo).
        const photoCloudFingerprint = await syncRecordPhoto(registro, uid, db);
        // Cópia criptografada dos enviados para consulta offline.
        const updated = await updateQueueItemIfRevision(registro.recordId, revision, { ...receipt, photoCloudFingerprint, baseServerRevision: receipt.serverRevision, status: 'synced', hasServerCopy: true, syncConflict: null, auditEvents: [], lastError: null, retryCount: 0 }, { uid });
        if (!updated) {
          // Uma edição durante o envio ainda parte da revisão que acabamos de
          // confirmar. Avança apenas a base, sem apagar campos/eventos novos.
          await withRecordLock(recordIdentity(registro), async () => {
            const latest = (await loadQueue({ uid })).find(item => String(item.recordId) === String(registro.recordId));
            if (latest && Number(latest.baseServerRevision || 0) === Number(registro.baseServerRevision || 0)) {
              await updateQueueItemIfRevision(latest.recordId, latest.localRevision, { baseServerRevision: receipt.serverRevision, serverRevision: receipt.serverRevision, hasServerCopy: true }, { uid });
            }
          });
        }
        okIds.push(String(registro.recordId));
      } catch (err) {
        failed += 1;
        await updateQueueItemIfRevision(registro.recordId, revision, {
          status: 'failed', lastError: String(err?.message || err), retryCount: (registro.retryCount || 0) + 1,
          ...(err?.code === 'sync/conflict' ? { syncConflict: { serverRecord: err.serverRecord, observedAt: new Date().toISOString() } } : {}),
        }, { uid });
      }
    }
    if (okIds.length) notify?.(okIds.length);
    DeviceEventEmitter.emit('registros:changed');
    return { synced: okIds.length, failed, attempted: pending.length, okIds };
  } catch (error) {
    return { synced: 0, reason: 'error', error: String(error?.message || error) };
  } finally {
    syncing = false;
    if (syncRequested) { syncRequested = false; syncPendingRegistros(); }
  }
}
