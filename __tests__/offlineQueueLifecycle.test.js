import { addToQueue, cacheCloudRecord, loadQueue, removeFromQueue, updateQueueItemIfRevision } from '../src/services/offlineQueue';

var mockDatabase;
jest.mock('../src/database/db', () => {
  const { DatabaseSync } = require('node:sqlite');
  mockDatabase = new DatabaseSync(':memory:');
  mockDatabase.exec(`CREATE TABLE offline_queue (recordId TEXT PRIMARY KEY, uid TEXT, status TEXT, retryCount INTEGER,
    lastError TEXT, createdAt TEXT, updatedAtLocal TEXT, payload TEXT)`);
  mockDatabase.prepare('INSERT INTO offline_queue VALUES (?, ?, ?, ?, ?, ?, ?, ?)').run('legacy', 'acs-a', 'pending', 0, null,
    '2026-10-28', 'v1', JSON.stringify({ recordId: 'legacy', uid: 'acs-a', localRevision: 'v1', municipio: 'Belém' }));
  const transaction = (callback, fail, complete) => {
    try {
      mockDatabase.exec('BEGIN');
      const tx = { executeSql: (sql, params = [], success, error) => {
        try {
          const statement = mockDatabase.prepare(sql);
          let rows = [], affected = 0;
          if (/^\s*SELECT/.test(sql)) rows = statement.all(...params);
          else affected = Number(statement.run(...params).changes);
          success?.(tx, { rows: { length: rows.length, item: index => rows[index] }, rowsAffected: affected });
        } catch (exception) { error?.(tx, exception); throw exception; }
      } };
      callback(tx); mockDatabase.exec('COMMIT'); complete?.();
    } catch (error) { mockDatabase.exec('ROLLBACK'); fail?.(error); }
  };
  return { __esModule: true, default: { transaction }, getLocalCryptoKey: async () => 'test-key',
    encryptText: value => `enc:${value}`, decryptText: value => value.startsWith('enc:') ? value.slice(4) : value };
});

test('migrates the legacy SQLite queue transactionally without losing encrypted payload or identity', async () => {
  const rows = await loadQueue({ uid: 'acs-a' });
  expect(rows).toHaveLength(1);
  expect(rows[0]).toMatchObject({ recordId: 'legacy', uid: 'acs-a', municipio: 'Belém', localRevision: 'v1' });
});

test('same-id records coexist by owner and revision responses cannot modify another owner or restore a deleted row', async () => {
  await addToQueue({ recordId: 'same', uid: 'acs-a', localRevision: 'v1' }, { returnQueue: false });
  await addToQueue({ recordId: 'same', uid: 'acs-b', localRevision: 'v1' }, { returnQueue: false });
  await updateQueueItemIfRevision('same', 'v1', { status: 'synced' }, { uid: 'acs-a' });
  expect((await loadQueue({ uid: 'acs-b' }))[0].status).toBe('pending');
  await removeFromQueue(['same'], { uid: 'acs-a' });
  expect(await updateQueueItemIfRevision('same', 'v1', { status: 'synced' }, { uid: 'acs-a' })).toBe(false);
  expect((await loadQueue({ uid: 'acs-b' }))[0].recordId).toBe('same');
});

test('cloud cache cannot overwrite a pending edit and an old upload response cannot erase a new revision', async () => {
  await addToQueue({ recordId: 'edit', uid: 'acs-a', localRevision: 'v2', municipio: 'Curuçá' }, { returnQueue: false });
  await cacheCloudRecord({ recordId: 'edit', uid: 'acs-a', municipio: 'Old' });
  expect(await updateQueueItemIfRevision('edit', 'v1', { status: 'synced' }, { uid: 'acs-a' })).toBe(false);
  expect((await loadQueue({ uid: 'acs-a' })).find(row => row.recordId === 'edit')).toMatchObject({ municipio: 'Curuçá', localRevision: 'v2', status: 'pending' });
});

test('a delayed cloud refresh cannot roll back a confirmed edit or replace an in-flight local revision', async () => {
  await addToQueue({ recordId: 'refresh', uid: 'acs-a', localRevision: 'edit-v2', status: 'synced', serverRevision: 2,
    baseServerRevision: 2, municipio: 'Curuçá' }, { returnQueue: false });
  const refresh = (patch) => updateQueueItemIfRevision('refresh', 'edit-v2', patch, { uid: 'acs-a', cloudRefresh: true });
  expect(await refresh({ status: 'synced', serverRevision: 1, municipio: 'Belém' })).toBe(false);
  expect((await loadQueue({ uid: 'acs-a' })).find(row => row.recordId === 'refresh').municipio).toBe('Curuçá');
  expect(await refresh({ status: 'synced', serverRevision: 3, municipio: 'Marapanim' })).toBe(true);
  expect((await loadQueue({ uid: 'acs-a' })).find(row => row.recordId === 'refresh')).toMatchObject({ baseServerRevision: 3, municipio: 'Marapanim' });
  await updateQueueItemIfRevision('refresh', 'edit-v2', { status: 'syncing' }, { uid: 'acs-a' });
  expect(await refresh({ status: 'synced', serverRevision: 3, municipio: 'Outra cópia' })).toBe(false);
});

afterAll(() => mockDatabase.close());
