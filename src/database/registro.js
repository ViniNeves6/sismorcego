// src/database/registro.js
import db, { decryptText, encryptText, getLocalCryptoKey } from "./db";

/**
 * Estratégia (Correção 3/12):
 * - Reduzir exposição de PII local criptografando campos sensíveis em repouso.
 * - Campos PII criptografados: nomeACS, nomeAgredido, endereco.
 * - Demais campos permanecem em claro (municipio, datas, seleções, geo).
 *
 * Observação:
 * - Registros antigos (texto puro) continuam sendo lidos (fallback).
 */

const TABLE = "registros";

const fromJSON = (v) => {
  if (v === null || v === undefined || v === "") return [];
  try {
    const parsed = JSON.parse(v);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};
const toNumber = (v) => {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};
const nowISO = () => new Date().toISOString();

const decryptPII = (row, key) => ({
  ...row,
  nomeACS: decryptText(row.nomeACS, key),
  nomeAgredido: decryptText(row.nomeAgredido, key),
  endereco: decryptText(row.endereco, key),
});

const mapRowToDomain = (row, key) => {
  const r = decryptPII(row, key);
  return {
    id: r.id,
    nomeACS: r.nomeACS ?? null,
    nomeAgredido: r.nomeAgredido ?? null,
    municipio: r.municipio ?? null,
    endereco: r.endereco ?? null,
    local: r.local ?? null,
    tratamento: r.tratamento ?? null,
    animais: fromJSON(r.animais),
    fontesLuz: fromJSON(r.fontesLuz),
    circunstancias: fromJSON(r.circunstancias),
    sexo: r.sexo ?? null,
    dataRegistro: r.dataRegistro ?? null,
    dataAgressao: r.dataAgressao ?? null,
    image: r.image ?? null,
    location: {
      latitude: r.latitude ?? null,
      longitude: r.longitude ?? null,
    },
    synced: Number(r.synced) === 1,
    updatedAt: r.updatedAt ?? null,
  };
};

// Criação + migração leve (se faltar coluna)
const addColumnIfMissing = (tx, tableName, columnName, columnDef) =>
  new Promise((resolve, reject) => {
    tx.executeSql(
      `PRAGMA table_info(${tableName});`,
      [],
      (_, result) => {
        const cols = [];
        for (let i = 0; i < result.rows.length; i++) cols.push(result.rows.item(i).name);
        if (cols.includes(columnName)) return resolve(false);

        tx.executeSql(
          `ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${columnDef};`,
          [],
          () => resolve(true),
          (_tx, e) => reject(e)
        );
      },
      (_, e) => reject(e)
    );
  });

export const ensureSchema = () =>
  new Promise((resolve, reject) => {
    db.transaction(
      (tx) => {
        tx.executeSql(
          `
          CREATE TABLE IF NOT EXISTS ${TABLE} (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            nomeACS TEXT,
            nomeAgredido TEXT,
            municipio TEXT,
            endereco TEXT,
            local TEXT,
            tratamento TEXT,
            animais TEXT,
            fontesLuz TEXT,
            circunstancias TEXT,
            sexo TEXT,
            dataRegistro TEXT,
            dataAgressao TEXT,
            image TEXT,
            latitude REAL,
            longitude REAL,
            synced INTEGER NOT NULL DEFAULT 0,
            updatedAt TEXT
          );
          `,
          [],
          async () => {
            // índices e migrações
            tx.executeSql(
              `CREATE INDEX IF NOT EXISTS idx_${TABLE}_synced ON ${TABLE}(synced);`,
              [],
              () => {},
              () => {}
            );
            tx.executeSql(
              `CREATE INDEX IF NOT EXISTS idx_${TABLE}_updatedAt ON ${TABLE}(updatedAt);`,
              [],
              () => {},
              () => {}
            );

            // Migração: garantir updatedAt
            try {
              await addColumnIfMissing(tx, TABLE, "updatedAt", "TEXT");
            } catch {
              // se falhar, não quebra; tabela pode já ter.
            }

            resolve(true);
          },
          (_, e) => reject(e)
        );
      },
      (e) => reject(e)
    );
  });

// Inserir registro local (synced = 0)
export const salvarRegistroLocal = async (registro) => {
  await ensureSchema();
  const key = await getLocalCryptoKey();
  const updatedAt = nowISO();

  const {
    nomeACS,
    nomeAgredido,
    municipio,
    endereco,
    local,
    tratamento,
    animais,
    fontesLuz,
    circunstancias,
    sexo,
    dataRegistro,
    dataAgressao,
    image,
    location,
  } = registro || {};

  const latitude = toNumber(location?.latitude);
  const longitude = toNumber(location?.longitude);

  const nomeACS_enc = nomeACS == null ? null : encryptText(nomeACS, key);
  const nomeAgredido_enc = nomeAgredido == null ? null : encryptText(nomeAgredido, key);
  const endereco_enc = endereco == null ? null : encryptText(endereco, key);

  return new Promise((resolve, reject) => {
    db.transaction((tx) => {
      tx.executeSql(
        `
        INSERT INTO ${TABLE}
        (nomeACS, nomeAgredido, municipio, endereco, local, tratamento, animais, fontesLuz, circunstancias, sexo, dataRegistro, dataAgressao, image, latitude, longitude, synced, updatedAt)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?)
        `,
        [
          nomeACS_enc,
          nomeAgredido_enc,
          municipio ?? null,
          endereco_enc,
          local ?? null,
          tratamento ?? null,
          Array.isArray(animais) ? JSON.stringify(animais) : null,
          Array.isArray(fontesLuz) ? JSON.stringify(fontesLuz) : null,
          Array.isArray(circunstancias) ? JSON.stringify(circunstancias) : null,
          sexo ?? null,
          dataRegistro ?? null,
          dataAgressao ?? null,
          image ?? null,
          latitude,
          longitude,
          updatedAt,
        ],
        (_, result) => resolve({ id: result?.insertId, synced: false, updatedAt }),
        (_, error) => reject(error)
      );
    });
  });
};

// Buscar todos os registros (opcionalmente somente não sincronizados)
export const buscarRegistrosLocais = async ({ somenteNaoSincronizados = false } = {}) => {
  await ensureSchema();
  const key = await getLocalCryptoKey();

  const where = somenteNaoSincronizados ? "WHERE synced = 0" : "";
  return new Promise((resolve, reject) => {
    db.transaction((tx) => {
      tx.executeSql(
        `SELECT * FROM ${TABLE} ${where} ORDER BY datetime(updatedAt) DESC, id DESC`,
        [],
        (_, result) => {
          const rows = result.rows;
          const registros = [];
          for (let i = 0; i < rows.length; i++) {
            registros.push(mapRowToDomain(rows.item(i), key));
          }
          resolve(registros);
        },
        (_, error) => reject(error)
      );
    });
  });
};

// Buscar um registro por ID
export const buscarRegistroPorId = async (id) => {
  await ensureSchema();
  const key = await getLocalCryptoKey();

  return new Promise((resolve, reject) => {
    db.transaction((tx) => {
      tx.executeSql(
        `SELECT * FROM ${TABLE} WHERE id = ? LIMIT 1`,
        [id],
        (_, result) => {
          if (result.rows.length === 0) return resolve(null);
          resolve(mapRowToDomain(result.rows.item(0), key));
        },
        (_, error) => reject(error)
      );
    });
  });
};

// Atualização parcial (patch)
export const atualizarRegistroLocal = async (id, patch = {}) => {
  await ensureSchema();
  const key = await getLocalCryptoKey();
  const updatedAt = nowISO();

  const setCols = [];
  const params = [];

  const apply = (col, val) => {
    setCols.push(`${col} = ?`);
    params.push(val);
  };

  // PII criptografado
  if ("nomeACS" in patch) apply("nomeACS", patch.nomeACS == null ? null : encryptText(patch.nomeACS, key));
  if ("nomeAgredido" in patch)
    apply("nomeAgredido", patch.nomeAgredido == null ? null : encryptText(patch.nomeAgredido, key));
  if ("endereco" in patch) apply("endereco", patch.endereco == null ? null : encryptText(patch.endereco, key));

  // não-PII / demais
  if ("municipio" in patch) apply("municipio", patch.municipio ?? null);
  if ("local" in patch) apply("local", patch.local ?? null);
  if ("tratamento" in patch) apply("tratamento", patch.tratamento ?? null);
  if ("animais" in patch) apply("animais", Array.isArray(patch.animais) ? JSON.stringify(patch.animais) : null);
  if ("fontesLuz" in patch)
    apply("fontesLuz", Array.isArray(patch.fontesLuz) ? JSON.stringify(patch.fontesLuz) : null);
  if ("circunstancias" in patch)
    apply("circunstancias", Array.isArray(patch.circunstancias) ? JSON.stringify(patch.circunstancias) : null);
  if ("sexo" in patch) apply("sexo", patch.sexo ?? null);
  if ("dataRegistro" in patch) apply("dataRegistro", patch.dataRegistro ?? null);
  if ("dataAgressao" in patch) apply("dataAgressao", patch.dataAgressao ?? null);
  if ("image" in patch) apply("image", patch.image ?? null);

  if (patch.location && typeof patch.location === "object") {
    if ("latitude" in patch.location) apply("latitude", toNumber(patch.location.latitude));
    if ("longitude" in patch.location) apply("longitude", toNumber(patch.location.longitude));
  }

  if ("synced" in patch) apply("synced", patch.synced ? 1 : 0);

  // sempre atualiza updatedAt
  apply("updatedAt", updatedAt);

  return new Promise((resolve, reject) => {
    db.transaction((tx) => {
      tx.executeSql(
        `UPDATE ${TABLE} SET ${setCols.join(", ")} WHERE id = ?`,
        [...params, id],
        async () => resolve(await buscarRegistroPorId(id)),
        (_, error) => reject(error)
      );
    });
  });
};

// Marcar uma lista de IDs como sincronizados
export const marcarComoSincronizado = async (ids = []) => {
  await ensureSchema();
  if (!Array.isArray(ids) || ids.length === 0) return 0;

  const updatedAt = nowISO();
  const placeholders = ids.map(() => "?").join(",");

  return new Promise((resolve, reject) => {
    db.transaction((tx) => {
      tx.executeSql(
        `UPDATE ${TABLE} SET synced = 1, updatedAt = ? WHERE id IN (${placeholders})`,
        [updatedAt, ...ids],
        (_, result) => resolve(result.rowsAffected || 0),
        (_, error) => reject(error)
      );
    });
  });
};

// Deletar registro local
export const deletarRegistroLocal = async (id) => {
  await ensureSchema();
  return new Promise((resolve, reject) => {
    db.transaction((tx) => {
      tx.executeSql(
        `DELETE FROM ${TABLE} WHERE id = ?`,
        [id],
        (_, result) => resolve(result.rowsAffected || 0),
        (_, error) => reject(error)
      );
    });
  });
};

// Limpar tabela (cuidado!)
export const limparTabelaRegistros = async () => {
  await ensureSchema();
  return new Promise((resolve, reject) => {
    db.transaction((tx) => {
      tx.executeSql(
        `DELETE FROM ${TABLE}`,
        [],
        (_, result) => resolve(result.rowsAffected || 0),
        (_, error) => reject(error)
      );
    });
  });
};
