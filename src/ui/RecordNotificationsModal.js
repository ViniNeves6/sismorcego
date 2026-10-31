import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Easing, StyleSheet } from 'react-native';
import { Animated, Pressable, ScrollView, Text, View } from './AccessibleNative';
import { BellIcon } from './SismorcegoIcons';
import useReduceMotion from './useReduceMotion';
import useFadeCompositing from './useFadeCompositing';
import useSpeakOnMount from '../hooks/useSpeakOnMount';
import { describeRecords } from '../services/accessibilityDescriptions';

const STATUS_LABELS = { pending: 'Aguardando envio', syncing: 'Enviando', failed: 'Falha no envio' };

export default function RecordNotificationsModal({ visible, records = [], onClose, onSelectRecord, reduceMotion = false }) {
  const systemReduceMotion = useReduceMotion();
  const skipMotion = reduceMotion || systemReduceMotion;
  const [rendered, setRendered] = useState(visible);
  const progress = useRef(new Animated.Value(0)).current;
  const compositing = useFadeCompositing(progress, visible ? 1 : 0, skipMotion);
  const selection = useRef(null);
  const selectCallback = useRef(onSelectRecord);
  selectCallback.current = onSelectRecord;
  const pendingRecords = records.filter(record => record.status !== 'synced');

  useLayoutEffect(() => {
    if (visible) { selection.current = null; setRendered(true); }
  }, [visible]);

  useEffect(() => {
    if (!rendered) return;
    const finishExit = () => {
      setRendered(false);
      const record = selection.current;
      selection.current = null;
      if (record) selectCallback.current?.(record);
    };
    if (skipMotion) {
      progress.setValue(visible ? 1 : 0);
      if (!visible) finishExit();
      return;
    }
    let cancelled = false;
    const animation = Animated.timing(progress, {
      toValue: visible ? 1 : 0, duration: visible ? 220 : 180,
      easing: Easing.out(Easing.cubic), useNativeDriver: true,
    });
    animation.start(({ finished }) => { if (finished && !cancelled && !visible) finishExit(); });
    return () => { cancelled = true; animation.stop(); };
  }, [visible, rendered, skipMotion, progress]);

  useSpeakOnMount(describeRecords(pendingRecords, 'Notificações. Registros aguardando envio'), { active: visible, priority: 30 });
  if (!rendered) return null;
  return (
    <Animated.View
      {...compositing}
      style={[styles.overlay, { opacity: progress }]}
      pointerEvents={visible ? 'auto' : 'none'}
      accessibilityViewIsModal
      accessibilityElementsHidden={!visible}
      importantForAccessibility={visible ? 'auto' : 'no-hide-descendants'}
      onAccessibilityEscape={onClose}
    >
      <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Fechar notificações" />
      <Animated.View style={[styles.dialog, { transform: [
        { translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [14, 0] }) },
        { scale: progress.interpolate({ inputRange: [0, 1], outputRange: [0.98, 1] }) },
      ] }]}>
        <View style={styles.header}>
          <View style={styles.iconBadge}><BellIcon size={23} /></View>
          <Text style={styles.title} accessibilityRole="header">Notificações</Text>
        </View>
        <Text style={styles.summary}>{pendingRecords.length
          ? `${pendingRecords.length} ${pendingRecords.length === 1 ? 'registro aguardando envio' : 'registros aguardando envio'}.`
          : 'Nenhum registro aguardando envio.'}</Text>
        <ScrollView style={styles.list} contentContainerStyle={styles.listContent} showsVerticalScrollIndicator={false}>
          {pendingRecords.length ? pendingRecords.map(record => (
            <Pressable
              key={record.id}
              accessibilityRole="button"
              accessibilityLabel={`Abrir registro ${record.title || 'Registro'} de ${record.city || 'município não informado'}`}
              onPress={() => { selection.current = record; onClose(); }}
              style={({ pressed }) => [styles.item, pressed && styles.itemPressed]}
            >
              <Text style={styles.itemTitle}>{record.title || 'Registro'}</Text>
              <View style={styles.meta}>
                <Text style={styles.city}>{record.city || 'Município não informado'}</Text>
                <Text style={styles.date}>{record.date || 'Data não informada'}</Text>
                <View style={styles.statusBadge}><Text style={styles.status}>{record.statusLabel || STATUS_LABELS[record.status] || 'Aguardando envio'}</Text></View>
              </View>
            </Pressable>
          )) : <View style={styles.empty}><Text style={styles.summary}>Não há notificações pendentes no momento.</Text></View>}
        </ScrollView>
        <Pressable onPress={onClose} accessibilityRole="button" style={({ pressed }) => [styles.closeButton, pressed && { opacity: 0.85 }]}>
          <Text style={styles.closeText}>Fechar</Text>
        </Pressable>
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  overlay: { ...StyleSheet.absoluteFillObject, zIndex: 170, backgroundColor: 'rgba(28, 13, 54, 0.56)', alignItems: 'center', justifyContent: 'center', padding: 20 },
  dialog: { width: '100%', maxWidth: 342, backgroundColor: '#FFFFFF', borderRadius: 22, padding: 22, elevation: 18, shadowColor: '#181126', shadowOffset: { width: 0, height: 22 }, shadowOpacity: 0.3, shadowRadius: 28 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 14 },
  iconBadge: { width: 44, height: 44, borderRadius: 12, backgroundColor: '#F6F3FF', alignItems: 'center', justifyContent: 'center' },
  title: { flex: 1, fontSize: 18, fontFamily: 'PlusJakartaSans-ExtraBold', color: '#181126', includeFontPadding: false },
  summary: { fontSize: 13, lineHeight: 20, fontFamily: 'PlusJakartaSans-Medium', color: '#5E5473' },
  list: { maxHeight: 290, marginTop: 12 },
  listContent: { gap: 8 },
  item: { padding: 12, borderWidth: 1, borderColor: '#DFD2FA', borderRadius: 12, backgroundColor: '#F6F3FF' },
  itemPressed: { backgroundColor: '#EFE9FE', borderColor: '#7B39E8' },
  itemTitle: { fontSize: 13, fontFamily: 'PlusJakartaSans-ExtraBold', color: '#181126', includeFontPadding: false },
  meta: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', columnGap: 10, rowGap: 5, marginTop: 6 },
  city: { maxWidth: '100%', fontSize: 11, fontFamily: 'PlusJakartaSans-ExtraBold', color: '#181126', includeFontPadding: false },
  date: { fontSize: 11, fontFamily: 'PlusJakartaSans-SemiBold', color: '#796E92', includeFontPadding: false },
  statusBadge: { paddingVertical: 2, paddingHorizontal: 7, borderRadius: 8, backgroundColor: '#FFF8E6' },
  status: { fontSize: 10, fontFamily: 'PlusJakartaSans-ExtraBold', color: '#B45309', includeFontPadding: false },
  empty: { padding: 12, borderRadius: 12, backgroundColor: '#F6F3FF' },
  closeButton: { minHeight: 46, marginTop: 18, borderRadius: 12, backgroundColor: '#6824D6', alignItems: 'center', justifyContent: 'center' },
  closeText: { fontSize: 14, color: '#FFFFFF', fontFamily: 'PlusJakartaSans-Bold', includeFontPadding: false },
});
