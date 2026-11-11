// src/pages/Admin/AdminPanelScreen.js
import React, { useMemo, useState } from 'react';
import { StyleSheet } from 'react-native';
import { Pressable, ScrollView, Text, View } from '../../ui/AccessibleNative';
import useAccessibility from '../../hooks/useAccessibility';
import useSpeakOnMount from '../../hooks/useSpeakOnMount';
import { sentences } from '../../services/accessibilityDescriptions';
import { ChevronDownIcon } from '../../ui/SismorcegoIcons';
import { filterPanelRecords, panelKpis, recordGpsPoint } from '../../services/adminPanelData';
import useSpotlightScroll from '../../ui/useSpotlightScroll';
import MainScreenHeader from '../../ui/MainScreenHeader';
import PanelTrendChart from './PanelTrendChart';
import DeferredPanelMap from './DeferredPanelMap';

const REGIAO_PADRAO = {
  latitude: -1.354986,
  longitude: -48.395724,
  latitudeDelta: 4,
  longitudeDelta: 4,
};

const VICTIM_LABELS = {
  all: 'Todas as espécies mordidas',
  humano: 'Humano',
  canino: 'Canino / Felino',
  aves: 'Aves',
  producao: 'Animal de produção',
};

const PERIOD_OPTIONS = [
  { value: 'all', label: 'Todo o período' },
  { value: '7', label: 'Últimos 7 dias' },
  { value: '30', label: 'Últimos 30 dias' },
];

export default function AdminPanelScreen({
  records = [],
  onOpenBottomSheet,
  guideRefs = {},
  scrollRef,
  guideActive = false,
  bottomInset = 0,
  reduceMotion = false,
}) {
  const { fontScale } = useAccessibility();
  const guideScrollProps = useSpotlightScroll(scrollRef);
  const [guideViewportHeight, setGuideViewportHeight] = useState(0);
  const [selectedCity, setSelectedCity] = useState('all');
  const [selectedPeriod, setSelectedPeriod] = useState('all');
  const [selectedVictim, setSelectedVictimKey] = useState('all');

  // Extract cities from actual records
  const availableCities = useMemo(() => {
    const set = new Set();
    records.forEach((r) => {
      if (r.city || r.municipio) set.add(r.city || r.municipio);
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'pt-BR'));
  }, [records]);

  const filteredRecords = useMemo(() => filterPanelRecords(records, {
    city: selectedCity, period: selectedPeriod, victim: selectedVictim,
  }), [records, selectedCity, selectedPeriod, selectedVictim]);
  const kpis = useMemo(() => panelKpis(filteredRecords), [filteredRecords]);
  const gpsPoints = useMemo(() => filteredRecords.map(recordGpsPoint).filter(Boolean), [filteredRecords]);

  const semGpsCount = filteredRecords.length - gpsPoints.length;
  useSpeakOnMount(sentences('Painel. Monitoramento epidemiológico regional',
    `Município: ${selectedCity === 'all' ? 'Todos' : selectedCity}`, PERIOD_OPTIONS.find(option => option.value === selectedPeriod)?.label,
    VICTIM_LABELS[selectedVictim], `Total de registros: ${kpis.total}`, `Em humanos: ${kpis.humanos}`, `Em animais: ${kpis.animais}`,
    `Caninos e felinos: ${kpis.caninoFelino}`, `Aves: ${kpis.aves}`, `Animais de produção: ${kpis.producao}`,
    `${gpsPoints.length} registros com GPS`, `${semGpsCount} sem coordenadas GPS`, 'Use Dia e Mês para ouvir o gráfico de registros por período'));

  const mapRegion = useMemo(() => {
    if (!gpsPoints.length) return REGIAO_PADRAO;
    const lats = gpsPoints.map((p) => p.latitude);
    const lngs = gpsPoints.map((p) => p.longitude);
    const minLat = Math.min(...lats);
    const maxLat = Math.max(...lats);
    const minLng = Math.min(...lngs);
    const maxLng = Math.max(...lngs);
    return {
      latitude: (minLat + maxLat) / 2,
      longitude: (minLng + maxLng) / 2,
      latitudeDelta: Math.min(180, Math.max(maxLat - minLat, 0.05) * 1.4),
      longitudeDelta: Math.min(360, Math.max(maxLng - minLng, 0.05) * 1.4),
    };
  }, [gpsPoints]);
  // Open filters via BottomSheetModal
  const handleOpenCityFilter = () => {
    if (!onOpenBottomSheet) return;
    const options = [
      { id: 'all', label: 'Todos os municípios' },
      ...availableCities.map((c) => ({ id: c, label: c })),
    ];
    onOpenBottomSheet({
      id: 'admin-city',
      title: 'Município',
      options,
      selectedValue: selectedCity,
      onSelect: (opt) => setSelectedCity(opt.id),
    });
  };

  const handleOpenPeriodFilter = () => {
    if (!onOpenBottomSheet) return;
    onOpenBottomSheet({
      id: 'admin-period',
      title: 'Período',
      options: PERIOD_OPTIONS.map((p) => ({ id: p.value, label: p.label })),
      selectedValue: selectedPeriod,
      onSelect: (opt) => setSelectedPeriod(opt.id),
    });
  };

  const handleOpenVictimFilter = () => {
    if (!onOpenBottomSheet) return;
    const options = [
      { id: 'all', label: 'Todas as espécies mordidas' },
      { id: 'humano', label: 'Humano' },
      { id: 'canino', label: 'Canino / Felino' },
      { id: 'aves', label: 'Aves' },
      { id: 'producao', label: 'Animal de produção' },
    ];
    onOpenBottomSheet({
      id: 'admin-victim',
      title: 'Espécie mordida',
      options,
      selectedValue: selectedVictim,
      onSelect: (opt) => setSelectedVictimKey(opt.id),
    });
  };

  return (
    <View ref={guideRefs.panelOverview} collapsable={false} style={styles.screen}>
      <MainScreenHeader title="Painel" subtitle="Monitoramento epidemiológico regional" />

      <ScrollView
        {...guideScrollProps}
        onLayout={event => setGuideViewportHeight(event.nativeEvent.layout.height)}
        style={styles.container}
        contentContainerStyle={[styles.content, { paddingBottom: 110 + bottomInset }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Step 6 spotlight target: Overview card / Filters */}
        <View ref={guideRefs.panelTop} collapsable={false}>
          {/* Card Filtrar ocorrências */}
          <View style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>Filtrar ocorrências</Text>
            <View style={styles.filterGrid}>
              <Pressable
                onPress={handleOpenCityFilter}
                style={[styles.selectField, { flexBasis: 158 * Math.max(1, fontScale) }]}
                accessibilityLabel="Filtrar por município"
              >
                <Text style={styles.selectFieldText}>
                  {`Município: ${selectedCity === 'all' ? 'Todos' : selectedCity}`}
                </Text>
                <ChevronDownIcon size={20} color="#5E5473" />
              </Pressable>

              <Pressable
                onPress={handleOpenPeriodFilter}
                style={[styles.selectField, { flexBasis: 158 * Math.max(1, fontScale) }]}
                accessibilityLabel="Filtrar por período"
              >
                <Text style={styles.selectFieldText}>
                  {PERIOD_OPTIONS.find((p) => p.value === selectedPeriod)?.label ||
                    'Todo o período'}
                </Text>
                <ChevronDownIcon size={20} color="#5E5473" />
              </Pressable>

              <Pressable
                onPress={handleOpenVictimFilter}
                style={[styles.selectField, styles.selectFieldFull]}
                accessibilityLabel="Filtrar por espécie mordida"
              >
                <Text style={styles.selectFieldText}>
                  {VICTIM_LABELS[selectedVictim] || 'Todas as espécies mordidas'}
                </Text>
                <ChevronDownIcon size={20} color="#5E5473" />
              </Pressable>
            </View>
          </View>

          {/* KPI Indicators */}
          <View style={styles.kpiGrid}>
            <View style={[styles.kpiCard, styles.kpiCardFeatured]}>
              <Text style={[styles.kpiValue, styles.kpiTextFeatured]}>{kpis.total}</Text>
              <Text style={[styles.kpiLabel, styles.kpiTextFeatured]}>Total de registros</Text>
            </View>
            <View style={styles.kpiCard}>
              <Text style={styles.kpiValue}>{kpis.humanos}</Text>
              <Text style={styles.kpiLabel}>Em humanos</Text>
            </View>
            <View style={styles.kpiCard}>
              <Text style={styles.kpiValue}>{kpis.animais}</Text>
              <Text style={styles.kpiLabel}>Em animais</Text>
            </View>
          </View>

          {/* Distribuição em animais */}
          <View style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>Distribuição em animais</Text>
            <View style={styles.animalGrid}>
              <View style={styles.animalKpi}>
                <Text style={styles.animalKpiValue}>{kpis.caninoFelino}</Text>
                <Text style={styles.animalKpiLabel}>Canino/Felino</Text>
              </View>
              <View style={styles.animalKpi}>
                <Text style={styles.animalKpiValue}>{kpis.aves}</Text>
                <Text style={styles.animalKpiLabel}>Aves</Text>
              </View>
              <View style={styles.animalKpi}>
                <Text style={styles.animalKpiValue}>{kpis.producao}</Text>
                <Text style={styles.animalKpiLabel}>Produção</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Step 7 target 1: Mapa de calor e ocorrências */}
        <View
          ref={guideRefs.panelMapSection}
          collapsable={false}
          style={styles.sectionCard}
        >
          <View style={styles.sectionHeading}>
            <Text style={styles.headingTitle}>Mapa de calor e ocorrências</Text>
            <Text style={styles.mapCountBadge}>{`${gpsPoints.length} com GPS`}</Text>
          </View>

          <View style={styles.mapWindow}>
            {gpsPoints.length === 0 ? (
              <View style={styles.mapEmpty}>
                <Text style={styles.mapEmptyText}>
                  Nenhum registro com GPS para esses filtros.
                </Text>
              </View>
            ) : (
              <DeferredPanelMap points={gpsPoints} region={mapRegion} />
            )}
            <Text style={styles.mapCredit}>© OpenStreetMap</Text>
          </View>

          <View style={styles.mapInfo}>
            <Text style={styles.mapInfoLabel}>Registros sem coordenadas GPS</Text>
            <Text style={styles.mapInfoCount}>{semGpsCount}</Text>
          </View>
        </View>

        {/* Registros por período, abaixo do mapa no passo 7. */}
        <View
          ref={guideRefs.panelTrendSection}
          collapsable={false}
          style={styles.sectionCard}
        >
          <PanelTrendChart records={filteredRecords} reduceMotion={reduceMotion} />
        </View>
        {/* Espaço temporário para a última seção alcançar o topo no guia. */}
        {guideActive && <View testID="admin-guide-scroll-space" accessible={false}
          importantForAccessibility="no-hide-descendants" style={{ height: guideViewportHeight }} />}
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
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  sectionCard: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#ECE6F7',
    borderRadius: 18,
    padding: 15,
    marginBottom: 14,
    shadowColor: '#1C0D36',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  sectionHeading: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 7,
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#181126',
    marginBottom: 12,
  },
  filterGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 9,
  },
  selectField: {
    // Like the HTML's flex: 1 1 158px, wrap when two fields no longer fit.
    flexGrow: 1,
    flexShrink: 1,
    flexBasis: 158,
    minWidth: 0,
    minHeight: 52,
    backgroundColor: '#FAF8FC',
    borderWidth: 1.5,
    borderColor: '#ECE6F7',
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 11,
    paddingVertical: 12,
  },
  selectFieldFull: {
    flexBasis: 'auto',
    width: '100%',
    minWidth: '100%',
  },
  selectFieldText: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '700',
    color: '#181126',
    flex: 1,
    minWidth: 0,
    marginRight: 6,
    includeFontPadding: false,
  },
  kpiGrid: {
    flexDirection: 'row',
    gap: 9,
    marginBottom: 14,
  },
  kpiCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#ECE6F7',
    borderRadius: 15,
    paddingVertical: 14,
    paddingHorizontal: 6,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    shadowColor: '#1C0D36',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  kpiCardFeatured: {
    backgroundColor: '#6824D6',
    borderColor: '#6824D6',
  },
  kpiValue: {
    fontSize: 25,
    lineHeight: 25,
    fontWeight: '800',
    color: '#5316B8',
    includeFontPadding: false,
  },
  kpiLabel: {
    fontSize: 10,
    lineHeight: 13,
    fontWeight: '700',
    color: '#5E5473',
    textAlign: 'center',
    includeFontPadding: false,
  },
  kpiTextFeatured: {
    color: '#FFFFFF',
  },
  animalGrid: {
    flexDirection: 'row',
    gap: 8,
  },
  animalKpi: {
    flex: 1,
    backgroundColor: '#F8F6FD',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 4,
    alignItems: 'center',
  },
  animalKpiValue: {
    fontSize: 20,
    fontWeight: '800',
    color: '#6824D6',
    marginBottom: 4,
  },
  animalKpiLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#5E5473',
    textAlign: 'center',
  },
  headingTitle: {
    flexShrink: 1,
    fontSize: 13,
    lineHeight: 18,
    fontFamily: 'PlusJakartaSans-ExtraBold',
    color: '#181126',
    includeFontPadding: false,
  },
  mapCountBadge: {
    fontSize: 12.5,
    lineHeight: 18,
    fontFamily: 'PlusJakartaSans-ExtraBold',
    color: '#6824D6',
    flexShrink: 0,
    includeFontPadding: false,
  },
  mapWindow: {
    width: '100%',
    height: 218,
    borderRadius: 13,
    backgroundColor: '#E8E5F0',
    overflow: 'hidden',
    position: 'relative',
    borderWidth: 1,
    borderColor: '#ECE6F7',
  },
  mapEmpty: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#F8F6FD',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  mapEmptyText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#796E92',
    textAlign: 'center',
  },
  mapCredit: {
    position: 'absolute',
    right: 4,
    bottom: 4,
    fontSize: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.88)',
    paddingHorizontal: 4,
    paddingVertical: 2,
    borderRadius: 4,
    color: '#444',
  },
  mapInfo: {
    marginTop: 12,
    backgroundColor: '#F8F6FD',
    borderRadius: 11,
    paddingVertical: 10,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  mapInfoLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#5E5473',
  },
  mapInfoCount: {
    fontSize: 13,
    fontWeight: '800',
    color: '#181126',
  },
});
