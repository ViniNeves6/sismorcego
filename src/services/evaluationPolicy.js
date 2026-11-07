// UI state only. Actual authorization is enforced by the published Firestore
// rules with request.time, including a server-only profile read before entry.
export function evaluationPeriod(data, serverTime) {
  const startAt = data?.startAt?.toMillis?.(), expiresAt = data?.expiresAt?.toMillis?.();
  const valid = typeof data?.enabled === 'boolean' && Number.isFinite(startAt) && Number.isFinite(expiresAt) && expiresAt > startAt;
  const state = !valid ? 'unavailable' : !data.enabled ? 'suspended' : serverTime < startAt ? 'not-started' : serverTime >= expiresAt ? 'expired' : 'active';
  return { state, enabled: data?.enabled, startAt, expiresAt };
}
