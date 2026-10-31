import { Pressable, ScrollView, Text, TextInput, View } from '../../ui/AccessibleNative';
import { captureGpsLocation, pickRegistroPhoto } from '../../services/deviceCapture';
import React, { useEffect, useRef, useState } from 'react';
import { Image, StyleSheet } from 'react-native';
import {
  ArrowLeftIcon,
  CalendarIcon,
  CameraIcon,
  CheckIcon,
  ChevronDownIcon,
  CrosshairGpsIcon,
  GalleryImageIcon,
  MapPinStandardIcon,
  PencilEditIcon,
  TagInfoIcon,
  VictimIconByKey,
} from '../../ui/SismorcegoIcons';
import GpsMapPreview from '../../ui/GpsMapPreview';
import AnimatedField from '../../ui/AnimatedField';
import useSpotlightScroll from '../../ui/useSpotlightScroll';
import MainScreenHeader from '../../ui/MainScreenHeader';
import useFormAutoAdvance from '../../ui/useFormAutoAdvance';
import {
  VICTIM_DESCRIPTIONS,
  VICTIM_FORMS,
  clearHiddenVictimFields,
  getReporterInitials,
  isVictimFieldVisible,
  validateVictimFields,
} from '../../services/sismorcegoData';
import { reverseGeocodeLocation } from '../../services/geocoding';
import useSpeakOnMount from '../../hooks/useSpeakOnMount';
import useAccessibility from '../../hooks/useAccessibility';
import { sentences } from '../../services/accessibilityDescriptions';

const VICTIM_TILES = [
  { key: 'humano', label: 'Humano' },
  { key: 'canino', label: 'Canino / Felino' },
  { key: 'aves', label: 'Aves' },
  { key: 'producao', label: 'Animal de produção' },
];

const MAIN_BOTTOM_PADDING = 112;
const VICTIM_BOTTOM_PADDING = 110;

export default function NovaNotificacaoScreen({
  reporterName,
  onOpenReporterModal,
  onOpenVictimInfo,
  activeVictimSubscreen,
  setActiveVictimSubscreen,
  selectedVictimKey,
  setSelectedVictimKey,
  victimData,
  setVictimData,
  victimSaved,
  setVictimSaved,
  gpsState,
  setGpsState,
  photoState,
  setPhotoState,
  dateState,
  onOpenCalendarForNew,
  isCalendarOpenForNew,
  city,
  setCity,
  community,
  setCommunity,
  onOpenBottomSheet,
  activeSheetFieldKey,
  onSaveCompleteRecord,
  saving = false,
  showToast,
  reduceMotion = false,
  bottomInset = 0,
  guideRefs = {},
  guideScroll,
}) {
  const { highContrast } = useAccessibility();
  const [cityError, setCityError] = useState(false);
  const [focusedInput, setFocusedInput] = useState(null);
  const [vfErrors, setVfErrors] = useState({});
  const [vfSaveOnCompletion, setVfSaveOnCompletion] = useState(false);
  const safeBottomInset = Math.max(0, bottomInset);

  const mainScrollRef = useRef(null);
  const guideScrollProps = useSpotlightScroll(guideScroll, mainScrollRef);
  const vfScrollRef = useRef(null);
  const stepGeoYRef = useRef(0);
  const cityInputRef = useRef(null);
  const gpsRequestRef = useRef(0);
  const previousGpsRef = useRef(null);
  useEffect(() => () => {
    gpsRequestRef.current += 1;
    setGpsState?.(previous => previous?.status === 'loading' ? previousGpsRef.current : previous);
  }, [setGpsState]);

  const activeForm = VICTIM_FORMS[activeVictimSubscreen];
  const activeValues = victimData?.[activeVictimSubscreen] || {};
  useSpeakOnMount(sentences('Nova notificação', activeForm ? activeForm.title || VICTIM_TILES.find(item => item.key === activeVictimSubscreen)?.label : 'Informe o responsável, selecione o tipo de vítima e preencha os dados da ocorrência',
    activeForm ? activeForm.groups.flatMap(group => group.fields).filter(field => isVictimFieldVisible(field, activeValues)).map(field => field.label) : '',
    !activeForm && dateState?.display ? `Data da ocorrência: ${dateState.display}` : '',
    activeForm ? 'Preencha os campos e salve os dados da vítima' : 'Você pode adicionar GPS e foto. Ao terminar, salve a notificação'));
  const vfAutoAdvance = useFormAutoAdvance({
    sessionKey: activeVictimSubscreen,
    fieldKeys: activeForm?.groups.flatMap(group => group.fields)
      .filter(field => isVictimFieldVisible(field, activeValues)).map(field => field.key) || [],
    scrollRef: vfScrollRef,
    blocked: Boolean(activeSheetFieldKey),
    bottomClearance: VICTIM_BOTTOM_PADDING + safeBottomInset,
    reduceMotion,
  });
  const vfFieldOffsetsRef = useRef({});

  const openVictimForm = (key, saveOnCompletion = false) => {
    setSelectedVictimKey(key);
    setVfSaveOnCompletion(saveOnCompletion);
    setVfErrors({});
    vfFieldOffsetsRef.current = {};
    setActiveVictimSubscreen(key);
  };

  const handleUpdateVfValue = (victimKey, fieldKey, val) => {
    setVictimData((prev) => {
      const nextForType = clearHiddenVictimFields(victimKey, {
        ...(prev[victimKey] || {}),
        [fieldKey]: val,
      });
      return {
        ...prev,
        [victimKey]: nextForType,
      };
    });
    setVictimSaved((prev) => ({
      ...prev,
      [victimKey]: false,
    }));
    setVfErrors((prev) => ({ ...prev, [fieldKey]: null }));
  };

  const handleConcludeVictimForm = (victimKey) => {
    const currentVals = clearHiddenVictimFields(
      victimKey,
      victimData[victimKey] || {},
    );
    const { valid, errors, firstErrorFieldKey } = validateVictimFields(
      victimKey,
      currentVals,
    );
    const form = VICTIM_FORMS[victimKey];
    if (!valid) {
      setVfErrors(errors);
      showToast?.(
        form?.missingMsg || 'Preencha os campos obrigatórios destacados',
      );
      if (
        firstErrorFieldKey &&
        vfFieldOffsetsRef.current[firstErrorFieldKey] !== undefined
      ) {
        vfScrollRef.current?.scrollTo({
          y: Math.max(0, vfFieldOffsetsRef.current[firstErrorFieldKey] - 40),
          animated: !reduceMotion,
        });
      }
      return;
    }

    setVictimData((prev) => ({
      ...prev,
      [victimKey]: currentVals,
    }));
    setVictimSaved((prev) => ({
      ...prev,
      [victimKey]: true,
    }));
    setSelectedVictimKey(victimKey);

    if (vfSaveOnCompletion) {
      setVfSaveOnCompletion(false);
      setActiveVictimSubscreen(null);
      onSaveCompleteRecord(victimKey, currentVals);
      return;
    }

    showToast?.(form?.savedMsg || 'Dados da vítima concluídos!');
    setActiveVictimSubscreen(null);
  };

  const applyGpsCoords = async (lat, lng, accuracy, metadata, request) => {
    const accText = accuracy != null ? ` (±${Math.round(accuracy)}m)` : '';
    const approximate = metadata.isHighAccuracy === false;
    const text = `${lat.toFixed(5)}, ${lng.toFixed(5)}${accText}`;
    setGpsState({
      status: 'done',
      lat,
      lng,
      accuracy,
      source: metadata.source,
      isHighAccuracy: metadata.isHighAccuracy,
      text,
      subtitle: `Latitude ${lat.toFixed(5)}  Longitude ${lng.toFixed(
        5,
      )}${accText}${approximate ? ' · Aproximada' : ''}`,
    });
    showToast?.(approximate ? 'Localização aproximada registrada. Para mais precisão, tente novamente em área aberta.' : 'Coordenadas GPS capturadas!');

    try {
      const address = await reverseGeocodeLocation(lat, lng);
      if (request !== gpsRequestRef.current) return;
      if (address?.municipio) {
        setCity(previous => previous.trim() ? previous : address.municipio);
        setCityError(false);
      }
      if (address?.localidade) {
        setCommunity(previous => previous.trim() ? previous : address.localidade);
      }
    } catch (e) {
      // Coordenadas reais permanecem válidas mesmo sem geocodificação.
    }
  };

  const handleCaptureGps = async () => {
    if (gpsState?.status === 'loading') return;
    const request = ++gpsRequestRef.current;
    mainScrollRef.current?.scrollTo({
      y: Math.max(0, stepGeoYRef.current - 6),
      animated: !reduceMotion,
    });
    const previousGps = gpsState;
    previousGpsRef.current = previousGps;
    setGpsState({
      status: 'loading',
      lat: null,
      lng: null,
      accuracy: null,
      text: '',
      subtitle: 'Aguardando autorização e coordenadas do aparelho',
    });

    try {
      const coords = await captureGpsLocation();
      if (request !== gpsRequestRef.current) return;
      await applyGpsCoords(coords.lat, coords.lng, coords.accuracy, coords, request);
    } catch (error) {
      if (request !== gpsRequestRef.current) return;
      setGpsState(previousGps);
      showToast?.(error.message);
    }
  };

  const handlePickPhoto = async (source) => {
    try {
      const photo = await pickRegistroPhoto(source);
      if (!photo) return;
      setPhotoState(photo);
      showToast?.(photo.notice?.message || 'Fotografia anexada ao registro.');
    } catch (error) {
      showToast?.(error.message || 'Não foi possível anexar a fotografia.');
    }
  };
  const handleSaveRecordPress = () => {
    if (saving) return;
    if (!reporterName.trim()) { onOpenReporterModal(); showToast?.('Informe o responsável pelo registro.'); return; }
    if (!dateState?.iso) {
      onOpenCalendarForNew();
      showToast?.('Selecione a data da mordedura');
      return;
    }
    if (!city.trim()) {
      setCityError(true);
      cityInputRef.current?.focus();
      showToast?.('Informe o município da ocorrência');
      return;
    }
    if (!selectedVictimKey) {
      mainScrollRef.current?.scrollTo({ y: 0, animated: !reduceMotion });
      showToast?.('Selecione o tipo de vítima no passo 1');
      return;
    }
    if (!victimSaved[selectedVictimKey]) {
      showToast?.('Complete o passo 1 para salvar o registro');
      openVictimForm(selectedVictimKey, true);
      return;
    }

    onSaveCompleteRecord(selectedVictimKey, victimData[selectedVictimKey]);
  };

  /* RENDER VICTIM FORM SUBSCREEN IF ACTIVE */
  if (activeVictimSubscreen && VICTIM_FORMS[activeVictimSubscreen]) {
    const vKey = activeVictimSubscreen;
    const form = VICTIM_FORMS[vKey];
    const currentVals = victimData[vKey] || {};

    return (
      <View style={styles.screen}>
        <View style={styles.subHeader}>
          <Pressable
            onPress={() => {
              setVfSaveOnCompletion(false);
              setActiveVictimSubscreen(null);
            }}
            style={({ pressed }) => [
              styles.backBtn,
              pressed && styles.backBtnPressed,
            ]}
          >
            <ArrowLeftIcon size={18} color="#5316B8" />
          </Pressable>
          <Text style={styles.subTitle}>{form.title}</Text>
        </View>

        <ScrollView
          key={vKey}
          ref={vfScrollRef}
          testID="victim-form-scroll"
          {...vfAutoAdvance.scrollHandlers}
          style={styles.scroll}
          contentContainerStyle={[
            styles.vfContent,
            { paddingBottom: VICTIM_BOTTOM_PADDING + safeBottomInset },
          ]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {form.groups.map((grp) => (
            <View key={grp.title} style={styles.vfGroupCard}>
              <Text style={styles.vfGroupTitle}>{grp.title.toUpperCase()}</Text>
              {grp.fields.map((field, idx) => {
                const visible = isVictimFieldVisible(field, currentVals);
                const val = String(currentVals[field.key] ?? '');
                const errMsg = vfErrors[field.key];
                const sheetId = `vf_${vKey}_${field.key}`;
                const isSheetOpen = activeSheetFieldKey === sheetId;
                const handleFieldLayout = (event) => {
                  vfFieldOffsetsRef.current[field.key] =
                    event.nativeEvent.layout.y;
                };

                const content = (
                  <View
                    key={field.key}
                    ref={vfAutoAdvance.fieldRef(field.key)}
                    collapsable={false}
                    testID={`victim-field-${field.key}`}
                    onLayout={field.showWhen ? undefined : handleFieldLayout}
                    style={[styles.vfFieldBlock, idx === 0 && styles.vfFirstField]}
                  >
                    {field.optionalTag ? (
                      <View style={styles.labelRowBetween}>
                        <Text style={[styles.fieldLabel, { marginBottom: 0 }]}>
                          {field.label}
                        </Text>
                        <Text style={styles.optionalTag}>
                          {field.optionalTag}
                        </Text>
                      </View>
                    ) : (
                      <Text style={styles.fieldLabel}>{field.label}</Text>
                    )}
                    {field.type === 'select' ? (
                      <Pressable
                        onPress={() =>
                          onOpenBottomSheet({
                            id: sheetId,
                            title: field.label,
                            options: field.options || [],
                            selectedValue: val,
                            onSelect: (chosen) => {
                              handleUpdateVfValue(vKey, field.key, chosen);
                              vfAutoAdvance.requestAdvance(field.key);
                            },
                          })
                        }
                        style={[
                          styles.selectTrigger,
                          isSheetOpen && styles.selectTriggerOpen,
                          errMsg && styles.inputError,
                        ]}
                      >
                        <Text
                          style={[
                            styles.selectTriggerText,
                            !val && styles.placeholderText,
                          ]}
                          numberOfLines={1}
                        >
                          {val || 'Selecione'}
                        </Text>
                        <View
                          style={{
                            transform: [
                              { rotate: isSheetOpen ? '180deg' : '0deg' },
                            ],
                          }}
                        >
                          <ChevronDownIcon
                            size={18}
                            color={isSheetOpen ? '#6824D6' : '#5E5473'}
                          />
                        </View>
                      </Pressable>
                    ) : (
                      <TextInput
                        accessibilityLabel={field.label}
                        style={[
                          styles.textInput,
                          focusedInput === sheetId && styles.textInputFocused,
                          errMsg && styles.inputError,
                        ]}
                        value={val}
                        onChangeText={(txt) =>
                          handleUpdateVfValue(vKey, field.key, txt)
                        }
                        onFocus={() => {
                          vfAutoAdvance.cancelAdvance();
                          setFocusedInput(sheetId);
                        }}
                        onBlur={() => setFocusedInput(null)}
                        placeholder={field.placeholder || ''}
                        placeholderTextColor="#796E92"
                        keyboardType={
                          field.type === 'number' ? 'numeric' : 'default'
                        }
                      />
                    )}
                    {errMsg ? (
                      <Text style={styles.errorText}>{errMsg}</Text>
                    ) : null}
                  </View>
                );
                return field.showWhen ? (
                  <AnimatedField
                    key={field.key}
                    visible={visible}
                    reduceMotion={reduceMotion}
                    onLayout={handleFieldLayout}
                  >
                    {content}
                  </AnimatedField>
                ) : content;
              })}
            </View>
          ))}

          <Pressable
            ref={vfAutoAdvance.fieldRef('__submit')}
            collapsable={false}
            onPress={() => handleConcludeVictimForm(vKey)}
            style={({ pressed }) => [
              styles.primaryBtn,
              { marginTop: 4 },
              pressed && styles.primaryBtnPressed,
            ]}
          >
            <Text style={styles.primaryBtnText}>
              {vfSaveOnCompletion ? 'Salvar registro' : 'Concluir'}
            </Text>
          </Pressable>
        </ScrollView>
      </View>
    );
  }

  /* RENDER MAIN NOVA NOTIFICAÇÃO SCREEN */
  const initials = getReporterInitials(reporterName);
  const isGpsDone = gpsState?.status === 'done';
  const isGpsLoading = gpsState?.status === 'loading';

  return (
    <View ref={guideRefs.notificationOverview} collapsable={false} style={styles.screen}>
      <ScrollView
        {...guideScrollProps}
        style={styles.scroll}
        contentContainerStyle={[
          styles.scrollOuterContent,
          { paddingBottom: MAIN_BOTTOM_PADDING + safeBottomInset },
        ]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <MainScreenHeader title="Nova notificação" subtitle="Registro rápido de ocorrência de mordedura" />

        <View style={styles.content}>
          {/* Reporter Card */}
          <View
            ref={guideRefs.reporterCard}
            collapsable={false}
            style={styles.reporterCard}
          >
            <View style={styles.reporterTop}>
              <View style={styles.reporterBadge}>
                <Text style={styles.reporterBadgeText}>{initials}</Text>
              </View>
              <View style={styles.reporterMeta}>
                <Text style={styles.reporterName} numberOfLines={1}>
                  {reporterName}
                </Text>
                <Text style={styles.reporterRole}>
                  Perfil: ACS Notificador Municipal
                </Text>
              </View>
            </View>
            <Pressable
              onPress={onOpenReporterModal}
              style={({ pressed }) => [
                styles.reporterEditBtn,
                pressed && { backgroundColor: '#EFE9FE' },
              ]}
            >
              <PencilEditIcon size={13} color="#5316B8" />
              <Text style={styles.reporterEditBtnText}>
                Alterar responsável pelo registro
              </Text>
            </Pressable>
          </View>

          {/* Step 1: Tipo de vítima */}
          <View ref={guideRefs.victimSection} collapsable={false} style={styles.sectionCard}>
            <View style={styles.boxHeader}>
              <TagInfoIcon size={15} color="#6824D6" />
              <Text style={styles.boxHeaderText}>
                1. QUAL O TIPO DE VÍTIMA?
              </Text>
            </View>

            <View ref={guideRefs.victimGrid} collapsable={false} style={styles.victimGrid}>
              {VICTIM_TILES.map((tile) => {
                const selected = selectedVictimKey === tile.key;
                const done = Boolean(victimSaved[tile.key]);
                return (
                  <Pressable
                    key={tile.key}
                    accessibilityRole="button"
                    accessibilityLabel={tile.label}
                    accessibilityHint="Toque para preencher ou mantenha pressionado para saber mais."
                    accessibilityState={{ selected }}
                    onPress={() => openVictimForm(tile.key, false)}
                    onLongPress={() =>
                      onOpenVictimInfo(
                        tile.label,
                        VICTIM_DESCRIPTIONS[tile.key] || '',
                      )
                    }
                    delayLongPress={500}
                    style={({ pressed }) => [
                      styles.victimTile,
                      selected && styles.victimTileSelected,
                      pressed && (selected ? styles.victimTileSelectedPressed : styles.victimTilePressed),
                      pressed && highContrast && styles.victimTileHighContrastPressed,
                    ]}
                  >
                    {done && (
                      <View style={styles.tileDoneBadge}>
                        <CheckIcon size={12} color="#FFFFFF" strokeWidth={3} />
                      </View>
                    )}
                    <VictimIconByKey
                      victimKey={tile.key}
                      size={28}
                      color={selected ? '#FFFFFF' : '#6824D6'}
                    />
                    <Text
                      style={[
                        styles.victimLabel,
                        selected && styles.victimLabelSelected,
                      ]}
                    >
                      {tile.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          {/* Step 2: Georreferenciamento e Foto */}
          <View
            style={styles.sectionCard}
            onLayout={(e) => {
              stepGeoYRef.current = e.nativeEvent.layout.y;
            }}
          >
            <View style={styles.boxHeader}>
              <GalleryImageIcon size={15} color="#6824D6" />
              <Text style={styles.boxHeaderText}>
                2. GEORREFERENCIAMENTO E FOTO
              </Text>
            </View>

            <Pressable
              ref={guideRefs.gpsSection}
              collapsable={false}
              onPress={handleCaptureGps}
              disabled={isGpsLoading}
              style={({ pressed }) => [
                styles.gpsBtn,
                isGpsDone && styles.gpsBtnDone,
                isGpsLoading && { opacity: 0.8 },
                pressed && !isGpsLoading && { opacity: 0.9 },
              ]}
            >
              <View style={styles.gpsIconWrap}>
                <CrosshairGpsIcon
                  size={20}
                  color={isGpsDone ? '#047857' : '#6824D6'}
                />
              </View>
              <View style={styles.gpsTextContent}>
                <Text
                  style={[styles.gpsTitle, isGpsDone && styles.gpsTitleDone]}
                >
                  {isGpsLoading
                    ? 'Obtendo sua localização...'
                    : isGpsDone
                    ? 'Coordenadas GPS gravadas com sucesso'
                    : 'Capturar coordenadas GPS'}
                </Text>
                <Text style={[styles.gpsSub, isGpsDone && styles.gpsSubDone]}>
                  {isGpsLoading
                    ? 'Aguardando autorização e coordenadas do aparelho'
                    : isGpsDone
                    ? gpsState.subtitle
                    : 'Toque para gravar a posição via satélite'}
                </Text>
              </View>
            </Pressable>

            <GpsMapPreview
              visible={isGpsDone}
              lat={gpsState?.lat}
              lng={gpsState?.lng}
              reduceMotion={reduceMotion}
            />

            <View style={styles.mediaRow}>
              <Pressable
                onPress={() => handlePickPhoto('camera')}
                style={({ pressed }) => [
                  styles.mediaCardBtn,
                  pressed && styles.mediaCardBtnPressed,
                ]}
              >
                <CameraIcon size={17} color="#6824D6" />
                <Text style={styles.mediaCardBtnText}>Câmera</Text>
              </Pressable>
              <Pressable
                onPress={() => handlePickPhoto('gallery')}
                style={({ pressed }) => [
                  styles.mediaCardBtn,
                  pressed && styles.mediaCardBtnPressed,
                ]}
              >
                <GalleryImageIcon size={17} color="#6824D6" />
                <Text style={styles.mediaCardBtnText}>Galeria</Text>
              </Pressable>
            </View>
            <AnimatedField visible={Boolean(photoState)} reduceMotion={reduceMotion}>
              <View style={{ marginTop: 12 }}>
                <Image source={{ uri: photoState?.uri || photoState?.dataUrl }} style={{ width: '100%', height: 170, borderRadius: 12 }} resizeMode="contain" accessibilityLabel="Fotografia anexada" />
                <Pressable onPress={() => setPhotoState(null)} style={[styles.mediaCardBtn, { marginTop: 12 }]}><Text style={styles.mediaCardBtnText}>Remover fotografia</Text></Pressable>
              </View>
            </AnimatedField>
            <Text style={{fontSize:11,color:'#796E92',marginTop:8}}>Novas fotos ficam somente neste celular nesta versão.</Text>
          </View>

          {/* Step 3: Dados do Local e Data */}
          <View style={styles.sectionCard}>
            <View style={styles.boxHeader}>
              <MapPinStandardIcon size={15} color="#6824D6" />
              <Text style={styles.boxHeaderText}>
                3. DADOS DO LOCAL E DATA
              </Text>
            </View>

            <View ref={guideRefs.formSection} collapsable={false} style={styles.fieldBlock}>
              <Text style={styles.fieldLabel}>Data da mordedura</Text>
              <Pressable
                onPress={onOpenCalendarForNew}
                style={[
                  styles.selectTrigger,
                  isCalendarOpenForNew && styles.selectTriggerOpen,
                ]}
              >
                <Text
                  style={[
                    styles.selectTriggerText,
                    !dateState?.display && styles.placeholderText,
                  ]}
                >
                  {dateState?.display || 'Selecionar data no calendário'}
                </Text>
                <CalendarIcon size={18} color="#6824D6" />
              </Pressable>
            </View>

            <View style={styles.fieldBlock}>
              <Text style={styles.fieldLabel}>Município da ocorrência</Text>
              <TextInput
                ref={cityInputRef}
                accessibilityLabel="Município da ocorrência"
                style={[
                  styles.textInput,
                  focusedInput === 'new_city' && styles.textInputFocused,
                  cityError && styles.inputError,
                ]}
                value={city}
                onChangeText={(txt) => {
                  setCity(txt);
                  if (cityError && txt.trim()) setCityError(false);
                }}
                onFocus={() => setFocusedInput('new_city')}
                onBlur={() => setFocusedInput(null)}
                placeholder="Ex.: Curuçá"
                placeholderTextColor="#796E92"
              />
              {cityError ? (
                <Text style={styles.errorText}>
                  Informe o município da ocorrência.
                </Text>
              ) : null}
            </View>

            <View style={[styles.fieldBlock, { marginBottom: 0 }]}>
              <View style={styles.labelRowBetween}>
                <Text style={[styles.fieldLabel, { marginBottom: 0 }]}>
                  Localidade / Comunidade
                </Text>
                <Text style={styles.optionalTag}>Opcional</Text>
              </View>
              <TextInput
                style={[
                  styles.textInput,
                  focusedInput === 'new_community' && styles.textInputFocused,
                ]}
                value={community}
                accessibilityLabel="Localidade ou comunidade"
                onChangeText={setCommunity}
                onFocus={() => setFocusedInput('new_community')}
                onBlur={() => setFocusedInput(null)}
                placeholder="Ex.: Vila Lauro Sodré"
                placeholderTextColor="#796E92"
              />
            </View>
          </View>

          <Pressable
            onPress={handleSaveRecordPress}
            disabled={saving}
            style={({ pressed }) => [
              styles.primaryBtn,
              pressed && styles.primaryBtnPressed,
            ]}
          >
            <Text style={styles.primaryBtnText}>{saving ? 'Salvando...' : 'Salvar registro'}</Text>
          </Pressable>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#F8F7FC',
  },
  scrollOuterContent: {
    paddingBottom: MAIN_BOTTOM_PADDING,
  },
  subHeader: {
    paddingTop: 14,
    paddingHorizontal: 16,
    paddingBottom: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#EFE9FE',
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#DFD2FA',
    backgroundColor: '#F6F3FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  backBtnPressed: {
    backgroundColor: '#EFE9FE',
    transform: [{ scale: 0.96 }],
  },
  subTitle: {
    fontSize: 17,
    fontFamily: 'PlusJakartaSans-Bold',
    color: '#181126',
    includeFontPadding: false,
  },
  scroll: {
    flex: 1,
  },
  content: {
    paddingTop: 16,
    paddingHorizontal: 18,
  },
  vfContent: {
    paddingTop: 16,
    paddingHorizontal: 18,
    paddingBottom: VICTIM_BOTTOM_PADDING,
  },
  reporterCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#EAE5F5',
    marginBottom: 14,
    overflow: 'hidden',
  },
  reporterTop: {
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  reporterBadge: {
    width: 42,
    height: 42,
    borderRadius: 11,
    backgroundColor: '#6824D6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  reporterBadgeText: {
    fontSize: 14,
    fontFamily: 'PlusJakartaSans-ExtraBold',
    color: '#FFFFFF',
    includeFontPadding: false,
  },
  reporterMeta: {
    flex: 1,
  },
  reporterName: {
    fontSize: 14,
    fontFamily: 'PlusJakartaSans-Bold',
    color: '#181126',
    includeFontPadding: false,
  },
  reporterRole: {
    fontSize: 12,
    fontFamily: 'PlusJakartaSans-SemiBold',
    color: '#6824D6',
    marginTop: 2,
    includeFontPadding: false,
  },
  reporterEditBtn: {
    width: '100%',
    height: 38,
    backgroundColor: '#F6F3FF',
    borderTopWidth: 1,
    borderTopColor: '#EFE9FE',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  reporterEditBtnText: {
    fontSize: 12,
    fontFamily: 'PlusJakartaSans-Bold',
    color: '#5316B8',
    includeFontPadding: false,
  },
  sectionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#EAE5F5',
  },
  boxHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    marginBottom: 12,
  },
  boxHeaderText: {
    fontSize: 12,
    fontFamily: 'PlusJakartaSans-ExtraBold',
    color: '#6824D6',
    letterSpacing: 0.4,
    includeFontPadding: false,
  },
  victimGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  victimTile: {
    width: '48%',
    minHeight: 96,
    borderRadius: 14,
    paddingVertical: 16,
    paddingHorizontal: 10,
    borderWidth: 1.5,
    borderColor: '#DFD2FA',
    backgroundColor: '#F6F3FF',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    position: 'relative',
  },
  victimTileSelected: {
    borderColor: '#5316B8',
    backgroundColor: '#6824D6',
    elevation: 4,
    shadowColor: '#6824D6',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 14,
  },
  victimTilePressed: {
    backgroundColor: '#DDD3FA',
    borderColor: '#6D28D9',
  },
  victimTileSelectedPressed: {
    backgroundColor: '#4C1D95',
    borderColor: '#4C1D95',
  },
  victimTileHighContrastPressed: {
    backgroundColor: '#FFD700',
    borderColor: '#FFD700',
  },
  tileDoneBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 20,
    height: 20,
    borderRadius: 999,
    backgroundColor: '#047857',
    alignItems: 'center',
    justifyContent: 'center',
  },
  victimLabel: {
    fontSize: 13,
    fontFamily: 'PlusJakartaSans-Bold',
    color: '#181126',
    textAlign: 'center',
    includeFontPadding: false,
  },
  victimLabelSelected: {
    color: '#FFFFFF',
  },
  gpsBtn: {
    width: '100%',
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderRadius: 14,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: '#6824D6',
    backgroundColor: '#F6F3FF',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  gpsBtnDone: {
    borderStyle: 'solid',
    borderColor: '#047857',
    backgroundColor: '#ECFDF5',
  },
  gpsIconWrap: {
    width: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  gpsTextContent: {
    flex: 1,
  },
  gpsTitle: {
    fontSize: 13,
    fontFamily: 'PlusJakartaSans-Bold',
    color: '#5316B8',
    includeFontPadding: false,
  },
  gpsTitleDone: {
    color: '#047857',
  },
  gpsSub: {
    fontSize: 11.5,
    fontFamily: 'PlusJakartaSans-Medium',
    color: '#5E5473',
    marginTop: 2,
    includeFontPadding: false,
  },
  gpsSubDone: {
    fontFamily: 'PlusJakartaSans-Bold',
    color: '#181126',
  },
  mediaRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 12,
  },
  mediaCardBtn: {
    flex: 1,
    height: 44,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: '#DFD2FA',
    backgroundColor: '#FFFFFF',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  mediaCardBtnPressed: {
    borderColor: '#6824D6',
    backgroundColor: '#F6F3FF',
  },
  mediaCardBtnText: {
    fontSize: 13,
    fontFamily: 'PlusJakartaSans-Bold',
    color: '#5316B8',
    includeFontPadding: false,
  },
  vfGroupCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#EAE5F5',
  },
  vfGroupTitle: {
    fontSize: 12,
    fontFamily: 'PlusJakartaSans-ExtraBold',
    color: '#6824D6',
    letterSpacing: 0.4,
    marginBottom: 12,
    includeFontPadding: false,
  },
  fieldBlock: {
    marginBottom: 12,
  },
  vfFieldBlock: {
    marginTop: 12,
  },
  vfFirstField: {
    marginTop: 0,
  },
  labelRowBetween: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  fieldLabel: {
    fontSize: 13,
    fontFamily: 'PlusJakartaSans-Bold',
    color: '#181126',
    marginBottom: 6,
    includeFontPadding: false,
  },
  optionalTag: {
    fontSize: 11,
    fontFamily: 'PlusJakartaSans-SemiBold',
    color: '#796E92',
    includeFontPadding: false,
  },
  textInput: {
    width: '100%',
    height: 46,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#431682',
    backgroundColor: '#FFFFFF',
    fontSize: 14,
    fontFamily: 'PlusJakartaSans-Medium',
    color: '#181126',
    includeFontPadding: false,
  },
  textInputFocused: {
    borderColor: '#6824D6',
  },
  selectTrigger: {
    width: '100%',
    height: 46,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#431682',
    backgroundColor: '#FFFFFF',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  selectTriggerOpen: {
    borderColor: '#6824D6',
    backgroundColor: '#FAF8FF',
  },
  selectTriggerText: {
    flex: 1,
    fontSize: 14,
    fontFamily: 'PlusJakartaSans-Medium',
    color: '#181126',
    includeFontPadding: false,
  },
  placeholderText: {
    color: '#796E92',
  },
  inputError: {
    borderColor: '#C82333',
    backgroundColor: '#FFFBFB',
  },
  errorText: {
    fontSize: 12,
    fontFamily: 'PlusJakartaSans-SemiBold',
    color: '#C82333',
    marginTop: 5,
    includeFontPadding: false,
  },
  primaryBtn: {
    width: '100%',
    height: 50,
    borderRadius: 14,
    backgroundColor: '#6824D6',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
    shadowColor: '#6824D6',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 14,
  },
  primaryBtnPressed: {
    backgroundColor: '#5316B8',
    transform: [{ scale: 0.99 }],
  },
  primaryBtnText: {
    fontSize: 15,
    fontFamily: 'PlusJakartaSans-Bold',
    color: '#FFFFFF',
    includeFontPadding: false,
  },
});
