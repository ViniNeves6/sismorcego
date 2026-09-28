import { localRegistros } from './demoData';

let queue = localRegistros.map((r) => ({ ...r }));

export async function loadQueue() {
  return queue.map((r) => ({ ...r }));
}
export async function addToQueue(item) {
  queue = [{ ...item, _session: true }, ...queue];
}
export async function updateQueueItem(recordId, patch = {}) {
  queue = queue.map((r) => (r.recordId === recordId ? { ...r, ...patch } : r));
}
export async function removeFromQueue(ids) {
  const set = new Set([].concat(ids));
  queue = queue.filter((r) => !set.has(r.recordId));
}
