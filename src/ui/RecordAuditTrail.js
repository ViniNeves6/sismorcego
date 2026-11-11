import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet } from 'react-native';
import { Pressable, Text, View } from './AccessibleNative';
import { loadRecordAudit } from '../services/recordAudit';
import { recordIdentity } from '../services/recordLifecycle';
import { parseRegistroDate } from '../services/registroDate';

const titles = { create: 'Criação', edit: 'Edição', cancel: 'Cancelamento' };
const fields = { municipio: 'Município', localidade: 'Localidade / Comunidade', tipoVitima: 'Espécie mordida',
  nomeAcs: 'Responsável original', nomeNotificador: 'Responsável original', dataAgressao: 'Data da ocorrência',
  dataMordedura: 'Data da ocorrência', detalhes: 'Dados da espécie mordida', location: 'GPS', photo: 'Fotografia',
  lifecycleStatus: 'Situação', cancellation: 'Cancelamento', notificadorTipo: 'Tipo de notificador' };
const display = value => value == null || value === '' ? 'Não informado' : typeof value === 'boolean' ? (value ? 'Sim' : 'Não')
  : typeof value === 'object' ? Object.entries(value).map(([key, item]) => `${key}: ${display(item)}`).join('; ') : String(value);
const changesFor = event => event.changes || Object.fromEntries(Object.keys(event.after || {}).filter(key =>
  JSON.stringify(event.before?.[key] ?? null) !== JSON.stringify(event.after[key] ?? null))
  .map(key => [key, { before: event.before?.[key], after: event.after[key] }]));

export default function RecordAuditTrail({ record }) {
  const [state, setState] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const generation = useRef(0);
  const identity = recordIdentity(record);
  useEffect(() => {
    generation.current += 1; setState(null); setError(''); setBusy(false);
    return () => { generation.current += 1; };
  }, [identity]);
  const load = async more => {
    if (busy) return;
    const request = generation.current;
    setBusy(true); setError('');
    try {
      const result = await loadRecordAudit(record, { cursor: more ? state?.cursor : null });
      if (request === generation.current) setState(previous => ({ ...result, events: more ? [...previous.events, ...result.events] : result.events }));
    } catch (failure) { if (request === generation.current) setError(failure.message || 'Não foi possível consultar o histórico.'); }
    finally { if (request === generation.current) setBusy(false); }
  };
  return <View style={styles.section}>
    <Text style={styles.heading} accessibilityRole="header">Histórico de alterações</Text>
    {state?.offline && <Text style={styles.muted}>Histórico disponível neste aparelho. Conecte-se para atualizar as versões confirmadas.</Text>}
    {state?.events.map(event => <View key={event.id || event.mutationId} style={styles.event}>
      <Text style={styles.eventTitle}>{titles[event.action] || 'Alteração'} · {event.pending ? 'Pendente de sincronização' : `Versão ${event.revision}`}</Text>
      <Text style={styles.muted}>Autor: {event.actorUid}</Text>
      <Text style={styles.muted}>{(parseRegistroDate(event.receivedAt) || parseRegistroDate(event.clientAt))?.toLocaleString('pt-BR') || 'Data não informada'}</Text>
      {event.pending && <Text style={styles.muted}>Revisão local: {event.localRevision || event.id}</Text>}
      {Object.entries(changesFor(event)).map(([key, change]) => <Text key={key} style={styles.change}>
        {fields[key] || key}: {display(change.before)} → {display(change.after)}
      </Text>)}
      {event.reason && <Text style={styles.change}>Justificativa: {event.reason}</Text>}
    </View>)}
    {state && !state.events.length && <Text style={styles.muted}>Sem alterações registradas. Ocorrências antigas podem não ter histórico anterior à auditoria.</Text>}
    {!!error && <Text style={styles.error}>{error}</Text>}
    {busy ? <ActivityIndicator color="#6824D6" accessibilityLabel="Carregando histórico" /> : <Pressable
      style={styles.button} accessibilityRole="button" onPress={() => load(Boolean(state?.hasMore))}>
      <Text style={styles.buttonText}>{state?.hasMore ? 'Carregar anteriores' : state ? 'Atualizar histórico' : 'Consultar histórico'}</Text>
    </Pressable>}
  </View>;
}
const styles = StyleSheet.create({
  section: { marginTop: 20, gap: 10 },
  heading: { fontSize: 13, fontWeight: '800', color: '#181126' },
  event: { padding: 12, borderRadius: 12, backgroundColor: '#F8F6FD', gap: 5 },
  eventTitle: { fontSize: 12, fontWeight: '700', color: '#5316B8' },
  muted: { fontSize: 11, lineHeight: 17, color: '#5E5473' },
  change: { fontSize: 11, lineHeight: 17, color: '#181126' },
  error: { fontSize: 12, lineHeight: 18, color: '#B45309' },
  button: { padding: 12, borderRadius: 10, alignItems: 'center', backgroundColor: '#F1EAFE' },
  buttonText: { fontSize: 12, fontWeight: '700', color: '#6824D6' },
});
