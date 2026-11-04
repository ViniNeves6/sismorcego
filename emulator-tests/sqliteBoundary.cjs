// Somente a ponte nativa SQLite/Keychain: SQL e AES reais no processo de teste.
/* eslint-env node, es2022 */
const { DatabaseSync } = require('node:sqlite');
const CryptoJS = require('crypto-js');
const database = new DatabaseSync(':memory:');
const key = 'chave-exclusiva-dos-testes-locais';
module.exports = {
  __esModule: true,
  default: {
    transaction(callback, fail, complete) {
      try {
        database.exec('BEGIN');
        const tx = { executeSql(sql, params = [], success, error) {
          try {
            const statement = database.prepare(sql);
            const reading = /^\s*SELECT/.test(sql);
            const rows = reading ? statement.all(...params) : [];
            const affected = reading ? 0 : Number(statement.run(...params).changes);
            success?.(tx, { rows: { length: rows.length, item: i => rows[i] }, rowsAffected: affected });
          } catch (failure) { error?.(tx, failure); throw failure; }
        } };
        callback(tx); database.exec('COMMIT'); complete?.();
      } catch (failure) { database.exec('ROLLBACK'); fail?.(failure); }
    },
  },
  getLocalCryptoKey: async () => key,
  encryptText: value => `enc:v1:${CryptoJS.AES.encrypt(value,key).toString()}`,
  decryptText: value => value.startsWith('enc:v1:') ? CryptoJS.AES.decrypt(value.slice(7),key).toString(CryptoJS.enc.Utf8) : value,
  clear: () => { database.exec('DELETE FROM offline_queue_v2'); },
  close: () => database.close(),
};
