import { toRecordView, toStoredRecord } from '../src/services/registroAdapter';

const view = (victimKey, details) => ({
  id: 'r1', victimKey, reporter: 'Ana Lima', city: 'Belém', community: 'Centro', isoDate: '2026-10-20', details,
});

test.each([
  ['humano', { 'hv-nome': 'Maria', 'hv-idade': '28', 'hv-sexo': 'Feminino', 'hv-circ': 'Na praia', 'hv-atend': 'Não', 'hv-atend-motivo': 'Distância' },
    { nomeAgredido: 'Maria', idade: 28, sexo: 'F', circunstancia: 'praia', buscouAtendimento: 'nao', naoBuscouMotivo: 'distancia' }],
  ['canino', { 'cf-especie': 'Canina', 'cf-vac': 'Não', 'cf-vac-motivo': 'Não sabe / não lembra' },
    { especie: 'canina', participouVacinacao: 'nao', naoParticipouMotivo: 'nao_sabe' }],
  ['aves', { 'av-especie': 'Galinha', 'av-circ': 'No galinheiro', 'av-aviso': 'Sim' },
    { especie: 'galinha', circunstancia: 'no_galinheiro', avisouAdeparaOuMunicipio: 'sim' }],
  ['producao', { 'pr-especie': 'Suíno', 'pr-circ': 'Solto no pasto', 'pr-vac': 'Não sabe / não lembra' },
    { especie: 'suino', circunstancia: 'solto_pasto', participouVacinacao: 'nao_sabe' }],
])('round-trips %s without changing database enum codes', (type, details, expected) => {
  const stored = toStoredRecord(view(type, details), 'owner');
  expect(stored.detalhes).toMatchObject(expected);
  expect(stored.uid).toBe('owner');
  expect(stored.tipoVitima).toBe(type === 'canino' ? 'caninoFelino' : type);
  expect(toRecordView(stored).details).toMatchObject(details);
});

test('reads old flat human records and preserves additional existing fields when editing', () => {
  const old = { recordId: 'old', uid: 'owner', nomeAgredido: 'Maria', sexo: 1, municipio: 'Belém', dataAgressao: '20/10/2026', detalhes: undefined, tratamento: ['vacina'] };
  const current = toRecordView(old);
  expect(current.details['hv-nome']).toBe('Maria');
  expect(current.details['hv-sexo']).toBe('Masculino');
  expect(current.isoDate).toBe('2026-10-20');
  const saved = toStoredRecord({ ...current, city: 'Ananindeua' }, 'owner');
  expect(saved.tratamento).toEqual(['vacina']);
  expect(saved.detalhes.nomeAgredido).toBe('Maria');
});

test('preserves photo bytes, local file and real GPS metadata, then actually removes cleared attachments', () => {
  const record = view('aves', {});
  record.gps = { lat: -1.4, lng: -48.4, accuracy: 120, isHighAccuracy: false, source: 'gps_coarse' };
  record.photo = { localUri: 'file:///photo.jpg', base64: 'AAAA', mime: 'image/jpeg', sizeBytes: 3 };
  const stored = toStoredRecord(record, 'owner');
  expect(stored.location.source).toBe('gps_coarse');
  expect(stored.photoBase64).toBe('AAAA');
  const next = toStoredRecord({ ...toRecordView(stored), gps: null, photo: null }, 'owner');
  expect(next.location).toBeNull();
  expect(next.photoBase64).toBeNull();
  expect(next.photoLocalUri).toBeNull();
});

test('invalid coordinates are rejected before storage and cannot be displayed as a map', () => {
  const record = { ...view('aves', {}), gps: { lat: 91, lng: -48 } };
  expect(() => toStoredRecord(record, 'owner')).toThrow('Coordenadas GPS inválidas');
  expect(toRecordView({ recordId: 'invalid', location: { latitude: 91, longitude: -48 } }).gps).toBeNull();
});
