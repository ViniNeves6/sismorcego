import { VICTIM_FORMS, validateVictimFields, getFilledVictimDetailItems } from '../src/services/sismorcegoData';
jest.mock('../src/services/redesignData', () => ({}));
test('every form ends with the optional local da agressão', () => {
  for (const [type, form] of Object.entries(VICTIM_FORMS)) {
    const last = form.groups.at(-1);
    expect(last.title).toBe('Local da agressão');
    expect(last.fields[0]).toMatchObject({ required: false, type: 'text' });
    expect(Object.keys(validateVictimFields(type, {}).errors)).not.toContain(last.fields[0].key);
    expect(getFilledVictimDetailItems(type, { [last.fields[0].key]: 'Rio Guamá' })).toContainEqual(expect.objectContaining({ value: 'Rio Guamá' }));
  }
});
