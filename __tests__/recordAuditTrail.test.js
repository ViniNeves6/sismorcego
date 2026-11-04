import React from 'react';
import TestRenderer,{act} from 'react-test-renderer';
import {Text} from 'react-native';
import RecordAuditTrail from '../src/ui/RecordAuditTrail';
import {loadRecordAudit} from '../src/services/recordAudit';
jest.mock('../src/services/recordAudit',()=>({loadRecordAudit:jest.fn()}));
jest.mock('../src/ui/AccessibleNative',()=>{
  const {Text:NativeText,View,Pressable}=require('react-native');return {Text:NativeText,View,Pressable};
});
let tree;
const first={uid:'owner',id:'one'},second={uid:'other',id:'two'};
const text=()=>tree.root.findAllByType(Text).map(node=>node.props.children).map(value=>Array.isArray(value)?value.join(''):value);
const press=async()=>act(async()=>tree.root.findAll(node=>node.props.onPress)[0].props.onPress());
afterEach(async()=>{if(tree)await act(async()=>tree.unmount());tree=null;jest.clearAllMocks();});
test('audit renders actor UID, version and prior/next values, and offers older pages',async()=>{
  loadRecordAudit.mockResolvedValueOnce({events:[{id:'edit',action:'edit',actorUid:'owner',revision:2,clientAt:'2026-10-29',before:{municipio:'Belém'},after:{municipio:'Curuçá'}}],hasMore:true,cursor:'older'});
  await act(async()=>{tree=TestRenderer.create(<RecordAuditTrail record={first}/>);});
  await press();
  expect(text()).toContain('Edição · Versão 2');expect(text()).toContain('Autor: owner');expect(text()).toContain('Município: Belém → Curuçá');
  expect(text()).toContain('Carregar anteriores');
  loadRecordAudit.mockResolvedValueOnce({events:[{id:'create',action:'create',actorUid:'owner',revision:1}],hasMore:false});
  await press();expect(loadRecordAudit).toHaveBeenLastCalledWith(first,{cursor:'older'});
  expect(text()).toContain('Criação · Versão 1');expect(text()).toContain('Edição · Versão 2');
});
test('an old asynchronous audit response cannot appear after changing to another record',async()=>{
  let resolve;
  loadRecordAudit.mockReturnValue(new Promise(done=>{resolve=done;}));
  await act(async()=>{tree=TestRenderer.create(<RecordAuditTrail record={first}/>);});
  let request;
  await act(async()=>{request=tree.root.findAll(node=>node.props.onPress)[0].props.onPress();});
  await act(async()=>tree.update(<RecordAuditTrail record={second}/>));
  await act(async()=>{resolve({events:[{id:'private',actorUid:'private-owner',action:'edit',revision:1}]});await request;});
  expect(text()).not.toContain('Autor: private-owner');expect(text()).toContain('Consultar histórico');
});
