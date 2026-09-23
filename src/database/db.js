// src/database/db.js
import SQLite from "react-native-sqlite-storage";
import * as Keychain from "react-native-keychain";
import CryptoJS from "crypto-js";
import logger from '../utils/logger';

SQLite.enablePromise(false);
SQLite.DEBUG(false);

// ============================
// Banco (singleton)
// ============================
const db = SQLite.openDatabase(
  { name: "sismorcego.db", location: "default" },
  () => logger.log("✅ SQLite: banco aberto com sucesso"),
  (err) => logger.error("❌ SQLite: erro ao abrir banco", err)
);

// ============================
// Crypto (PII em repouso)
// ============================
// Guardamos uma chave AES no Keychain e usamos para criptografar campos PII.
const KEYCHAIN_SERVICE = "sismorcego.sqlite.localkey.v1";
const KEYCHAIN_ACCOUNT = "local-aes-key";

const randomKeyString = () => {
  // 32 bytes (256-bit) em hex
  const words = CryptoJS.lib.WordArray.random(32);
  return CryptoJS.enc.Hex.stringify(words);
};

export const getLocalCryptoKey = async () => {
  try {
    const existing = await Keychain.getGenericPassword({ service: KEYCHAIN_SERVICE });
    if (existing?.username === KEYCHAIN_ACCOUNT && existing?.password) {
      return existing.password;
    }

    const newKey = randomKeyString();
    await Keychain.setGenericPassword(KEYCHAIN_ACCOUNT, newKey, { service: KEYCHAIN_SERVICE });
    return newKey;
  } catch (e) {
    logger.warn("⚠️ Keychain indisponível. Criptografia local pode falhar.", e);
    // Fallback NÃO ideal: ainda retorna algo para não quebrar o app.
    // Em produção, prefira bloquear insert/list se não conseguir obter chave.
    return "INSECURE_FALLBACK_KEY__DO_NOT_USE_IN_PROD";
  }
};

export const encryptText = (plainText, key) => {
  if (plainText === null || plainText === undefined) return null;
  const text = String(plainText);

  // Já criptografado? não recriptografa
  if (text.startsWith("enc:v1:")) return text;

  const iv = CryptoJS.lib.WordArray.random(16); // 128-bit IV
  const encrypted = CryptoJS.AES.encrypt(text, CryptoJS.enc.Hex.parse(key), {
    iv,
    mode: CryptoJS.mode.CBC,
    padding: CryptoJS.pad.Pkcs7,
  });

  const ivB64 = CryptoJS.enc.Base64.stringify(iv);
  const ctB64 = CryptoJS.enc.Base64.stringify(encrypted.ciphertext);

  return `enc:v1:${ivB64}:${ctB64}`;
};

export const decryptText = (cipherText, key) => {
  if (cipherText === null || cipherText === undefined) return null;
  const text = String(cipherText);

  // Se não estiver no formato esperado, assume texto puro (compat legado)
  if (!text.startsWith("enc:v1:")) return text;

  try {
    const parts = text.split(":");
    // enc:v1:<ivB64>:<ctB64>
    if (parts.length < 4) return null;

    const ivB64 = parts[2];
    const ctB64 = parts.slice(3).join(":");

    const iv = CryptoJS.enc.Base64.parse(ivB64);
    const ciphertext = CryptoJS.enc.Base64.parse(ctB64);

    const decrypted = CryptoJS.AES.decrypt(
      { ciphertext },
      CryptoJS.enc.Hex.parse(key),
      { iv, mode: CryptoJS.mode.CBC, padding: CryptoJS.pad.Pkcs7 }
    );

    const plain = decrypted.toString(CryptoJS.enc.Utf8);
    return plain === "" ? null : plain;
  } catch {
    return null;
  }
};

// ============================
// Init / PRAGMAs
// ============================
export const initDB = () => {
  // ✅ fora de transaction
  db.executeSql(
    "PRAGMA journal_mode = WAL;",
    [],
    () => {
      // depois pode fazer os outros
      db.transaction(
        (tx) => {
          tx.executeSql("PRAGMA foreign_keys = ON;");
          tx.executeSql("PRAGMA synchronous = NORMAL;");
        },
        (err) => logger.warn("⚠️ SQLite: erro ao aplicar PRAGMAs", err),
        () => logger.log("✅ SQLite: PRAGMAs aplicados")
      );
    },
    (err) => logger.warn("⚠️ SQLite: WAL não aplicado (ok continuar)", err)
  );
};

export default db;