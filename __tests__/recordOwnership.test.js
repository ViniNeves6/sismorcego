import { assertRecordOwner, canModifyRecord, isRecordOwner } from '../src/services/recordLifecycle';

const record = { id: 'case', uid: 'original', reporter: 'Mesmo nome', _raw: { recordId: 'case', uid: 'original' } };
test('ownership uses original UID and identity, independently from the displayed responsible name',()=>{
  expect(isRecordOwner(record,'original')).toBe(true);
  expect(isRecordOwner({...record,reporter:'Outro nome'},'original')).toBe(true);
  expect(isRecordOwner(record,'another')).toBe(false);
  expect(isRecordOwner(record,null)).toBe(false);
});
test.each([
  {uid:'another'}, {id:'other-case'}, {recordId:'other-case'},
  {_raw:{recordId:'case',uid:'another'}},
])('contradictory original metadata cannot grant ownership: %j',patch=>{
  expect(isRecordOwner({...record,...patch},'original')).toBe(false);
  expect(()=>assertRecordOwner({...record,...patch},'original')).toThrow();
});
test('cancelled raw metadata and a cancelled server conflict cannot be masked by an active view',()=>{
  expect(canModifyRecord(record,'original')).toBe(true);
  expect(canModifyRecord({...record,lifecycleStatus:'active',_raw:{...record._raw,lifecycleStatus:'cancelled'}},'original')).toBe(false);
  expect(canModifyRecord({...record,_raw:{...record._raw,syncConflict:{serverRecord:{lifecycleStatus:'cancelled'}}}},'original')).toBe(false);
});
