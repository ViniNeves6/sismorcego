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

const TABLE = "offline_queue";

const nowISO = () => new Date().toISOString();

const ensureQueueSchema = () =>
  new Promise((resolve, reject) => {
    db.transaction(
      (tx) => {
        tx.executeSql(
          `
          CREATE TABLE IF NOT EXISTS ${TABLE} (
            recordId TEXT PRIMARY KEY,
            uid TEXT,
            status TEXT NOT NULL DEFAULT 'pending',
            retryCount INTEGER NOT NULL DEFAULT 0,
            lastError TEXT,
            createdAt TEXT,
            updatedAtLocal TEXT,
            payload TEXT NOT NULL
          );
          `,
          [],
          () => {
            tx.executeSql(
              `CREATE INDEX IF NOT EXISTS idx_${TABLE}_status ON ${TABLE}(status);`,
              [],
              () => {},
              () => {}
            );
            tx.executeSql(
              `CREATE INDEX IF NOT EXISTS idx_${TABLE}_uid ON ${TABLE}(uid);`,
              [],
              () => {},
              () => {}
            );
            tx.executeSql(
              `CREATE INDEX IF NOT EXISTS idx_${TABLE}_updatedAtLocal ON ${TABLE}(updatedAtLocal);`,
              [],
              () => {},
              () => {}
            );
            resolve(true);
          },
          (_, e) => reject(e)
        );
      },
      (e) => reject(e)
    );
  });

const encryptPayload = async (obj) => {
  const key = await getLocalCryptoKey();
  const json = JSON.stringify(obj ?? {});
  return encryptText(json, key);
};

const decryptPayload = async (cipherText) => {
  const key = await getLocalCryptoKey();
  const json = decryptText(cipherText, key);
  if (!json) return null;
  try {
    return JSON.parse(json);
  } catch {
    return null;
  }
};

// Normaliza metadados mínimos (sempre presentes)
const normalizeMeta = (item) => {
  const createdAt = item?.createdAt || nowISO();
  const updatedAtLocal = item?.updatedAtLocal || nowISO();
  const status = item?.status || "pending";
  const retryCount = Number.isFinite(Number(item?.retryCount)) ? Number(item.retryCount) : 0;
  const lastError = item?.lastError ?? null;

  return { createdAt, updatedAtLocal, status, retryCount, lastError };
};

// Carrega fila completa (ordenada por updatedAtLocal desc)
export async function loadQueue() {
  await ensureQueueSchema();

  return new Promise((resolve, reject) => {
    db.transaction((tx) => {
      tx.executeSql(
        `SELECT recordId, uid, status, retryCount, lastError, createdAt, updatedAtLocal, payload
         FROM ${TABLE}
         ORDER BY datetime(updatedAtLocal) DESC, recordId DESC`,
        [],
        async (_, result) => {
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
        },
        (_, error) => reject(error)
      );
    });
  });
}

// Salva/atualiza um item na fila (upsert)
async function upsertQueueItem(item) {
  await ensureQueueSchema();

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
        () => resolve(true),
        (_, error) => reject(error)
      );
    });
  });
}

export async function addToQueue(item) {
  await upsertQueueItem(item);
  return loadQueue();
}

export async function updateQueueItem(recordId, patch = {}) {
  await ensureQueueSchema();
  if (!recordId) throw new Error("offlineQueue: recordId é obrigatório");

  // Busca o item atual
  const current = await new Promise((resolve, reject) => {
    db.transaction((tx) => {
      tx.executeSql(
        `SELECT recordId, uid, status, retryCount, lastError, createdAt, updatedAtLocal, payload
         FROM ${TABLE} WHERE recordId = ? LIMIT 1`,
        [String(recordId)],
        async (_, result) => {
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
        },
        (_, error) => reject(error)
      );
    });
  });

  // Se não existe, cria um novo com patch (mas exige recordId)
  const base = current || { recordId: String(recordId) };

  // Atualiza updatedAtLocal sempre que patchar
  const next = {
    ...base,
    ...patch,
    recordId: String(recordId),
    updatedAtLocal: nowISO(),
  };

  await upsertQueueItem(next);
  return loadQueue();
}

export async function removeFromQueue(recordIds) {
  await ensureQueueSchema();
  const ids = Array.isArray(recordIds) ? recordIds.map(String).filter(Boolean) : [];

  if (ids.length === 0) return loadQueue();

  const placeholders = ids.map(() => "?").join(",");

  await new Promise((resolve, reject) => {
    db.transaction((tx) => {
      tx.executeSql(
        `DELETE FROM ${TABLE} WHERE recordId IN (${placeholders})`,
        ids,
        () => resolve(true),
        (_, error) => reject(error)
      );
    });
  });

  return loadQueue();
}