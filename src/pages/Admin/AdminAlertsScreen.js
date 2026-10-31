// src/pages/Admin/AdminAlertsScreen.js
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Easing,
  RefreshControl,
  StyleSheet,
} from 'react-native';
import { Animated, Pressable, ScrollView, Text, View } from '../../ui/AccessibleNative';
import {
  DoubleCheckIcon,
  MapPinStandardIcon,
  VictimIconByKey,
} from '../../ui/SismorcegoIcons';
import { Text as AccessibleText } from '../../ui/AccessibleNative';
import useAccessibility from '../../hooks/useAccessibility';
import useSpeakOnMount from '../../hooks/useSpeakOnMount';
import { describeRecords, sentences } from '../../services/accessibilityDescriptions';
import MainScreenHeader from '../../ui/MainScreenHeader';
import useReduceMotion from '../../ui/useReduceMotion';

const FILTERS = [
  { key: 'all', label: 'Todos' },
  { key: 'unread', label: 'Não lidos' },
  { key: 'read', label: 'Lidos' },
];

function getInitials(name) {
  if (!name) return 'AG';
  const parts = String(name).trim().split(/\s+/).filter(Boolean);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + (parts[1]?.[0] || '')).toUpperCase();
}

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
    ? (active ? '#6824D6' : '#ECE6F7')
    : anim.interpolate({
        inputRange: [0, 1],
        outputRange: ['#ECE6F7', '#6824D6'],
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
        <AccessibleText
          numberOfLines={1}
          style={[
            styles.filterPillText,
            { color: textColor },
            active && styles.filterPillTextActive,
          ]}
        >
          {label}
        </AccessibleText>
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
          <AccessibleText numberOfLines={1} style={styles.countBadgeText}>{count}</AccessibleText>
        </Animated.View>
      </Pressable>
    </Animated.View>
  );
}

export default function AdminAlertsScreen({
  alerts = [],
  loading = false,
  error,
  onRetry,
  onMarkRead,
  onMarkUnread,
  onMarkAllRead,
  onSelectAlert,
  guideRefs = {},
  reduceMotion: reduceMotionProp,
}) {
  const systemReduceMotion = useReduceMotion();
  const reduceMotion = Boolean(reduceMotionProp || systemReduceMotion);
  const [activeFilter, setActiveFilter] = useState('all');

  const unreadCount = useMemo(
    () => alerts.filter((a) => !a.lida).length,
    [alerts]
  );

  const counts = useMemo(() => {
    const total = alerts.length;
    const unread = alerts.filter((a) => !a.lida).length;
    const read = alerts.filter((a) => Boolean(a.lida)).length;
    return {
      all: total,
      unread,
      read,
    };
  }, [alerts]);

  const filteredAlerts = useMemo(() => {
    return alerts.filter((a) => {
      if (activeFilter === 'unread') return !a.lida;
      if (activeFilter === 'read') return Boolean(a.lida);
      return true;
    });
  }, [alerts, activeFilter]);

  const hasUnread = unreadCount > 0;
  useSpeakOnMount(sentences('Alertas', `${unreadCount} alertas não lidos`, FILTERS.find(filter => filter.key === activeFilter)?.label,
    describeRecords(filteredAlerts, 'Alertas exibidos')));

  return (
    <View ref={guideRefs.alertsOverview} collapsable={false} style={styles.screen}>
      <MainScreenHeader title="Alertas" subtitle="Alertas no aplicativo, atualizados com conexão"
        actionIcon={<DoubleCheckIcon size={23} color="#6824D6" />}
        actionLabel="Marcar todos os alertas como lidos" onActionPress={onMarkAllRead} />

      <ScrollView
        style={styles.container}
        contentContainerStyle={[styles.content, error && styles.errorContent]}
        showsVerticalScrollIndicator={false}
        alwaysBounceVertical
        refreshControl={
          <RefreshControl
            refreshing={Boolean(loading)}
            onRefresh={onRetry}
            colors={['#6824D6']}
            tintColor="#6824D6"
          />
        }
      >
        {/* Step 8 spotlight target: Overview card */}
        <View
          collapsable={false}
          style={[
            styles.overviewCard,
            hasUnread ? styles.overviewCardAlert : styles.overviewCardNeutral,
          ]}
        >
          <View style={styles.overviewInfo}>
            <Text
              style={[
                styles.overviewTitle,
                hasUnread && styles.overviewTitleAlert,
              ]}
            >
              Alertas não lidos
            </Text>
            <Text
              style={[
                styles.overviewHelp,
                hasUnread && styles.overviewHelpAlert,
              ]}
            >
              {hasUnread
                ? 'Novos alertas para leitura'
                : 'Nenhum alerta aguardando leitura'}
            </Text>
          </View>
          <View
            style={[
              styles.overviewCountBadge,
              hasUnread && styles.overviewCountBadgeAlert,
            ]}
          >
            <Text
              style={[
                styles.overviewCountText,
                hasUnread && styles.overviewCountTextAlert,
              ]}
            >
              {`${unreadCount} novos`}
            </Text>
          </View>
        </View>

        {/* Filter Pills */}
        <View style={styles.pillsRow}>
          {FILTERS.map((f) => {
            const active = f.key === activeFilter;
            return (
              <FilterPillButton
                key={f.key}
                filterKey={f.key}
                label={f.label}
                count={counts[f.key] ?? 0}
                active={active}
                onPress={() => setActiveFilter(f.key)}
                reduceMotion={reduceMotion}
              />
            );
          })}
        </View>

        {/* Alerts List */}
        {error ? (
          <View style={styles.errorContainer}>
            <Text style={styles.emptyText}>{error}</Text>
            <Pressable
              style={({ pressed }) => [styles.retryButton, pressed && { opacity: 0.8 }]}
              onPress={onRetry}
              accessibilityRole="button"
            >
              <Text style={styles.retryButtonText}>Tentar novamente</Text>
            </Pressable>
          </View>
        ) : !loading && filteredAlerts.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>
              Nenhum alerta para o filtro selecionado.
            </Text>
          </View>
        ) : (
          <View style={styles.alertsList}>
            {filteredAlerts.map((item) => {
              const isUnread = !item.lida;
              const victimKey = item.victimKey || (
                String(item.title || item.tipoVitima || '').toLowerCase().includes('humano') ? 'humano' :
                String(item.title || item.tipoVitima || '').toLowerCase().includes('canino') || String(item.title || item.tipoVitima || '').toLowerCase().includes('felino') ? 'canino' :
                String(item.title || item.tipoVitima || '').toLowerCase().includes('ave') ? 'aves' :
                String(item.title || item.tipoVitima || '').toLowerCase().includes('produ') ? 'producao' : 'canino'
              );
              const cityName = item.city || item.municipio || '';
              const localityName = item.locality || item.localidade || item.community || '';
              const summary = item.summary || item.resumo || '';
              const agentName = item.reporter || item.nomeAcs || '';
              const formattedDate = item.date || item.createdAtFormatted || '';

              return (
                <View
                  key={`${activeFilter}-${item.id}`}
                  testID={`alert-card-${item.id}`}
                >
                  <Pressable
                    onPress={() => onSelectAlert?.(item)}
                    style={({ pressed }) => [
                      styles.alertCard,
                      isUnread && styles.alertCardUnread,
                      pressed && { opacity: 0.95 },
                    ]}
                    accessibilityRole="button"
                    accessibilityLabel={`Consultar alerta de ${item.title || item.tipoVitima || 'ocorrência'} em ${cityName || localityName || ''}`}
                  >
                    {/* Top Row: Chip + Badge */}
                    <View style={styles.cardTopRow}>
                      <View style={styles.chip}>
                        <VictimIconByKey
                          victimKey={victimKey}
                          size={14}
                          color="#6824D6"
                        />
                        <Text style={styles.chipText}>
                          {item.title || item.tipoVitima || 'Ocorrência'}
                        </Text>
                      </View>

                      <View
                        style={[
                          styles.badge,
                          isUnread ? styles.badgeUnread : styles.badgeRead,
                        ]}
                      >
                        <Text
                          style={[
                            styles.badgeText,
                            isUnread ? styles.badgeTextUnread : styles.badgeTextRead,
                          ]}
                        >
                          {isUnread ? 'Novo alerta' : 'Lido'}
                        </Text>
                      </View>
                    </View>

                    {/* Location Section */}
                    {cityName ? (
                      <View style={styles.locRow}>
                        <MapPinStandardIcon size={14} color="#796E92" strokeWidth={2} />
                        <Text style={styles.locCity}>{cityName}</Text>
                      </View>
                    ) : null}

                    {(localityName || cityName) ? (
                      <Text style={styles.locPlace}>
                        {localityName || cityName}
                      </Text>
                    ) : null}

                    {summary ? (
                      <Text style={styles.desc}>{summary}</Text>
                    ) : null}

                    {/* Agent Section with dashed divider */}
                    <View style={styles.agentRow}>
                      <View style={styles.av} aria-hidden={true}>
                        <Text style={styles.avText}>{getInitials(agentName)}</Text>
                      </View>
                      <View style={styles.agentInfo}>
                        <Text style={styles.agentLabel}>Agente</Text>
                        <Text style={styles.agentName}>{agentName || 'Não informado'}</Text>
                        <Text style={styles.hiddenA11yText}>{`Agente: ${agentName || 'Não informado'}`}</Text>
                        {formattedDate ? (
                          <Text style={styles.agentDate}>{formattedDate}</Text>
                        ) : null}
                      </View>
                    </View>

                    {/* Bottom Action Button */}
                    {(isUnread || onMarkUnread) && (
                      <Pressable
                        onPress={(e) => {
                          e.stopPropagation?.();
                          if (isUnread) onMarkRead?.(item);
                          else onMarkUnread?.(item);
                        }}
                        style={({ pressed }) => [
                          styles.btnFull,
                          pressed && styles.btnFullPressed,
                        ]}
                        accessibilityRole="button"
                        accessibilityLabel={isUnread ? 'Marcar alerta como lido' : 'Marcar alerta como não lido'}
                      >
                        <Text style={styles.btnFullText}>
                          {isUnread ? 'Marcar como lido' : 'Marcar como não lido'}
                        </Text>
                      </Pressable>
                    )}
                  </Pressable>
                </View>
              );
            })}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#FAF8FC',
  },
  container: {
    flex: 1,
  },
  content: {
    flexGrow: 1,
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 104,
  },
  overviewCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
    minHeight: 70,
    paddingVertical: 13,
    paddingHorizontal: 15,
    borderRadius: 15,
    borderWidth: 1.5,
    borderColor: 'transparent',
    marginBottom: 14,
  },
  overviewCardNeutral: {
    backgroundColor: '#F1EEF8',
  },
  overviewCardAlert: {
    backgroundColor: '#FEF3C7',
    borderColor: '#FDE68A',
  },
  overviewInfo: {
    flexDirection: 'column',
    gap: 4,
    flex: 1,
    minWidth: 0,
  },
  overviewTitle: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '800',
    color: '#181126',
  },
  overviewTitleAlert: {
    color: '#744600',
  },
  overviewHelp: {
    fontSize: 11,
    lineHeight: 16,
    fontWeight: '600',
    color: '#796E92',
  },
  overviewHelpAlert: {
    color: '#96620B',
  },
  overviewCountBadge: {
    minWidth: 76,
    flexShrink: 0,
    marginTop: 3,
    paddingVertical: 7,
    paddingHorizontal: 11,
    borderRadius: 10,
    backgroundColor: '#E4DFED',
  },
  overviewCountBadgeAlert: {
    backgroundColor: '#F7CD65',
  },
  overviewCountText: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
    textAlign: 'center',
    color: '#5E5473',
  },
  overviewCountTextAlert: {
    color: '#713F00',
  },
  pillsRow: {
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
  emptyContainer: {
    paddingVertical: 40,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 12.5,
    fontWeight: '600',
    color: '#796E92',
    textAlign: 'center',
  },
  errorContent: {
    flexGrow: 1,
    paddingBottom: 104,
  },
  errorContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 32,
    gap: 20,
  },
  retryButton: {
    alignSelf: 'center',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
    minWidth: 180,
    maxWidth: '100%',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 12,
    backgroundColor: '#EDE7F8',
  },
  retryButtonText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#6824D6',
    textAlign: 'center',
  },
  alertsList: {
    gap: 12,
  },
  alertCard: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#ECE6F7',
    borderRadius: 20,
    padding: 16,
    shadowColor: '#1C0D36',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  alertCardUnread: {
    backgroundColor: '#FFFFFF',
    borderColor: '#DDD6FE',
  },
  cardTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#F6F3FF',
    paddingVertical: 5,
    paddingHorizontal: 11,
    borderRadius: 999,
  },
  chipText: {
    fontSize: 12.5,
    fontFamily: 'PlusJakartaSans-Bold',
    color: '#6824D6',
    includeFontPadding: false,
  },
  badge: {
    paddingVertical: 3,
    paddingHorizontal: 11,
    borderRadius: 999,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeRead: {
    backgroundColor: '#FFFFFF',
    borderColor: '#ECE6F7',
  },
  badgeUnread: {
    backgroundColor: '#6824D6',
    borderColor: '#6824D6',
  },
  badgeText: {
    fontSize: 11.5,
    fontFamily: 'PlusJakartaSans-Bold',
    includeFontPadding: false,
  },
  badgeTextRead: {
    color: '#796E92',
  },
  badgeTextUnread: {
    color: '#FFFFFF',
  },
  locRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 14,
  },
  locCity: {
    fontSize: 13,
    fontFamily: 'PlusJakartaSans-Medium',
    color: '#796E92',
    includeFontPadding: false,
  },
  locPlace: {
    fontSize: 18,
    fontFamily: 'PlusJakartaSans-ExtraBold',
    color: '#181126',
    marginTop: 3,
    includeFontPadding: false,
  },
  desc: {
    fontSize: 13.5,
    fontFamily: 'PlusJakartaSans-Medium',
    color: '#5E5473',
    lineHeight: 19.5,
    marginTop: 6,
    includeFontPadding: false,
  },
  agentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 14,
    paddingTop: 14,
    borderTopWidth: 1,
    borderStyle: 'dashed',
    borderColor: '#ECE6F7',
  },
  av: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F6F3FF',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  avText: {
    fontSize: 13.5,
    fontFamily: 'PlusJakartaSans-Bold',
    color: '#6824D6',
    includeFontPadding: false,
  },
  agentInfo: {
    flex: 1,
    justifyContent: 'center',
  },
  agentLabel: {
    fontSize: 11,
    fontFamily: 'PlusJakartaSans-Medium',
    color: '#796E92',
    includeFontPadding: false,
  },
  agentName: {
    fontSize: 14,
    fontFamily: 'PlusJakartaSans-Bold',
    color: '#181126',
    marginTop: 1,
    includeFontPadding: false,
  },
  agentDate: {
    fontSize: 12,
    fontFamily: 'PlusJakartaSans-Medium',
    color: '#796E92',
    marginTop: 2,
    includeFontPadding: false,
  },
  hiddenA11yText: {
    display: 'none',
  },
  btnFull: {
    marginTop: 14,
    width: '100%',
    paddingVertical: 11,
    borderRadius: 12,
    backgroundColor: '#F6F3FF',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  btnFullPressed: {
    backgroundColor: '#EDE7F8',
  },
  btnFullText: {
    fontSize: 13.5,
    fontFamily: 'PlusJakartaSans-Bold',
    color: '#6824D6',
    includeFontPadding: false,
  },
});
