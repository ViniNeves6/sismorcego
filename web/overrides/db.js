// Web: substitui src/database/db.js. Mesmo SQL do app (react-native-sqlite-storage),
// executado pelo SQLite compilado para WebAssembly (sql.js). O arquivo do banco é
// salvo no IndexedDB do navegador depois de cada transação.
import initSqlJs from 'sql.js';
import CryptoJS from 'crypto-js';
import * as Keychain from 'react-native-keychain';
import logger from '../../src/utils/logger';

const IDB_NAME = 'sismorcego', IDB_STORE = 'sqlite', IDB_KEY = 'sismorcego.db';
const idb = () => new Promise((resolve, reject) => {
  const req = indexedDB.open(IDB_NAME, 1);
  req.onupgradeneeded = () => req.result.createObjectStore(IDB_STORE);
  req.onsuccess = () => resolve(req.result);
  req.onerror = () => reject(req.error);
});
const idbGet = async () => { const d = await idb(); return new Promise((res, rej) => { const r = d.transaction(IDB_STORE).objectStore(IDB_STORE).get(IDB_KEY); r.onsuccess = () => res(r.result || null); r.onerror = () => rej(r.error); }); };
const idbPut = async bytes => { const d = await idb(); return new Promise((res, rej) => { const t = d.transaction(IDB_STORE, 'readwrite'); t.objectStore(IDB_STORE).put(bytes, IDB_KEY); t.oncomplete = () => res(); t.onerror = () => rej(t.error); }); };

const ready = (async () => {
  const SQL = await initSqlJs({ locateFile: file => `${globalThis.__sismorcegoWasmBase || '/'}${file}` });
  let saved = null;
  try { saved = await idbGet(); } catch (error) { logger.warn('IndexedDB indisponível; registros ficarão só nesta sessão.', error); }
  return new SQL.Database(saved || undefined);
})();
let database = null;
ready.then(d => { database = d; }, error => logger.error('SQLite web: falha ao abrir', error));

let saveTimer;
const persist = () => {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => { if (database) idbPut(database.export()).catch(e => logger.warn('SQLite web: falha ao salvar', e)); }, 150);
};
const isWrite = sql => !/^\s*(SELECT|PRAGMA)/i.test(sql);

function run(sql, params = []) {
  const stmt = database.prepare(sql);
  try {
    stmt.bind(params.map(v => (v === undefined ? null : typeof v === 'boolean' ? Number(v) : v)));
    const items = [];
    while (stmt.step()) items.push(stmt.getAsObject());
    const rowsAffected = isWrite(sql) ? database.getRowsModified() : 0;
    return { rows: { length: items.length, item: i => items[i], raw: () => items, _array: items }, rowsAffected, insertId: undefined };
  } finally { stmt.free(); }
}

// Mesma semântica do plugin nativo: callbacks de sucesso podem encadear novas
// instruções na mesma transação; um erro sem tratamento desfaz tudo.
function transaction(callback, onError, onSuccess) {
  ready.then(() => {
    let failed = null, writes = false;
    const tx = {
      executeSql(sql, params, success, error) {
        if (failed) return;
        try {
          if (isWrite(sql)) writes = true;
          const result = run(sql, params);
          success?.(tx, result);
        } catch (cause) {
          const handled = error ? error(tx, cause) === false : false;
          if (!handled) failed = cause;
        }
      },
    };
    database.run('BEGIN');
    try { callback(tx); } catch (cause) { failed = failed || cause; }
    if (failed) { try { database.run('ROLLBACK'); } catch { /* sem transação aberta */ } onError?.(failed); return; }
    database.run('COMMIT');
    if (writes) persist();
    onSuccess?.();
  }, error => onError?.(error));
}

const db = {
  transaction,
  readTransaction: transaction,
  executeSql(sql, params, success, error) {
    ready.then(() => { try { const r = run(sql, params); if (isWrite(sql)) persist(); success?.(r); } catch (cause) { error?.(cause); } }, error);
  },
};

// ---- Criptografia do payload: mesma do app; chave guardada no navegador ----
const KEYCHAIN_SERVICE = 'sismorcego.sqlite.localkey.v1';
const KEYCHAIN_ACCOUNT = 'local-aes-key';
let localKeyPromise;
export const getLocalCryptoKey = () => {
  if (!localKeyPromise) localKeyPromise = (async () => {
    const existing = await Keychain.getGenericPassword({ service: KEYCHAIN_SERVICE });
    if (existing?.username === KEYCHAIN_ACCOUNT && existing?.password) return existing.password;
    const key = CryptoJS.enc.Hex.stringify(CryptoJS.lib.WordArray.random(32));
    await Keychain.setGenericPassword(KEYCHAIN_ACCOUNT, key, { service: KEYCHAIN_SERVICE });
    return key;
  })().catch(error => { localKeyPromise = null; throw error; });
  return localKeyPromise;
};
export const encryptText = (plainText, key) => {
  if (plainText === null || plainText === undefined) return null;
  const text = String(plainText);
  if (text.startsWith('enc:v1:')) return text;
  const iv = CryptoJS.lib.WordArray.random(16);
  const encrypted = CryptoJS.AES.encrypt(text, CryptoJS.enc.Hex.parse(key), { iv, mode: CryptoJS.mode.CBC, padding: CryptoJS.pad.Pkcs7 });
  return `enc:v1:${CryptoJS.enc.Base64.stringify(iv)}:${CryptoJS.enc.Base64.stringify(encrypted.ciphertext)}`;
};
export const decryptText = (cipherText, key) => {
  if (cipherText === null || cipherText === undefined) return null;
  const text = String(cipherText);
  if (!text.startsWith('enc:v1:')) return text;
  try {
    const parts = text.split(':');
    if (parts.length < 4) return null;
    const plain = CryptoJS.AES.decrypt({ ciphertext: CryptoJS.enc.Base64.parse(parts.slice(3).join(':')) }, CryptoJS.enc.Hex.parse(key),
      { iv: CryptoJS.enc.Base64.parse(parts[2]), mode: CryptoJS.mode.CBC, padding: CryptoJS.pad.Pkcs7 }).toString(CryptoJS.enc.Utf8);
    return plain === '' ? null : plain;
  } catch { return null; }
};
export const initDB = () => {};
export default db;
