import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppState } from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import useAuth from './useAuth';
import { db } from '../services/firebase';
import { LOCAL_TEST_MODE } from '../services/debugTestSession';
import { canAccessCoordinatorArea } from '../services/roleAccess';
import { createAlertRecordResolver } from '../services/coordinatorAlerts';
import { buildOccurrenceInbox, subscribeOccurrenceInbox, writeOccurrenceReadState } from '../services/coordinatorInbox';

const empty = () => ({ owner:null, records:[], readStates:[], legacy:[], ready:false, error:'' });
export default function useCoordinatorAlerts(records, { enabled: dataEnabled = true } = {}) {
  const { user, role } = useAuth();
  const uid = user?.uid;
  const enabled = Boolean(dataEnabled && uid && canAccessCoordinatorArea(role) && !LOCAL_TEST_MODE && db);
  const current = useRef();
  current.current = enabled ? uid : null;
  const [feed,setFeed] = useState(empty);
  const [retry,setRetry] = useState(0);
  const [appActive,setAppActive] = useState(AppState.currentState !== 'background' && AppState.currentState !== 'inactive');
  const resolver = useMemo(() => enabled && uid ? createAlertRecordResolver() : null,[uid,enabled]);
  useEffect(() => { const listener = AppState.addEventListener('change',value => setAppActive(value === 'active')); return () => listener.remove(); },[]);
  useEffect(() => {
    if (!enabled || !appActive) return;
    let active = true;
    setFeed(previous => ({ ...(previous.owner === uid ? previous : empty()), owner:uid, ready:false, error:'' }));
    const stop = subscribeOccurrenceInbox(db,uid,value => {
      if (active) setFeed(previous => ({ ...value, owner:uid, error:previous.error || '' }));
    },() => { if (active) setFeed(previous => ({ ...previous, error:'Não foi possível carregar os alertas. Verifique sua conexão e tente novamente.' })); });
    return () => { active = false; stop(); };
  },[enabled,uid,retry,appActive]);
  const own = enabled && feed.owner === uid;
  const liveRecords = own && feed.ready ? feed.records : null;
  const alerts = useMemo(() => own ? buildOccurrenceInbox(uid,feed.records,feed.readStates,feed.legacy) : [],[own,uid,feed]);
  const assertAccess = useCallback(() => {
    if (!enabled || current.current !== uid) throw new Error('Acesso restrito ao coordenador.');
  },[enabled,uid]);
  const resolveRecord = useCallback(async item => {
    assertAccess();
    const record = await resolver(item,liveRecords || records,{ fresh:true });
    assertAccess();
    if (!record) throw new Error('Esta ocorrência foi excluída ou não está mais disponível.');
    return record;
  },[assertAccess,resolver,liveRecords,records]);
  const setRead = useCallback(async (item,read) => {
    assertAccess();
    if (!alerts.some(a => a.id === item?.id)) throw new Error('Alerta não encontrado nesta conta.');
    const network = await NetInfo.fetch();
    if (!network.isConnected || network.isInternetReachable === false) throw new Error('Conecte-se à internet para salvar a leitura do alerta.');
    assertAccess();
    await writeOccurrenceReadState(db,uid,item,read);
    assertAccess();
    setFeed(previous => item.source === 'legacy' ? { ...previous,legacy:previous.legacy.map(a => a.id === item.legacyId ? {...a,lida:!!read}:a) } :
      { ...previous, readStates:[...previous.readStates.filter(s => !(s.uidAcs === item.uidAcs && s.registroId === item.registroId)),
        { uidAcs:item.uidAcs, registroId:item.registroId, lida:!!read }] });
  },[assertAccess,alerts,uid]);
  const markRead = useCallback(item => setRead(item,true),[setRead]);
  const markUnread = useCallback(item => setRead(item,false),[setRead]);
  const markAllRead = useCallback(async () => {
    assertAccess();
    const unread = alerts.filter(item => !item.lida);
    // Sequencial para evitar rajadas de escrita nesta fase Spark.
    for (const item of unread) await setRead(item,true);
    return unread.length;
  },[assertAccess,alerts,setRead]);
  return { alerts, liveRecords, loading:enabled && (!own || !feed.ready) && !(own && feed.error),
    error:own ? feed.error : '', unreadCount:alerts.filter(a => !a.lida).length,
    resolveRecord, markRead, markUnread, markAllRead, reload:() => setRetry(value => value+1) };
}
