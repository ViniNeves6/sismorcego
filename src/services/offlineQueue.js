// src/services/offlineQueue.js
import db, { getLocalCryptoKey, encryptText, decryptText } from "../database/db";

/**
 * Correção 3/12 (P0) — Estratégia de dados locais (SQLite/arquivos)
 * ✅ Substitui AsyncStorage por SQLite para fila offline
 * ✅ Reduz PII local criptografando TODO o payload do registro em repouso (AES + Keychain)
 * ✅ Mantém metadados (status/retry/erro/datas) em colunas para busca/índice sem ler payload
 *
 * Tabela: offline_queue
 * - recordId (PK)
 * - uid
 * - status: pending | syncing | failed | synced
 * - retryCount
 * - lastError
 * - createdAt (ISO string)
 * - updatedAtLocal (ISO string)
 * - payload (TEXT) criptografado (enc:v1:...)
 */

const TABLE = "offline_queue_v2";
const nowISO = () => new Date().toISOString();
let schemaPromise;
const columns = `recordId TEXT NOT NULL, uid TEXT NOT NULL DEFAULT '', status TEXT NOT NULL DEFAULT 'pending',
  retryCount INTEGER NOT NULL DEFAULT 0, lastError TEXT, createdAt TEXT, updatedAtLocal TEXT, payload TEXT NOT NULL`;
const ensureQueueSchema = () => {
  if (!schemaPromise) schemaPromise = new Promise((resolve, reject) => {
    db.transaction(tx => {
      tx.executeSql(`CREATE TABLE IF NOT EXISTS offline_queue (${columns}, PRIMARY KEY(recordId))`);
      tx.executeSql(`CREATE TABLE IF NOT EXISTS ${TABLE} (${columns}, PRIMARY KEY(uid, recordId))`);
      tx.executeSql(`INSERT OR IGNORE INTO ${TABLE} SELECT recordId, COALESCE(uid, ''), status, retryCount, lastError, createdAt, updatedAtLocal, payload FROM offline_queue`);
      tx.executeSql('DROP TABLE offline_queue');
      tx.executeSql(`CREATE INDEX IF NOT EXISTS idx_queue_owner_status ON ${TABLE}(uid, status)`);
    }, reject, () => resolve(true));
  }).catch(error => { schemaPromise = null; throw error; });
  return schemaPromise;
};

const encryptPayload = async (obj) => {
  const key = await getLocalCryptoKey();
  const json = JSON.stringify(obj ?? {});
  return encryptText(json, key);
};

const decryptPayload = async (cipherText) => {
  const key = await getLocalCryptoKey();
  const json = decryptText(cipherText, key);
  if (!json) throw new Error('Não foi possível ler um registro protegido. A cópia original foi preservada.');
  try {
    return JSON.parse(json);
  } catch {
    throw new Error('Um registro salvo está inválido. A cópia original foi preservada.');
  }
};

// Normaliza metadados mínimos (sempre presentes)
const normalizeMeta = (item) => {
  const value = item?.createdAt;
  const createdAt = value?.toDate?.()?.toISOString() || (value?.seconds ? new Date(value.seconds * 1000).toISOString() : value) || nowISO();
  const updatedAtLocal = item?.updatedAtLocal || nowISO();
  const status = item?.status || "pending";
  const retryCount = Number.isFinite(Number(item?.retryCount)) ? Number(item.retryCount) : 0;
  const lastError = item?.lastError ?? null;

  return { createdAt, updatedAtLocal, status, retryCount, lastError };
};

// Carrega fila completa (ordenada por updatedAtLocal desc)
export async function loadQueue({ uid } = {}) {
  await ensureQueueSchema();

  return new Promise((resolve, reject) => {
    db.transaction((tx) => {
      tx.executeSql(
        `SELECT recordId, uid, status, retryCount, lastError, createdAt, updatedAtLocal, payload
         FROM ${TABLE}
         ${uid ? 'WHERE uid = ?' : ''}
         ORDER BY datetime(updatedAtLocal) DESC, recordId DESC`,
        uid ? [uid] : [],
        async (_, result) => {
          try {
          const rows = result.rows;
          const items = [];

          for (let i = 0; i < rows.length; i++) {
            const row = rows.item(i);
            const payloadObj = await decryptPayload(row.payload);

            // payload pode falhar (corrupção/chave) — ainda assim devolvemos meta
            const merged = {
              ...(payloadObj || {}),
              recordId: row.recordId,
              uid: row.uid ?? (payloadObj?.uid ?? null),
              status: row.status,
              retryCount: Number(row.retryCount) || 0,
              lastError: row.lastError ?? null,
              createdAt: row.createdAt ?? (payloadObj?.createdAt ?? null),
              updatedAtLocal: row.updatedAtLocal ?? (payloadObj?.updatedAtLocal ?? null),
            };

            items.push(merged);
          }

          resolve(items);
          } catch (error) { reject(error); }
        },
        (_, error) => reject(error)
      );
    });
  });
}

// Salva/atualiza um item na fila (upsert)
async function upsertQueueItem(item) {
  await ensureQueueSchema();

  if (!item?.uid) throw new Error("offlineQueue: uid required");
  if (!item?.recordId) throw new Error("offlineQueue: recordId é obrigatório");

  const meta = normalizeMeta(item);

  // payload criptografado: inclui o item inteiro (incluindo PII), mas tudo em repouso fica protegido
  const payloadEnc = await encryptPayload({
    ...item,
    ...meta,
  });

  return new Promise((resolve, reject) => {
    db.transaction((tx) => {
      tx.executeSql(
        `
        INSERT OR REPLACE INTO ${TABLE}
        (recordId, uid, status, retryCount, lastError, createdAt, updatedAtLocal, payload)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `,
        [
          String(item.recordId),
          item.uid ?? null,
          meta.status,
          meta.retryCount,
          meta.lastError,
          meta.createdAt,
          meta.updatedAtLocal,
          payloadEnc,
        ],
        () => {},
        (_, error) => reject(error)
      );
    }, reject, () => resolve(true));
  });
}

export async function addToQueue(item, { returnQueue = true } = {}) {
  await upsertQueueItem(item);
  return returnQueue ? loadQueue({ uid: item.uid }) : item;
}

// Uma consulta da nuvem não pode substituir uma edição criada enquanto ela
// estava em andamento. A inserção do cache só ocorre se o ID ainda não existir.
export async function cacheCloudRecord(item) {
  await ensureQueueSchema();
  const meta = normalizeMeta({ ...item, status: 'synced' });
  const payload = await encryptPayload({ ...item, ...meta });
  return new Promise((resolve, reject) => {
    db.transaction(tx => tx.executeSql(
      `INSERT OR IGNORE INTO ${TABLE} (recordId, uid, status, retryCount, lastError, createdAt, updatedAtLocal, payload) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [String(item.recordId), item.uid, meta.status, meta.retryCount, meta.lastError, meta.createdAt, meta.updatedAtLocal, payload],
      () => {}, (_, error) => reject(error),
    ), reject, () => resolve(true));
  });
}

export async function updateQueueItem(recordId, patch = {}, { uid } = {}) {
  if (!uid) throw new Error("offlineQueue: uid required");
  await ensureQueueSchema();
  if (!recordId) throw new Error("offlineQueue: recordId é obrigatório");

  // Busca o item atual
  const current = await new Promise((resolve, reject) => {
    db.transaction((tx) => {
      tx.executeSql(
        `SELECT recordId, uid, status, retryCount, lastError, createdAt, updatedAtLocal, payload
         FROM ${TABLE} WHERE recordId = ? AND uid = ? LIMIT 1`,
        [String(recordId), uid],
        async (_, result) => {
          try {
          if (result.rows.length === 0) return resolve(null);
          const row = result.rows.item(0);
          const payloadObj = await decryptPayload(row.payload);

          const merged = {
            ...(payloadObj || {}),
            recordId: row.recordId,
            uid: row.uid ?? (payloadObj?.uid ?? null),
            status: row.status,
            retryCount: Number(row.retryCount) || 0,
            lastError: row.lastError ?? null,
            createdAt: row.createdAt ?? (payloadObj?.createdAt ?? null),
            updatedAtLocal: row.updatedAtLocal ?? (payloadObj?.updatedAtLocal ?? null),
          };

          resolve(merged);
          } catch (error) { reject(error); }
        },
        (_, error) => reject(error)
      );
    });
  });

  // Se não existe, cria um novo com patch (mas exige recordId)
  if (!current) return false;
  const base = current;

  // Atualiza updatedAtLocal sempre que patchar
  const next = {
    ...base,
    ...patch,
    recordId: String(recordId),
    updatedAtLocal: nowISO(),
  };

  await upsertQueueItem(next);
  return loadQueue({ uid });
}

// Só aplica a resposta da rede à revisão que foi enviada. O payload na
// condição também protege uma edição ocorrida entre a leitura e o UPDATE.
export async function updateQueueItemIfRevision(recordId, revision, patch, { uid, preserveLocalTime = false, cloudRefresh = false } = {}) {
  if (!uid) throw new Error("offlineQueue: uid required");
  await ensureQueueSchema();
  const row = await new Promise((resolve, reject) => {
    db.transaction(tx => tx.executeSql(
      `SELECT * FROM ${TABLE} WHERE recordId = ? AND uid = ? LIMIT 1`, [String(recordId), uid],
      (_, result) => resolve(result.rows.length ? result.rows.item(0) : null),
      (_, error) => reject(error),
    ));
  });
  if (!row) return false;
  const current = await decryptPayload(row.payload);
  if (!current || (current.localRevision || row.updatedAtLocal) !== revision) return false;
  // Uma consulta iniciada antes da confirmação de um envio pode terminar
  // depois dele. Não rebaixar a versão nem substituir uma alteração pendente.
  const remoteRevision = Number(patch.serverRevision || 0);
  if (cloudRefresh && (row.status !== 'synced' || current.syncAction === 'delete'
    || remoteRevision < Math.max(Number(current.serverRevision || 0), Number(current.baseServerRevision || 0)))) return false;
  const next = { ...current, ...patch, ...(cloudRefresh ? {
    baseServerRevision: remoteRevision, hasServerCopy: true, syncConflict: null,
  } : {}), localRevision: revision,
    updatedAtLocal: preserveLocalTime ? current.updatedAtLocal || row.updatedAtLocal : nowISO() };
  const encrypted = await encryptPayload(next);
  return new Promise((resolve, reject) => {
    let changed = false;
    db.transaction(tx => tx.executeSql(
      `UPDATE ${TABLE} SET status = ?, retryCount = ?, lastError = ?, updatedAtLocal = ?, payload = ? WHERE recordId = ? AND uid = ? AND payload = ?`,
      [next.status, next.retryCount || 0, next.lastError ?? null, next.updatedAtLocal, encrypted, String(recordId), uid, row.payload],
      (_, result) => { changed = result.rowsAffected > 0; }, (_, error) => reject(error),
    ), reject, () => resolve(changed));
  });
}

export async function removeFromQueue(recordIds, { uid } = {}) {
  if (!uid) throw new Error("offlineQueue: uid required");
  await ensureQueueSchema();
  const ids = Array.isArray(recordIds) ? recordIds.map(String).filter(Boolean) : [];

  if (ids.length === 0) return loadQueue({ uid });

  const placeholders = ids.map(() => "?").join(",");

  await new Promise((resolve, reject) => {
    db.transaction((tx) => {
      tx.executeSql(
        `DELETE FROM ${TABLE} WHERE recordId IN (${placeholders}) AND uid = ?`,
        [...ids, uid],
        () => {},
        (_, error) => reject(error)
      );
    }, reject, () => resolve(true));
  });

  return loadQueue({ uid });
}
