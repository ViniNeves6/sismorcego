import { canonicalEditValue, hasProfileChanges, hasRecordEditChanges } from '../src/services/editChanges';

test('profile ignores only whitespace, name normalization and email case', () => {
  const initial = { username: 'André Lima', email: 'ana@example.test' };
  expect(hasProfileChanges(initial, { username: ' André   Lima ', email: ' ANA@EXAMPLE.TEST ' })).toBe(false);
  expect(hasProfileChanges(initial, { ...initial, username: 'André Neves' })).toBe(true);
  expect(hasProfileChanges(initial, { ...initial, email: 'other@example.test' })).toBe(true);
  expect(hasProfileChanges(initial, { ...initial, photoUri: 'file:///new.jpg' })).toBe(true);
});

test('record equivalence ignores ordering, empty optionals and display dates but keeps real values', () => {
  const record = { victimKey: 'aves', city: 'Belém', date: '20/10/2026', details: { species: 'Pato', campaigns: false, amount: 0 } };
  const same = { ...record, city: ' Belém ', isoDate: '2026-10-20', details: { amount: 0, optional: '', campaigns: false, species: 'Pato' } };
  expect(hasRecordEditChanges(record, same)).toBe(false);
  expect(hasRecordEditChanges(record, { ...same, details: { ...same.details, campaigns: true } })).toBe(true);
  expect(hasRecordEditChanges(record, { ...same, details: { ...same.details, amount: 1 } })).toBe(true);
  expect(hasRecordEditChanges(record, { ...same, isoDate: '2026-10-21' })).toBe(true);
  expect(hasRecordEditChanges(record, { ...same, photo: { uri: 'file:///new.jpg' } })).toBe(true);
  expect(canonicalEditValue({ text: 'Linha 1\nLinha 2' })).toEqual({ text: 'Linha 1\nLinha 2' });
});
