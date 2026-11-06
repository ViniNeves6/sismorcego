/* eslint-env node */
const { Timestamp } = require('firebase-admin/firestore');
const { createHash } = require('crypto');

const EVALUATION_UID = 'sismorcego-teste-coordenadores';
const CONFIG_PATH = 'configuracoes/avaliacaoCoordenadores';
const LEASE_MS = 60000;

function periodState(data, now) {
  if (!data || typeof data.enabled !== 'boolean' || !(data.startAt instanceof Timestamp) ||
    !(data.expiresAt instanceof Timestamp) || data.expiresAt.toMillis() <= data.startAt.toMillis()) return 'unavailable';
  if (!data.enabled) return 'suspended';
  if (now < data.startAt.toMillis()) return 'not-started';
  return now >= data.expiresAt.toMillis() ? 'expired' : 'active';
}

// Bounded, per-instance abuse mitigation. These counters intentionally do not
// require database write privileges. Cold starts reset them; this is not a
// durable/distributed quota and does not identify or approve any human/device.
function createRateLimiter({ now = Date.now, maxKeys = 2048 } = {}) {
  const buckets = new Map();
  function take(key, maximum, windowMs, at) {
    let bucket = buckets.get(key);
    if (bucket && bucket.until <= at) { buckets.delete(key); bucket = null; }
    if (!bucket) {
      if (buckets.size >= maxKeys) {
        for (const [id, value] of buckets) if (value.until <= at) buckets.delete(id);
        if (buckets.size >= maxKeys) return false;
      }
      bucket = { count: 0, until: at + windowMs }; buckets.set(key, bucket);
    }
    if (bucket.count >= maximum) return false;
    bucket.count++; return true;
  }
  return (ip, issue) => {
    const at = now(), kind = issue ? 'session' : 'status';
    const key = createHash('sha256').update(String(ip || 'unknown').slice(0, 128)).digest('hex');
    return take(kind + ':' + key, issue ? 60 : 180, issue ? 600000 : 60000, at) &&
      take('global:' + kind, issue ? 120 : 600, issue ? 600000 : 60000, at);
  };
}

function createAccessService({ auth, db, now = Date.now }) {
  async function status() {
    const snapshot = await db.doc(CONFIG_PATH).get(), config = snapshot.exists ? snapshot.data() : null;
    let state = periodState(config, now());
    if (state === 'active') {
      const [user, profile] = await Promise.all([auth.getUser(EVALUATION_UID), db.doc('usuarios/' + EVALUATION_UID).get()]);
      if (user.disabled || user.displayName !== 'Sismorcego Teste' || user.customClaims?.sismorcegoEvaluationAccount !== true ||
        !profile.exists || profile.data().role !== 'coordenador') state = 'blocked';
      // Network latency must not carry an active response past expiration.
      if (state === 'active') state = periodState(config, now());
    }
    return { version: 1, state, serverTime: now(), leaseMs: LEASE_MS,
      startAt: config?.startAt instanceof Timestamp ? config.startAt.toMillis() : null,
      expiresAt: config?.expiresAt instanceof Timestamp ? config.expiresAt.toMillis() : null };
  }
  async function issue() {
    const before = await status();
    if (before.state !== 'active') return before;
    // Always this server-owned UID. No UID, role, duration or installation
    // allowlist supplied by the caller can change the authorization decision.
    const customToken = await auth.createCustomToken(EVALUATION_UID);
    const after = await status();
    if (after.state !== 'active') return after;
    return { ...after, uid: EVALUATION_UID, customToken };
  }
  return { status, issue };
}

function createHttpHandler(service, limit = createRateLimiter()) {
  return async (req, res) => {
    res.set('Cache-Control', 'no-store, max-age=0');
    res.set('X-Content-Type-Options', 'nosniff');
    if (req.path !== '/' && req.path !== '') return res.status(404).json({ error: 'not-found' });
    const issue = req.method === 'POST';
    if (req.method !== 'GET' && !issue) return res.status(405).set('Allow', 'GET, POST').json({ error: 'method-not-allowed' });
    if (issue && (req.rawBody?.length > 256 || !req.is('application/json') ||
      !req.body || Array.isArray(req.body) || req.body.version !== 1 || Object.keys(req.body).some(k => k !== 'version'))) {
      return res.status(400).json({ error: 'invalid-request' });
    }
    if (!limit(req.ip, issue)) return res.status(429).set('Retry-After', '60').json({ error: 'rate-limited' });
    try {
      const result = await (issue ? service.issue() : service.status());
      return res.status(result.state === 'unavailable' ? 503 : 200).json(result);
    } catch {
      // Never log request bodies, tokens, user objects, raw SDK exceptions or IPs.
      return res.status(503).json({ version: 1, state: 'unavailable' });
    }
  };
}
module.exports = { Timestamp, EVALUATION_UID, CONFIG_PATH, LEASE_MS, periodState, createRateLimiter, createAccessService, createHttpHandler };
