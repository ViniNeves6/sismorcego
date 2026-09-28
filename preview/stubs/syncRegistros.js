// Só "envia" o que foi criado nesta sessão; os pendentes de exemplo continuam pendentes.
import { loadQueue, updateQueueItem } from './offlineQueue';

export async function syncPendingRegistros({ notify } = {}) {
  const fresh = (await loadQueue()).filter((r) => r._session && r.status !== 'synced');
  if (!fresh.length) return 0;
  await new Promise((r) => setTimeout(r, 1800));
  for (const r of fresh) await updateQueueItem(r.recordId, { status: 'synced' });
  notify?.(fresh.length);
  return fresh.length;
}
