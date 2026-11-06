import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import { deleteDoc, getDocs, setDoc } from 'firebase/firestore';
import { acceptRemoteRecordVersion } from '../src/services/recordMutations';
import { auth } from '../src/services/firebase';
import { addToQueue } from '../src/services/offlineQueue';
import { addNewRecordToStorage, loadRecordsFromStorage, isRedesignSample, loadAccountProfile, updateRecordInStorage } from '../src/services/redesignData';
import { syncPendingRegistros } from '../src/services/syncRegistros';
import { mergeByRecordId, excluirRegistro } from '../src/services/historico';
import { toRecordView } from '../src/services/registroAdapter';
import { completeRecordDraft, getRecordDraftIdentity } from '../src/services/recordDraftIdentity';
import { panelKpis, panelChart, filterPanelRecords } from '../src/services/adminPanelData';
import { buildAlertContract } from '../src/services/alertContract';

let mockRows = [];
let mockCloud = new Map();
// Exercita persistência e sincronização reais com fronteiras nativas simuladas.
jest.mock('../src/services/debugTestSession', () => ({ LOCAL_TEST_MODE: false }));
jest.mock('../src/services/firebase', () => ({ auth: { currentUser: { uid: 'owner' } }, db: {} }));
jest.mock('@react-native-community/netinfo', () => ({ fetch: jest.fn() }));
jest.mock('firebase/firestore', () => ({
  collection: jest.fn((...path) => path.slice(1).join('/')), collectionGroup: jest.fn(),
  doc: jest.fn((...path) => ({ id: 'generated-id', path: path.slice(1).join('/') })),
  getDocs: jest.fn(), query: jest.fn(), orderBy: jest.fn(), limit: jest.fn(),
  getDoc:jest.fn(async ref=>({exists:()=>mockCloud.has(ref.path),data:()=>mockCloud.get(ref.path)})),
  runTransaction: jest.fn(async (_, callback) => {
    const writes = [];
    const receipt = await callback({
      get: async ref => ({ exists: () => mockCloud.has(ref.path), data: () => mockCloud.get(ref.path) }),
      set: (ref, payload) => writes.push([ref, payload]),
    });
    const { setDoc: write } = require('firebase/firestore');
    for (const [ref,payload] of writes) { if (!ref.path.includes('/alteracoes/')) await write(ref,payload); }
    for (const [ref,payload] of writes) mockCloud.set(ref.path,{ ...mockCloud.get(ref.path),...payload });
    return receipt;
  }),
  setDoc: jest.fn(), deleteDoc: jest.fn(), serverTimestamp: () => 'server-time',
}));
jest.mock('../src/services/offlineQueue', () => ({
  loadQueue: jest.fn(async () => mockRows.map(row => ({ ...row }))),
  addToQueue: jest.fn(async row => { mockRows = [...mockRows.filter(r => r.recordId !== row.recordId), { ...row }]; return mockRows; }),
  removeFromQueue: jest.fn(async ids => { mockRows = mockRows.filter(r => !ids.includes(r.recordId)); }),
  updateQueueItemIfRevision: jest.fn(async (id, revision, patch) => {
    const row = mockRows.find(r => r.recordId === id);
    if (!row || (row.localRevision || row.updatedAtLocal) !== revision) return false;
    Object.assign(row, patch, { localRevision: revision }); return true;
  }),
}));
let counter = 0;
beforeEach(async () => {
  jest.clearAllMocks();
  await AsyncStorage.clear();
  auth.currentUser = { uid: `owner-${++counter}`, displayName: 'Ana', email: 'ana@real.org' };
  mockRows = [];
  mockCloud = new Map();
  NetInfo.fetch.mockResolvedValue({ isConnected: true, isInternetReachable: true });
  getDocs.mockResolvedValue({ forEach: () => {} });
  setDoc.mockReset().mockResolvedValue(); deleteDoc.mockReset().mockResolvedValue();
});
const pending = (id, uid = auth.currentUser.uid) => ({ recordId: id, uid, lifecycleVersion: 2, status: 'pending', localRevision: 'v1', municipio: 'Belém', tipoVitima: 'aves', detalhes: { especie: 'pato' } });

test('actual GPS precision and origin survive form storage, offline queue, cloud payload and history', async () => {
  const gps = { lat: -1.234567891, lng: -48.123456789, accuracy: 135, source: 'gps_coarse', isHighAccuracy: false };
  const record = { id: 'gps', victimKey: 'aves', city: 'Belém', reporter: 'Ana', isoDate: '2026-10-20', details: {}, gps };
  const saved = await addNewRecordToStorage(record);
  expect(saved.gps).toMatchObject(gps);
  const expected = { latitude: gps.lat, longitude: gps.lng, accuracy: 135, source: 'gps_coarse', isHighAccuracy: false };
  expect(mockRows[0].location).toEqual(expected);
  await syncPendingRegistros();
  expect(setDoc.mock.calls[0][1].location).toEqual(expected);
  expect((await loadRecordsFromStorage())[0].gps).toMatchObject(gps);
});

test('invalid GPS in a pending row remains local with an error instead of uploading or deleting it', async () => {
  mockRows = [{ ...pending('invalid-gps'), location: { latitude: NaN, longitude: -48 } }];
  const result = await syncPendingRegistros();
  expect(result.failed).toBe(1);
  expect(setDoc).not.toHaveBeenCalled();
  expect(mockRows[0]).toMatchObject({ recordId: 'invalid-gps', status: 'failed' });
  expect(mockRows[0].lastError).toContain('Coordenadas GPS inválidas');
});

test('empty installation starts with no example records or fabricated account', async () => {
  expect(await loadRecordsFromStorage()).toEqual([]);
  expect(await loadAccountProfile()).toEqual({ username: 'Ana', email: 'ana@real.org', photoUri: null });
});
test('removes only exact samples and migrates meaningful HTML records into the real queue', async () => {
  const sample = { id: 1, victimKey: 'humano', city: 'Curuçá', date: '26/10/2026', reporter: 'Agente de Saúde (Você)', details: {} };
  const real = { ...sample, id: 100, isoDate: '2026-10-26', details: { 'hv-nome': 'Maria' } };
  expect(isRedesignSample({ ...sample, details: { 'hv-nome': 'Maria' } })).toBe(false);
  await AsyncStorage.setItem('@sismorcego:html_records_v1', JSON.stringify([sample, real]));
  const result = await loadRecordsFromStorage();
  expect(result).toHaveLength(1);
  expect(mockRows[0]).toMatchObject({ recordId: 'html-100', uid: auth.currentUser.uid, detalhes: { nomeAgredido: 'Maria' } });
  expect(await AsyncStorage.getItem('@sismorcego:html_records_v1')).toBeNull();
});
test('saves the canonical record in the real queue and propagates storage errors', async () => {
  const record = { id: 123, victimKey: 'aves', city: 'Belém', reporter: 'Ana', isoDate: '2026-10-20', details: { 'av-especie': 'Pato' } };
  const result = await addNewRecordToStorage(record);
  expect(result.id).toBe('123');
  expect(mockRows[0]).toMatchObject({ uid: auth.currentUser.uid, tipoVitima: 'aves', detalhes: { especie: 'pato' }, status: 'pending' });
  addToQueue.mockRejectedValueOnce(new Error('disco cheio'));
  await expect(addNewRecordToStorage(record)).rejects.toThrow('disco cheio');
});
test('does not load or sync another account’s queue', async () => {
  mockRows = [pending('mine'), pending('other', 'different-owner')];
  const records = await loadRecordsFromStorage();
  expect(records.map(r => r.id)).toEqual(['mine']);
  await syncPendingRegistros();
  expect(setDoc).toHaveBeenCalledTimes(1);
  expect(setDoc.mock.calls[0][0].path).toContain(`${auth.currentUser.uid}/itens/mine`);
  expect(mockRows.find(r => r.recordId === 'other').status).toBe('pending');
});
test('retains encrypted offline history after sync, and failed uploads remain retryable', async () => {
  mockRows = [pending('ok'), pending('failed')];
  setDoc.mockResolvedValueOnce().mockRejectedValueOnce(new Error('permission-denied'));
  const result = await syncPendingRegistros();
  expect(result).toMatchObject({ synced: 1, failed: 1 });
  expect(mockRows.find(r => r.recordId === 'ok').status).toBe('synced');
  expect(mockRows.find(r => r.recordId === 'failed')).toMatchObject({ status: 'failed', lastError: 'permission-denied', retryCount: 1 });
});
test('an edit during an upload stays pending instead of being erased by its response', async () => {
  mockRows = [pending('r1')];
  setDoc.mockImplementationOnce(async () => Object.assign(mockRows[0], { localRevision: 'v2', status: 'pending', municipio: 'Ananindeua' }));
  await syncPendingRegistros();
  expect(mockRows[0]).toMatchObject({ localRevision: 'v2', status: 'pending', municipio: 'Ananindeua' });
});
test('cancelling an unsent local occurrence preserves it and its audit instead of deleting it', async () => {
  mockRows = [pending('r1')];
  const staleEditor = toRecordView(mockRows[0]);
  await expect(excluirRegistro(mockRows[0])).rejects.toThrow('motivo');
  await excluirRegistro(mockRows[0], 'Duplicidade antes do envio');
  expect(mockRows).toHaveLength(1);
  expect(mockRows[0]).toMatchObject({ lifecycleStatus: 'cancelled', hasServerCopy: false });
  expect(mockRows[0].auditEvents[0].action).toBe('cancel');
  await expect(updateRecordInStorage(staleEditor)).rejects.toThrow(/cancelad/);
  await syncPendingRegistros();
  expect(deleteDoc).not.toHaveBeenCalled();
  expect(setDoc.mock.calls[0][1].lifecycleStatus).toBe('cancelled');
});
test('pending local changes take precedence over an old cloud copy', () => {
  expect(mergeByRecordId([{ ...pending('r1'), municipio: 'Old' }], [{ ...pending('r1'), municipio: 'New' }])[0].municipio).toBe('New');
});

test('a confirmed local revision takes precedence over a delayed older cloud query', () => {
  const cloud = { ...pending('r1'), status: 'synced', serverRevision: 1, municipio: 'Belém' };
  const local = { ...cloud, serverRevision: 2, baseServerRevision: 2, municipio: 'Curuçá' };
  expect(mergeByRecordId([cloud], [local])[0].municipio).toBe('Curuçá');
});

test('editing preserves the original responsible exactly and rejects changing the author', async () => {
  mockRows = [{ ...pending('author'), nomeAcs: '  Nome original  ', notificadorTipo: 'coordenador' }];
  const original = toRecordView(mockRows[0]);
  await expect(updateRecordInStorage({ ...original, reporter: 'Outro autor' })).rejects.toThrow('responsável original');
  await updateRecordInStorage({ ...original, city: 'Curuçá' });
  expect(mockRows[0]).toMatchObject({ nomeAcs: '  Nome original  ', nomeNotificador: '  Nome original  ', notificadorTipo: 'coordenador' });
});

test.each(['pending', 'synced'])('saving an unchanged %s record does not queue a write, audit or upload', async status => {
  mockRows = [{ ...pending('no-op'), status, nomeAcs: 'Ana', comunidade: 'Centro', dataMordedura: '2026-10-20' }];
  const original = toRecordView(mockRows[0]);
  await updateRecordInStorage({ ...original, city: ' Belém ', details: { ...original.details, unusedOptional: '' } });
  expect(addToQueue).not.toHaveBeenCalled(); expect(setDoc).not.toHaveBeenCalled();
  expect(mockRows[0].auditEvents).toBeUndefined();
  expect(mockRows[0].localRevision).toBe('v1'); expect(mockRows[0].status).toBe(status);
});
test('offline sync reports offline and never claims a successful upload', async () => {
  mockRows = [pending('r1')];
  NetInfo.fetch.mockResolvedValue({ isConnected: false });
  expect(await syncPendingRegistros()).toMatchObject({ synced: 0, reason: 'offline' });
  expect(setDoc).not.toHaveBeenCalled();
});
test('rejects editing a record belonging to another account', async () => {
  await expect(updateRecordInStorage({ id: 'foreign', uid: 'another' })).rejects.toThrow('próprios registros');
  expect(addToQueue).not.toHaveBeenCalled();
});

test('five offline occurrences retain their permanent identities on retry and repeated sync', async () => {
  NetInfo.fetch.mockResolvedValue({ isConnected: false });
  const ids = [];
  for (let index = 0; index < 5; index++) {
    const draft = await getRecordDraftIdentity(auth.currentUser.uid);
    expect(await getRecordDraftIdentity(auth.currentUser.uid)).toEqual(draft);
    const saved = await addNewRecordToStorage({ id: draft.id, victimKey: index ? 'aves' : 'humano', city: 'Belém', details: {} });
    ids.push(saved.id);
    await completeRecordDraft(auth.currentUser.uid, draft.id);
  }
  expect(new Set(ids).size).toBe(5);
  expect((await syncPendingRegistros()).reason).toBe('offline');
  NetInfo.fetch.mockResolvedValue({ isConnected: true });
  expect((await syncPendingRegistros()).synced).toBe(5);
  const paths = [...mockCloud.keys()];
  expect(paths).toEqual(expect.arrayContaining(ids.map(id => `registros/${auth.currentUser.uid}/itens/${id}`)));
  // Simula perda da confirmação local e reenvio após reiniciar o processo.
  mockRows.forEach(row => { row.status = 'pending'; });
  expect((await syncPendingRegistros()).synced).toBe(5);
  expect([...mockCloud.keys()]).toEqual(paths);
  expect(setDoc.mock.calls.some(([ref]) => ref.path.includes('notificacoes'))).toBe(false);
});

test('editing before and after sync updates the same occurrence and stores actor, time and changed values', async () => {
  const saved = await addNewRecordToStorage({ id: 'edit', victimKey: 'aves', city: 'Belém', details: {} });
  const first = await updateRecordInStorage({ ...saved, city: 'Curuçá' });
  expect(first.id).toBe('edit');
  expect(mockRows).toHaveLength(1);
  await syncPendingRegistros();
  const synced = (await loadRecordsFromStorage())[0];
  await updateRecordInStorage({ ...synced, city: 'Marapanim' });
  await syncPendingRegistros();
  const path = `registros/${auth.currentUser.uid}/itens/edit`;
  expect(mockCloud.get(path)).toMatchObject({ recordId: 'edit', municipio: 'Marapanim', serverReceivedAt: 'server-time' });
  const audits = [...mockCloud.entries()].filter(([key]) => key.includes('/alteracoes/')).map(([, value]) => value);
  expect(audits).toHaveLength(2);
  expect(audits[1]).toMatchObject({ action: 'edit', actorUid: auth.currentUser.uid, before:{municipio:'Curuçá'},after:{municipio:'Marapanim'} });
  expect(audits[1].clientAt).toBeTruthy();
  const contract = buildAlertContract('coord', mockCloud.get(path), 'received');
  expect(contract.id).toBe(buildAlertContract('coord', { ...mockCloud.get(path), municipio: 'Other' }, 'later').id);
});

test('cancelling a synchronized case requires a reason, preserves its document and audit and removes it from active statistics', async () => {
  mockRows = [pending('cancel')];
  await syncPendingRegistros();
  const saved = toRecordView(mockRows[0]);
  await expect(excluirRegistro(saved)).rejects.toThrow('motivo');
  const cancelled = await excluirRegistro(saved, 'Registro em duplicidade');
  expect(cancelled).toMatchObject({ id: 'cancel', lifecycleStatus: 'cancelled', statusLabel: 'Registro cancelado' });
  await syncPendingRegistros();
  const path = `registros/${auth.currentUser.uid}/itens/cancel`;
  expect(mockCloud.get(path)).toMatchObject({ lifecycleStatus: 'cancelled', cancellation: { actorUid: auth.currentUser.uid, reason: 'Registro em duplicidade' } });
  expect([...mockCloud.keys()].some(key => key.startsWith(`${path}/alteracoes/`))).toBe(true);
  expect(deleteDoc).not.toHaveBeenCalled();
  expect(filterPanelRecords([cancelled])).toEqual([]);
  expect(panelKpis([cancelled]).total).toBe(0);
  expect(panelChart([cancelled], 'day').sum).toBe(0);
  await expect(updateRecordInStorage(cancelled)).rejects.toThrow(/cancelad/);
});

test('cancelling during an upload retains the cancellation after the stale response and never physically deletes', async () => {
  mockRows = [pending('in-flight')];
  setDoc.mockImplementationOnce(async () => {
    await excluirRegistro(toRecordView(mockRows[0]), 'Correção durante envio');
  });
  await syncPendingRegistros();
  expect(mockRows[0]).toMatchObject({ lifecycleStatus: 'cancelled', status: 'pending' });
  await syncPendingRegistros();
  expect(mockCloud.get(`registros/${auth.currentUser.uid}/itens/in-flight`).lifecycleStatus).toBe('cancelled');
  expect(deleteDoc).not.toHaveBeenCalled();
});

test('owner plus occurrence identity prevents merging same-id records from two agents', () => {
  expect(mergeByRecordId([pending('same', 'acs-a'), pending('same', 'acs-b')], [])).toHaveLength(2);
});

test('a legacy pending delete is preserved for conversion and never sent as a physical deletion', async () => {
  mockRows = [{ ...pending('legacy'), syncAction: 'delete' }];
  mockCloud.set(`registros/${auth.currentUser.uid}/itens/legacy`,{recordId:'legacy',uid:auth.currentUser.uid,createdAt:'2025-01-01T10:00:00Z'});
  await syncPendingRegistros();
  expect(mockRows[0].status).toBe('failed');
  expect(mergeByRecordId([], mockRows)).toHaveLength(1);
  expect(deleteDoc).not.toHaveBeenCalled();
  await excluirRegistro(toRecordView(mockRows[0]), 'Cancelamento de exclusão antiga');
  await syncPendingRegistros();
  expect(mockCloud.get(`registros/${auth.currentUser.uid}/itens/legacy`).lifecycleStatus).toBe('cancelled');
});

test('editing a legacy server document does not invent a first-receipt date or replace its creation date', async () => {
  mockRows = [{...pending('legacy-date'),hasServerCopy:true}];
  const path = `registros/${auth.currentUser.uid}/itens/legacy-date`;
  mockCloud.set(path, { recordId: 'legacy-date', uid: auth.currentUser.uid, createdAt: '2025-01-01T10:00:00Z' });
  await syncPendingRegistros();
  expect(mockCloud.get(path).createdAt).toBe('2025-01-01T10:00:00Z');
  expect(mockCloud.get(path).serverReceivedAt).toBeUndefined();
});

test('reviewing a cross-device conflict can reapply local edits or accept remote while archiving the full local copy',async()=>{
  mockRows=[pending('conflict')];await syncPendingRegistros();
  const original=toRecordView(mockRows[0]);
  await updateRecordInStorage({...original,city:'Versão local'});
  const path=`registros/${auth.currentUser.uid}/itens/conflict`;
  mockCloud.set(path,{...mockCloud.get(path),serverRevision:2,lastMutationId:'phone-b',municipio:'Versão remota'});
  await syncPendingRegistros();
  expect(mockRows[0].syncConflict.serverRecord.municipio).toBe('Versão remota');
  expect(mockCloud.get(path).municipio).toBe('Versão remota');
  await updateRecordInStorage(toRecordView(mockRows[0]));await syncPendingRegistros();
  expect(mockCloud.get(path)).toMatchObject({municipio:'Versão local',serverRevision:3});
  await updateRecordInStorage({...toRecordView(mockRows[0]),city:'Outra edição local'});
  mockCloud.set(path,{...mockCloud.get(path),serverRevision:4,lastMutationId:'phone-c',municipio:'Nova versão remota'});
  await syncPendingRegistros();await acceptRemoteRecordVersion(toRecordView(mockRows[0]));
  expect(mockRows[0]).toMatchObject({status:'synced',municipio:'Nova versão remota',baseServerRevision:4});
  expect(mockRows[0].conflictArchive[0].record.municipio).toBe('Outra edição local');
});

test('local photographs remain available after cloud refresh without uploading base64',()=>{
  const cloud={...pending('photo'),_origin:'cloud',status:'synced',municipio:'Servidor atualizado'};
  const local={...cloud,photoPolicyVersion:1,hasLocalPhoto:true,photoUriLocal:'file:///local.jpg',photoBase64:'LOCAL_ONLY',photoMime:'image/jpeg'};
  const merged=toRecordView(mergeByRecordId([cloud],[local])[0]);
  expect(merged.city).toBe('Servidor atualizado');expect(merged.photo.uri).toBe('file:///local.jpg');
  expect(toRecordView(mergeByRecordId([{...cloud,photoBase64:'LEGACY'}],[{...local,photoHidden:true}])[0]).photo).toBeNull();
});
