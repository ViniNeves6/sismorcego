import { Animated, Pressable, ScrollView, Text, TextInput, View } from '../../ui/AccessibleNative';
import LinearGradient from '../../ui/AccessibleLinearGradient';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Easing, RefreshControl, StyleSheet } from 'react-native';
import useAccessibility from '../../hooks/useAccessibility';
import useSpeakOnMount from '../../hooks/useSpeakOnMount';
import { describeRecords } from '../../services/accessibilityDescriptions';
import useSpotlightScroll from '../../ui/useSpotlightScroll';
import MainScreenHeader from '../../ui/MainScreenHeader';
import SyncNowButton from '../../ui/SyncNowButton';
import useReduceMotion from '../../ui/useReduceMotion';
import {
  ChevronDownIcon,
  HelpQuestionIcon,
  MapPinStandardIcon,
  SearchIcon,
  VictimIconByKey,
} from '../../ui/SismorcegoIcons';

function getInitials(name) {
  if (!name) return 'AG';
  const parts = String(name).trim().split(/\s+/).filter(Boolean);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + (parts[1]?.[0] || '')).toUpperCase();
}

const VICTIM_FILTER_OPTIONS = [
  { key: 'all', label: 'Todas' },
  { key: 'humano', label: 'Humano' },
  { key: 'canino', label: 'Canino / Felino' },
  { key: 'aves', label: 'Aves' },
  { key: 'producao', label: 'Animal de produção' },
];

const FILTERS = [
  { key: 'all', label: 'Todos' },
  { key: 'pending', label: 'Pendentes' },
  { key: 'synced', label: 'Enviados' },
];
const normalizeSearch = value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

function FilterPillButton({
  filterKey,
  label,
  count,
  active,
  onPress,
  reduceMotion,
}) {
  const { highContrast } = useAccessibility();
  const anim = useRef(new Animated.Value(active ? 1 : 0)).current;

  useEffect(() => {
    if (reduceMotion) {
      anim.setValue(active ? 1 : 0);
      return;
    }
    const animation = Animated.timing(anim, {
      toValue: active ? 1 : 0,
      duration: 450,
      easing: Easing.bezier(0.16, 1, 0.3, 1),
      useNativeDriver: false,
    });
    animation.start();
    return () => animation.stop();
  }, [active, reduceMotion, anim]);

  const flex = reduceMotion
    ? (active ? 1.35 : 1)
    : anim.interpolate({
        inputRange: [0, 1],
        outputRange: [1, 1.35],
      });

  const backgroundColor = highContrast ? (active ? '#FFD700' : '#08080C') : reduceMotion
    ? (active ? '#6824D6' : '#FFFFFF')
    : anim.interpolate({
        inputRange: [0, 1],
        outputRange: ['#FFFFFF', '#6824D6'],
      });

  const borderColor = highContrast ? '#FFD700' : reduceMotion
    ? (active ? '#6824D6' : '#EAE5F5')
    : anim.interpolate({
        inputRange: [0, 1],
        outputRange: ['#EAE5F5', '#6824D6'],
      });

  const textColor = active ? '#FFFFFF' : '#5E5473';

  return (
    <Animated.View
      style={[
        styles.filterPillWrapper,
        {
          flex,
          backgroundColor,
          borderColor,
          elevation: active ? 4 : 0,
          shadowColor: '#6824D6',
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: active ? 0.32 : 0,
          shadowRadius: 8,
        },
      ]}
    >
      <Pressable
        onPress={onPress}
        style={styles.filterPillPressable}
        accessibilityRole="button"
        accessibilityState={{ selected: active }}
      >
        <Text
          numberOfLines={1}
          style={[
            styles.filterPillText,
            { color: textColor },
            active && styles.filterPillTextActive,
          ]}
        >
          {label}
        </Text>
        <Animated.View
          style={[
            styles.countBadge,
            reduceMotion
              ? (active ? styles.countBadgeActive : styles.countBadgeInactive)
              : {
                  opacity: anim,
                  maxWidth: anim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0, 36],
                  }),
                  paddingHorizontal: anim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0, 8],
                  }),
                },
          ]}
        >
          <Text numberOfLines={1} style={styles.countBadgeText}>{count}</Text>
        </Animated.View>
      </Pressable>
    </Animated.View>
  );
}

export default function RegistrosScreen({
  records = [],
  onOpenHowTo,
  onSyncNow,
  onSelectRecord,
  loading,
  error,
  syncing,
  onRefresh,
  pendingOperations,
  guideRefs = {},
  guideScroll,
  isCoordenador = false,
  adminCityFilter = 'all',
  adminVictimFilter = 'all',
  onOpenAdminCityFilter,
  onOpenAdminVictimFilter,
  reduceMotion: reduceMotionProp,
}) {
  const guideScrollProps = useSpotlightScroll(guideScroll);
  const { fontScale } = useAccessibility();
  const systemReduceMotion = useReduceMotion();
  const reduceMotion = Boolean(reduceMotionProp || systemReduceMotion);
  const [filterStatus, setFilterStatus] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchFocused, setSearchFocused] = useState(false);

  const totalCount = records.length;
  const pendingCount = useMemo(
    () => pendingOperations ?? records.filter((r) => r.status !== 'synced').length,
    [records, pendingOperations],
  );

  const counts = useMemo(() => {
    const q = normalizeSearch(searchQuery.trim());
    const base = records.filter((r) => {
      if (isCoordenador && adminCityFilter !== 'all' && r.city !== adminCityFilter) {
        return false;
      }
      if (isCoordenador && adminVictimFilter !== 'all') {
        const vKey = r.victimKey || (r.tipoVitima === 'humano' ? 'humano' : r.tipoVitima);
        if (vKey !== adminVictimFilter) return false;
      }
      const haystack = normalizeSearch(`${r.city || ''} ${r.title || ''} ${
        r.community || ''
      } ${r.reporter || ''} ${Object.values(r.details || {}).join(' ')
      }`);
      return !q || haystack.includes(q);
    });

    const total = base.length;
    const pending = base.filter((r) => r.status !== 'synced').length;
    const synced = base.filter((r) => r.status === 'synced').length;

    return {
      all: total,
      pending,
      synced,
    };
  }, [records, searchQuery, isCoordenador, adminCityFilter, adminVictimFilter]);

  const filteredRecords = useMemo(() => {
    const q = normalizeSearch(searchQuery.trim());
    return records.filter((r) => {
      // Coordinator City Filter
      if (isCoordenador && adminCityFilter !== 'all' && r.city !== adminCityFilter) {
        return false;
      }
      // Coordinator Victim Filter
      if (isCoordenador && adminVictimFilter !== 'all') {
        const vKey = r.victimKey || (r.tipoVitima === 'humano' ? 'humano' : r.tipoVitima);
        if (vKey !== adminVictimFilter) return false;
      }

      const matchStatus = filterStatus === 'all' || (filterStatus === 'pending' ? r.status !== 'synced' : r.status === 'synced');
      const haystack = normalizeSearch(`${r.city || ''} ${r.title || ''} ${
        r.community || ''
      } ${r.reporter || ''} ${Object.values(r.details || {}).join(' ')
      }`);
      const matchQuery = !q || haystack.includes(q);
      return matchStatus && matchQuery;
    });
  }, [records, filterStatus, searchQuery, isCoordenador, adminCityFilter, adminVictimFilter]);

  const subtitleText =
    totalCount === 1
      ? '1 notificação no histórico'
      : `${totalCount} notificações no histórico`;

  const syncPendingText =
    pendingCount === 0
      ? 'Todos os registros estão sincronizados'
      : pendingCount === 1
      ? '1 alteração aguardando envio'
      : `${pendingCount} alterações aguardando envio`;

  useSpeakOnMount(describeRecords(filteredRecords, 'Registros. Consulte os itens e acompanhe a sincronização'));
  return (
    <View ref={guideRefs.recordsOverview} collapsable={false} style={styles.screen}>
      <MainScreenHeader title="Registros" subtitle={subtitleText}
        actionIcon={<HelpQuestionIcon size={26} color="#6824D6" />}
        actionLabel="Como usar o aplicativo" onActionPress={onOpenHowTo} />

      <ScrollView
        {...guideScrollProps}
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl refreshing={Boolean(loading)} onRefresh={onRefresh} colors={['#6824D6']} />}
      >
        {error ? <View style={styles.emptyCard}><Text style={styles.emptyCardText}>{error}</Text><Pressable onPress={onRefresh}><Text style={{ color: '#6824D6', marginTop: 8 }}>Tentar novamente</Text></Pressable></View> : null}
        {/* Sync Banner */}
        <View ref={guideRefs.syncBanner} collapsable={false} style={styles.syncBannerSpacing}>
          <LinearGradient
            colors={['#5316B8', '#7B39E8']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.syncBanner}
          >
            <View style={styles.syncTop}>
              <Text style={styles.syncTitle}>Armazenamento Offline Ativo</Text>
            </View>
            <Text style={styles.syncDesc}>{syncPendingText}</Text>

            <SyncNowButton
              onSyncNow={onSyncNow}
              syncing={syncing}
            />
          </LinearGradient>
        </View>

        {/* Search Box */}
        <View ref={guideRefs.recordsSearch} collapsable={false} style={styles.searchBox}>
          <View style={styles.searchIconWrap} pointerEvents="none">
            <SearchIcon size={18} color="#431682" />
          </View>
          <TextInput
            style={[
              styles.searchInput,
              searchFocused && styles.searchInputFocused,
            ]}
            value={searchQuery}
            onChangeText={setSearchQuery}
            onFocus={() => setSearchFocused(true)}
            onBlur={() => setSearchFocused(false)}
            placeholder="Buscar por município, espécie ou comunidade..."
            placeholderTextColor="#796E92"
          />
        </View>

        {/* Coordinator Filters */}
        {isCoordenador && (
          <View style={styles.adminRecordFilters}>
            <Pressable
              onPress={onOpenAdminCityFilter}
              style={[styles.adminSelectField, { flexBasis: 158 * Math.max(1, fontScale || 1) }]}
              accessibilityLabel="Filtrar por município"
            >
              <Text style={styles.adminSelectFieldText}>
                {`Município: ${adminCityFilter === 'all' ? 'Todos' : adminCityFilter}`}
              </Text>
              <ChevronDownIcon size={17} color="#5E5473" />
            </Pressable>
            <Pressable
              onPress={onOpenAdminVictimFilter}
              style={[styles.adminSelectField, { flexBasis: 158 * Math.max(1, fontScale || 1) }]}
              accessibilityLabel="Filtrar por espécie mordida"
            >
              <Text style={styles.adminSelectFieldText}>
                {`Espécie: ${adminVictimFilter === 'all' ? 'Todas' : (VICTIM_FILTER_OPTIONS.find((o) => o.key === adminVictimFilter)?.label || adminVictimFilter)}`}
              </Text>
              <ChevronDownIcon size={17} color="#5E5473" />
            </Pressable>
          </View>
        )}

        {/* Filter Pills */}
        <View ref={guideRefs.filterPills} collapsable={false} style={styles.filterRow}>
          {FILTERS.map((f) => {
            const active = f.key === filterStatus;
            return (
              <FilterPillButton
                key={f.key}
                filterKey={f.key}
                label={f.label}
                count={counts[f.key] ?? 0}
                active={active}
                onPress={() => setFilterStatus(f.key)}
                reduceMotion={reduceMotion}
              />
            );
          })}
        </View>

        {/* Records List */}
        {filteredRecords.length === 0 ? (
          <View ref={guideRefs.firstRecord} collapsable={false} style={styles.emptyCard}>
            <Text style={styles.emptyCardText}>
              {records.length === 0
                ? 'Nenhum registro salvo neste dispositivo.'
                : 'Nenhum registro corresponde à busca ou ao filtro.'}
            </Text>
          </View>
        ) : (
          filteredRecords.map((rec, recIdx) => {
            const isPending = rec.status !== 'synced';
            const victimKey = rec.victimKey || (
              String(rec.title || rec.tipoVitima || '').toLowerCase().includes('humano') ? 'humano' :
              String(rec.title || rec.tipoVitima || '').toLowerCase().includes('canino') || String(rec.title || rec.tipoVitima || '').toLowerCase().includes('felino') ? 'canino' :
              String(rec.title || rec.tipoVitima || '').toLowerCase().includes('ave') ? 'aves' :
              String(rec.title || rec.tipoVitima || '').toLowerCase().includes('produ') ? 'producao' : 'canino'
            );
            const agentName = rec.reporter || '';
            const statusLabel = rec.statusLabel || (isPending ? 'Pendente' : 'Sincronizado');

            return (
              <View
                key={`${filterStatus}-${rec.id}`}
                testID={`record-card-${rec.id}`}
              >
                <Pressable
                  ref={recIdx === 0 ? guideRefs.firstRecord : undefined}
                  collapsable={false}
                  onPress={() => onSelectRecord(rec)}
                  style={({ pressed }) => [
                    styles.recordCard,
                    pressed && styles.recordCardPressed,
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel={`Registro de ${rec.title || 'ocorrência'} em ${rec.city || ''}`}
                >
                  {/* Watermark in background */}
                  <View style={styles.watermark} aria-hidden={true} pointerEvents="none">
                    <VictimIconByKey
                      victimKey={victimKey}
                      size={150}
                      color="#6824D6"
                    />
                  </View>

                  {/* Top status & date row */}
                  <View style={styles.recordTop}>
                    <View style={[styles.syncBadge, isPending && styles.syncBadgePending]}>
                      <View style={[styles.syncDotHalo, isPending && styles.syncDotHaloPending]}>
                        <View style={[styles.syncDot, isPending && styles.syncDotPending]} />
                      </View>
                      <Text style={[styles.syncText, isPending && styles.syncTextPending]}>
                        {statusLabel}
                      </Text>
                    </View>
                    <Text style={styles.recordDate}>{rec.date || ''}</Text>
                  </View>

                  {/* Title & Location */}
                  <Text style={styles.recordTitle}>{rec.title || 'Ocorrência'}</Text>
                  <View style={styles.locRow}>
                    <MapPinStandardIcon size={14} color="#6B6480" strokeWidth={1.9} />
                    <Text style={styles.recordLoc}>
                      {`Município de ${rec.city || 'Não informado'}`}
                    </Text>
                  </View>

                  {/* Foot / Agent Section */}
                  <View style={styles.recordFoot}>
                    <View style={styles.agentAvatar} aria-hidden={true}>
                      <Text style={styles.agentAvatarText}>{getInitials(agentName)}</Text>
                    </View>
                    <View style={styles.agentInfo}>
                      <Text style={styles.agentLabel}>Agente</Text>
                      <Text style={styles.agentName}>{agentName || 'Não informado'}</Text>
                      <Text style={styles.hiddenA11yText}>{`Agente: ${agentName || 'Não informado'}`}</Text>
                    </View>
                  </View>
                </Pressable>
              </View>
            );
          })
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#F8F7FC',
  },
  scroll: {
    flex: 1,
  },
  content: {
    paddingTop: 16,
    paddingHorizontal: 20,
    paddingBottom: 104,
  },
  syncBannerSpacing: {
    marginBottom: 18,
  },
  syncBanner: {
    borderRadius: 20,
    padding: 18,
    overflow: 'hidden',
    elevation: 8,
    shadowColor: '#6824D6',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
  },
  syncTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  syncTitle: {
    fontSize: 15,
    fontFamily: 'PlusJakartaSans-ExtraBold',
    color: '#FFFFFF',
    letterSpacing: -0.2,
    includeFontPadding: false,
  },
  syncDesc: {
    fontSize: 13,
    lineHeight: 18.2,
    fontFamily: 'PlusJakartaSans-Medium',
    color: 'rgba(255, 255, 255, 0.88)',
    marginBottom: 14,
    includeFontPadding: false,
  },
  syncBtn: {
    width: '100%',
    paddingVertical: 11,
    paddingHorizontal: 14,
    backgroundColor: 'rgba(255, 255, 255, 0.16)',
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.34)',
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  syncBtnText: {
    fontSize: 13,
    fontFamily: 'PlusJakartaSans-Bold',
    color: '#FFFFFF',
    includeFontPadding: false,
  },
  searchBox: {
    position: 'relative',
    marginBottom: 12,
    justifyContent: 'center',
  },
  searchIconWrap: {
    position: 'absolute',
    left: 14,
    zIndex: 2,
  },
  searchInput: {
    width: '100%',
    height: 46,
    paddingLeft: 42,
    paddingRight: 14,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#431682',
    backgroundColor: '#FFFFFF',
    fontSize: 14,
    fontFamily: 'PlusJakartaSans-Medium',
    color: '#181126',
    includeFontPadding: false,
  },
  searchInputFocused: {
    borderColor: '#6824D6',
  },
  filterRow: {
    flexDirection: 'row',
    alignSelf: 'stretch',
    gap: 8,
    marginBottom: 16,
  },
  filterPillWrapper: {
    height: 42,
    borderRadius: 999,
    borderWidth: 1.5,
    overflow: 'hidden',
  },
  filterPillPressable: {
    flex: 1,
    height: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 6,
  },
  filterPillText: {
    fontSize: 13,
    fontFamily: 'PlusJakartaSans-Bold',
    color: '#5E5473',
    textAlign: 'center',
    includeFontPadding: false,
  },
  filterPillTextActive: {
    color: '#FFFFFF',
  },
  countBadge: {
    backgroundColor: 'rgba(255, 255, 255, 0.22)',
    borderRadius: 99,
    paddingVertical: 2,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  countBadgeActive: {
    opacity: 1,
    maxWidth: 36,
    paddingHorizontal: 8,
  },
  countBadgeInactive: {
    opacity: 0,
    maxWidth: 0,
    paddingHorizontal: 0,
  },
  countBadgeText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontFamily: 'PlusJakartaSans-ExtraBold',
    includeFontPadding: false,
  },
  emptyCard: {
    paddingVertical: 28,
    paddingHorizontal: 18,
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: '#DFD2FA',
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyCardText: {
    fontSize: 13.5,
    fontFamily: 'PlusJakartaSans-Bold',
    color: '#5E5473',
    textAlign: 'center',
    includeFontPadding: false,
  },
  recordCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#EAE5F5',
    padding: 20,
    marginBottom: 14,
    position: 'relative',
    overflow: 'hidden',
    shadowColor: '#1D1530',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 2,
  },
  recordCardPressed: {
    borderColor: '#DFD2FA',
    opacity: 0.96,
    transform: [{ scale: 0.99 }],
  },
  watermark: {
    position: 'absolute',
    right: -26,
    top: 34,
    width: 150,
    height: 150,
    opacity: 0.07,
    transform: [{ rotate: '18deg' }],
  },
  recordTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    position: 'relative',
    zIndex: 2,
  },
  syncBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingHorizontal: 11,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: '#E6F6EE',
    borderWidth: 1,
    borderColor: '#B7E6CD',
  },
  syncBadgePending: {
    backgroundColor: '#FFF8E6',
    borderColor: '#FDE68A',
  },
  syncDotHalo: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: 'rgba(22, 165, 106, 0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  syncDotHaloPending: {
    backgroundColor: 'rgba(180, 83, 9, 0.18)',
  },
  syncDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#16A56A',
  },
  syncDotPending: {
    backgroundColor: '#B45309',
  },
  syncText: {
    fontSize: 12.5,
    fontFamily: 'PlusJakartaSans-Bold',
    color: '#0F7A4D',
    includeFontPadding: false,
  },
  syncTextPending: {
    color: '#B45309',
  },
  recordDate: {
    fontSize: 13,
    fontFamily: 'PlusJakartaSans-SemiBold',
    color: '#6B6480',
    includeFontPadding: false,
  },
  recordTitle: {
    fontSize: 24,
    fontFamily: 'PlusJakartaSans-ExtraBold',
    color: '#1D1530',
    marginTop: 18,
    letterSpacing: -0.3,
    includeFontPadding: false,
    position: 'relative',
    zIndex: 2,
  },
  locRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 6,
    position: 'relative',
    zIndex: 2,
  },
  recordLoc: {
    fontSize: 13.5,
    fontFamily: 'PlusJakartaSans-Medium',
    color: '#6B6480',
    includeFontPadding: false,
  },
  recordFoot: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 16,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: '#EAE5F5',
    position: 'relative',
    zIndex: 2,
  },
  agentAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#EFE9FB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  agentAvatarText: {
    fontSize: 12.5,
    fontFamily: 'PlusJakartaSans-Bold',
    color: '#5B21B6',
    includeFontPadding: false,
  },
  agentInfo: {
    flex: 1,
  },
  agentLabel: {
    fontSize: 12,
    fontFamily: 'PlusJakartaSans-Medium',
    color: '#6B6480',
    lineHeight: 16,
    includeFontPadding: false,
  },
  agentName: {
    fontSize: 14.5,
    fontFamily: 'PlusJakartaSans-Bold',
    color: '#5B21B6',
    includeFontPadding: false,
  },
  hiddenA11yText: {
    display: 'none',
  },
  adminRecordFilters: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 9,
    marginBottom: 13,
  },
  adminSelectField: {
    flexGrow: 1,
    flexShrink: 1,
    flexBasis: 158,
    minWidth: 0,
    minHeight: 46,
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#431682',
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 10,
    paddingVertical: 12,
  },
  adminSelectFieldText: {
    fontSize: 12.5,
    fontFamily: 'PlusJakartaSans-Bold',
    color: '#181126',
    includeFontPadding: false,
    flex: 1,
    minWidth: 0,
    marginRight: 4,
  },
  adminRecordReporter: {
    fontSize: 11,
    fontWeight: '800',
    color: '#6824D6',
    marginTop: 4,
  },
});
