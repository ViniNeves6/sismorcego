import React from 'react';
import TestRenderer,{act} from 'react-test-renderer';
import { getDoc } from 'firebase/firestore';
import NetInfo from '@react-native-community/netinfo';
import useAuth from '../src/hooks/useAuth';
import useCoordinatorAlerts from '../src/hooks/useCoordinatorAlerts';
import * as debug from '../src/services/debugTestSession';
import { subscribeOccurrenceInbox,writeOccurrenceReadState,buildOccurrenceInbox } from '../src/services/coordinatorInbox';
import { createAlertRecordResolver,toCoordinatorAlert } from '../src/services/coordinatorAlerts';
import { toRecordView } from '../src/services/registroAdapter';

jest.mock('../src/hooks/useAuth',()=>jest.fn());
jest.mock('../src/services/debugTestSession',()=>({__esModule:true,LOCAL_TEST_MODE:false}));
jest.mock('../src/services/firebase',()=>({db:{}}));
jest.mock('@react-native-community/netinfo',()=>({fetch:jest.fn()}));
jest.mock('firebase/firestore',()=>({doc:jest.fn((_,...path)=>({path:path.join('/')})),getDoc:jest.fn()}));
jest.mock('../src/services/coordinatorInbox',()=>({...jest.requireActual('../src/services/coordinatorInbox'),
  subscribeOccurrenceInbox:jest.fn(()=>jest.fn()),writeOccurrenceReadState:jest.fn().mockResolvedValue()}));
const raw={uid:'acs-a',recordId:'r1',tipoVitima:'humano',nomeAcs:'Agente real',municipio:'Curuçá',localidade:'Vila real',
  createdAt:'2026-10-28T14:30:00Z',dataAgressao:'2026-10-27',detalhes:{nomeAgredido:'Pessoa fictícia',circunstancia:'em_casa_dormindo'},
  location:{latitude:-1.4,longitude:-48.4,accuracy:8},photoBase64:'AAAA',photoMime:'image/jpeg',_origin:'cloud'};
const record=()=>toRecordView(raw);
let tree,state,session;
function Probe(){state=useCoordinatorAlerts([]);return null;}
const mount=async()=>act(async()=>{tree=TestRenderer.create(<Probe/>);});
const update=async()=>act(async()=>tree.update(<Probe/>));
const emit=async(records=[record()],readStates=[],legacy=[])=>act(async()=>subscribeOccurrenceInbox.mock.calls.at(-1)[2]({records,readStates,legacy,ready:true}));
beforeEach(()=>{
  jest.clearAllMocks();session={user:{uid:'coord'},role:'coordenador'};useAuth.mockImplementation(()=>session);debug.LOCAL_TEST_MODE=false;
  NetInfo.fetch.mockResolvedValue({isConnected:true});
  getDoc.mockResolvedValue({exists:()=>true,data:()=>raw,id:'r1'});
  writeOccurrenceReadState.mockReset().mockResolvedValue();
});
afterEach(async()=>{if(tree)await act(async()=>tree.unmount());tree=null;});

test('five occurrences produce five distinct alerts; edits, cancellation and legacy duplicates retain identities',()=>{
  const records=Array.from({length:5},(_,i)=>toRecordView({...raw,recordId:`r${i}`}));
  const first=buildOccurrenceInbox('coord',records);
  const next=buildOccurrenceInbox('coord',records.map(r=>({...r,city:'Corrigida',lifecycleStatus:'cancelled'})),[],[{id:'old',uidAcs:'acs-a',registroId:'r1',lida:true}]);
  expect(first).toHaveLength(5);expect(new Set(first.map(a=>a.id)).size).toBe(5);
  expect(next.map(a=>a.id)).toEqual(first.map(a=>a.id));
  expect(next.find(a=>a.registroId==='r1').lida).toBe(true);
  expect(buildOccurrenceInbox('coord2',records).every(a=>!a.lida)).toBe(true);
});
test('missing historical occurrence keeps its actual legacy alert instead of disappearing',()=>{
  const inbox=buildOccurrenceInbox('coord',[],[],[{id:'old',uidAcs:'acs-a',registroId:'gone',municipio:'Município real',lida:true}]);
  expect(inbox).toEqual([expect.objectContaining({source:'legacy',city:'Município real',lida:true})]);
  expect(inbox[0].summary).toBe('');expect(inbox[0].date).toBe('');
});
test('actual record details/GPS/legacy photo are adapted without fabricated card content',async()=>{
  const resolver=createAlertRecordResolver();
  const resolved=await resolver({uidAcs:'acs-a',registroId:'r1'},[]);
  expect(getDoc).toHaveBeenCalledWith({path:'registros/acs-a/itens/r1'});
  expect(resolved).toMatchObject({id:'r1',uid:'acs-a',gps:{lat:-1.4,lng:-48.4},photo:{uri:'data:image/jpeg;base64,AAAA'}});
  expect(toCoordinatorAlert({},null)).toMatchObject({title:'',summary:'',date:'',reporter:''});
});
test('read/unread persists per coordinator and cannot report success on a rejected write',async()=>{
  await mount();await emit();expect(state.unreadCount).toBe(1);
  await act(async()=>state.markRead(state.alerts[0]));
  expect(writeOccurrenceReadState).toHaveBeenLastCalledWith({},'coord',expect.objectContaining({registroId:'r1'}),true);
  expect(state.unreadCount).toBe(0);
  await act(async()=>state.markUnread(state.alerts[0]));expect(state.unreadCount).toBe(1);
  writeOccurrenceReadState.mockRejectedValueOnce(new Error('Permissão negada'));
  await expect(state.markRead(state.alerts[0])).rejects.toThrow('Permissão');expect(state.unreadCount).toBe(1);
});
test('offline read action reports missing connection and preserves current read history',async()=>{
  await mount();await emit();NetInfo.fetch.mockResolvedValue({isConnected:false});
  await expect(state.markRead(state.alerts[0])).rejects.toThrow('Conecte-se');expect(writeOccurrenceReadState).not.toHaveBeenCalled();
});
test('opening refreshes an edited/cancelled record and never opens incomplete details',async()=>{
  await mount();await emit();getDoc.mockResolvedValueOnce({exists:()=>true,data:()=>({...raw,lifecycleStatus:'cancelled'}),id:'r1'});
  expect(await state.resolveRecord(state.alerts[0])).toMatchObject({lifecycleStatus:'cancelled'});
  getDoc.mockResolvedValueOnce({exists:()=>false});await expect(state.resolveRecord(state.alerts[0])).rejects.toThrow('excluída');
});
test.each(['acs',null,'unknown'])('role %s cannot subscribe, write state or resolve administrative cases',async role=>{
  session.role=role;await mount();expect(subscribeOccurrenceInbox).not.toHaveBeenCalled();expect(state.alerts).toEqual([]);
  await expect(state.markRead({})).rejects.toThrow('restrito');await expect(state.resolveRecord({})).rejects.toThrow('restrito');
});
test('test mode preserves the local session and never starts administrative cloud reads',async()=>{
  debug.LOCAL_TEST_MODE=true;await mount();expect(subscribeOccurrenceInbox).not.toHaveBeenCalled();expect(state.loading).toBe(false);
});
test('loss of role or account stops listeners, clears data and invalidates retained callbacks',async()=>{
  await mount();await emit();const old=state.markRead,stop=subscribeOccurrenceInbox.mock.results[0].value;
  session={user:{uid:'other-coord'},role:'coordenador'};await update();expect(stop).toHaveBeenCalled();expect(state.alerts).toEqual([]);
  await expect(old({})).rejects.toThrow('restrito');await emit();expect(state.alerts[0].recipientUid).toBe('other-coord');
  session.role='acs';await update();expect(state.alerts).toEqual([]);
});
test('mark all writes each unread occurrence once and retry reconnects after a listener error',async()=>{
  await mount();await emit([record(),toRecordView({...raw,recordId:'r2'})]);
  await act(async()=>{expect(await state.markAllRead()).toBe(2);});expect(writeOccurrenceReadState).toHaveBeenCalledTimes(2);
  await act(async()=>subscribeOccurrenceInbox.mock.calls.at(-1)[3](new Error('error')));expect(state.error).toContain('Não foi possível');
  await act(async()=>state.reload());expect(subscribeOccurrenceInbox).toHaveBeenCalledTimes(2);
});

test('refresh reconnects the real feed and remains loading until every source responds or an error arrives',async()=>{
  await mount();await emit();
  const stop=subscribeOccurrenceInbox.mock.results[0].value;
  expect(state.loading).toBe(false);
  await act(async()=>state.reload());
  expect(stop).toHaveBeenCalledTimes(1);
  expect(subscribeOccurrenceInbox).toHaveBeenCalledTimes(2);
  expect(state.loading).toBe(true);
  await act(async()=>subscribeOccurrenceInbox.mock.calls.at(-1)[2]({records:[record()],readStates:[],legacy:[],ready:false}));
  expect(state.loading).toBe(true);
  await emit();expect(state.loading).toBe(false);
  await act(async()=>state.reload());expect(state.loading).toBe(true);
  await act(async()=>subscribeOccurrenceInbox.mock.calls.at(-1)[3](new Error('offline')));
  expect(state.loading).toBe(false);expect(state.error).toContain('Não foi possível');
  await act(async()=>state.reload());
  expect(state.error).toBe('');expect(state.loading).toBe(true);
  await emit();expect(state.loading).toBe(false);
});
