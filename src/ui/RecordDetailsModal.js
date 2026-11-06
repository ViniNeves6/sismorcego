import { Animated, Pressable, ScrollView, Text, TextInput, View } from './AccessibleNative';
import { captureGpsLocation, pickRegistroPhoto } from '../services/deviceCapture';
import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { BackHandler, Easing, Image, StyleSheet } from 'react-native';
import {
  CalendarIcon,
  ChevronDownIcon,
  CloseIcon,
  VictimIconByKey,
} from './SismorcegoIcons';
import GpsMapPreview from './GpsMapPreview';
import AnimatedField from './AnimatedField';
import RecordAuditTrail from './RecordAuditTrail';
import ScrollViewWithScrollbar from './ScrollViewWithScrollbar';
import useFadeCompositing from './useFadeCompositing';
import useReduceMotion from './useReduceMotion';
import useSpeakOnMount from '../hooks/useSpeakOnMount';
import { describeRecord, sentences } from '../services/accessibilityDescriptions';
import {
  VICTIM_FORMS,
  VICTIM_META,
  clearHiddenVictimFields,
  getFilledVictimDetailItems,
  isVictimFieldVisible,
  parseBrDate,
  validateVictimFields,
} from '../services/sismorcegoData';
import { reverseGeocodeMunicipio } from '../services/geocoding';
import { gpsAccuracy, isValidGpsCoordinates } from '../services/gpsCoordinates';
import { isCancelledRecord } from '../services/recordLifecycle';
import { toRecordView } from '../services/registroAdapter';
import { hasRecordEditChanges } from '../services/editChanges';

const VICTIM_OPTIONS = [
  { key: 'humano', label: 'Humano' },
  { key: 'canino', label: 'Canino / Felino' },
  { key: 'aves', label: 'Aves' },
  { key: 'producao', label: 'Animal de produção' },
];

export default function RecordDetailsModal({
  visible,
  record: requestedRecord,
  onClose,
  onSaveRecord,
  onDeleteRecord,
  onExportPdf,
  onExited,
  onUseServerRecord,
  canEdit = false,
  onOpenBottomSheet,
  activeSheetFieldKey,
  onOpenCalendar,
  isCalendarOpenForEditor,
  showToast,
  reduceMotion: reduceMotionProp = false,
}) {
  const systemReduceMotion = useReduceMotion();
  const reduceMotion = reduceMotionProp || systemReduceMotion;
  const retainedRecord = useRef(requestedRecord);
  const record = visible ? requestedRecord : retainedRecord.current || requestedRecord;
  useLayoutEffect(() => { if (visible && requestedRecord) retainedRecord.current = requestedRecord; }, [visible, requestedRecord]);
  const [rendered, setRendered] = useState(visible);
  const [layoutReady, setLayoutReady] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [cancellationReason, setCancellationReason] = useState('');
  canEdit = canEdit && !isCancelledRecord(record || {}) && record?._raw?.syncConflict?.serverRecord?.lifecycleStatus !== 'cancelled';

  const [draft, setDraft] = useState(null);
  const [detailsByType, setDetailsByType] = useState({
    humano: {},
    canino: {},
    aves: {},
    producao: {},
  });
  const [fieldErrors, setFieldErrors] = useState({});
  const [gpsLoading, setGpsLoading] = useState(false);
  const [focusedField, setFocusedField] = useState(null);
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);

  const dialogAnim = useRef(new Animated.Value(0)).current;
  const visibility = useRef(visible);
  visibility.current = visible;
  const modeTransition = useRef(null);
  const modeRequest = useRef(null);
  const exitCallback = useRef(onExited);
  exitCallback.current = onExited;
  const deleteAnim = useRef(new Animated.Value(0)).current;
  const dialogCompositing = useFadeCompositing(dialogAnim, visible ? 1 : 0, reduceMotion, `${visible}-${editMode}`);
  const deleteCompositing = useFadeCompositing(deleteAnim, deleteDialogOpen ? 1 : 0, reduceMotion);
  const scrollRef = useRef(null);

  const initDraftFromRecord = useCallback((rec) => {
    if (!rec) return;
    const vKey = rec.victimKey || 'humano';
    const cleanDetails = clearHiddenVictimFields(vKey, {
      ...(rec.details || {}),
    });
    const parsedDate = parseBrDate(rec.date || '');
    setDraft({
      id: rec.id,
      status: rec.status,
      statusLabel: rec.statusLabel,
      victimKey: vKey,
      title: (VICTIM_META[vKey] || VICTIM_META.humano).title,
      reporter: rec.reporter || '',
      city: rec.city || '',
      community: rec.community || '',
      date: parsedDate ? parsedDate.display : rec.date || '',
      isoDate: rec.isoDate || (parsedDate ? parsedDate.iso : ''),
      gps: rec.gps ? { ...rec.gps } : null,
      photo: rec.photo ? { ...rec.photo } : null,
    });
    setDetailsByType({
      humano: vKey === 'humano' ? cleanDetails : {},
      canino: vKey === 'canino' ? cleanDetails : {},
      aves: vKey === 'aves' ? cleanDetails : {},
      producao: vKey === 'producao' ? cleanDetails : {},
    });
    setFieldErrors({});
    setGpsLoading(false);
  }, []);

  useLayoutEffect(() => {
    if (visible && record) {
      setEditMode(false);
      setDeleteDialogOpen(false);
      deleteAnim.setValue(0);
      initDraftFromRecord(record);
      setRendered(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, record?.id]);

  useEffect(() => {
    if (!rendered || (visible && !layoutReady && !reduceMotion)) return;
    modeTransition.current?.stop();
    modeTransition.current = null;
    const pendingMode = modeRequest.current;
    modeRequest.current = null;
    if (visible && reduceMotion && pendingMode !== null) {
      if (pendingMode) initDraftFromRecord(retainedRecord.current);
      setEditMode(pendingMode);
    }
    const finishExit = () => {
      setRendered(false);
      setLayoutReady(false);
      setDeleteDialogOpen(false);
      exitCallback.current?.();
    };
    if (reduceMotion || (!visible && !layoutReady)) {
      dialogAnim.setValue(visible ? 1 : 0);
      if (!visible) finishExit();
      return;
    }
    let cancelled = false;
    const transition = Animated.timing(dialogAnim, {
      toValue: visible ? 1 : 0,
      duration: visible ? 320 : 220,
      easing: visible ? Easing.bezier(0.2, 0, 0, 1) : Easing.bezier(0.4, 0, 1, 1),
      useNativeDriver: true,
    });
    transition.start(({ finished }) => { if (finished && !cancelled && !visible) finishExit(); });
    return () => {
      cancelled = true;
      transition.stop();
      modeTransition.current?.stop();
      modeTransition.current = null;
    };
  }, [visible, rendered, layoutReady, reduceMotion, dialogAnim, initDraftFromRecord]);

  // Expose date update helper when calendar selects date for editor
  useEffect(() => {
    if (record && record._editorSelectedDate && editMode) {
      setDraft((prev) =>
        prev
          ? {
              ...prev,
              date: record._editorSelectedDate.display,
              isoDate: record._editorSelectedDate.iso,
            }
          : prev,
      );
      setFieldErrors((prev) => ({ ...prev, date: null }));
    }
  }, [record, editMode]);

  const transitionDialogMode = useCallback((nextEditMode) => {
    if (nextEditMode && !canEdit) return;
    modeTransition.current?.stop();
    modeRequest.current = nextEditMode;
    if (reduceMotion) {
      if (nextEditMode) {
        initDraftFromRecord(record);
      }
      setEditMode(nextEditMode);
      modeRequest.current = null;
      scrollRef.current?.scrollTo({ y: 0, animated: false });
      return;
    }

    const transition = Animated.timing(dialogAnim, {
      toValue: 0,
      duration: 80,
      easing: Easing.bezier(0.22, 0.82, 0.25, 1),
      useNativeDriver: true,
    });
    modeTransition.current = transition;
    transition.start(({ finished }) => {
      if (!finished || modeTransition.current !== transition || !visibility.current) return;
      modeRequest.current = null;
      if (nextEditMode) {
        initDraftFromRecord(record);
      }
      setEditMode(nextEditMode);
      scrollRef.current?.scrollTo({ y: 0, animated: false });
      modeTransition.current = Animated.timing(dialogAnim, {
        toValue: 1,
        duration: 140,
        easing: Easing.bezier(0.22, 0.82, 0.25, 1),
        useNativeDriver: true,
      });
      modeTransition.current.start();
    });
  }, [reduceMotion, initDraftFromRecord, record, dialogAnim, canEdit]);

  const openDeleteConfirm = () => {
    if (!canEdit) return;
    setCancellationReason('');
    setDeleteDialogOpen(true);
    if (reduceMotion) {
      deleteAnim.setValue(1);
    } else {
      Animated.timing(deleteAnim, {
        toValue: 1,
        duration: 220,
        easing: Easing.bezier(0.22, 0.82, 0.25, 1),
        useNativeDriver: true,
      }).start();
    }
  };

  const closeDeleteConfirm = useCallback(() => {
    if (reduceMotion) {
      deleteAnim.setValue(0);
      setDeleteDialogOpen(false);
    } else {
      Animated.timing(deleteAnim, {
        toValue: 0,
        duration: 180,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      }).start(({ finished }) => {
        if (finished) setDeleteDialogOpen(false);
      });
    }
  }, [reduceMotion, deleteAnim]);

  useEffect(() => {
    if (!visible) return;
    const listener = BackHandler.addEventListener('hardwareBackPress', () => {
      if (deleteDialogOpen) closeDeleteConfirm();
      else if (editMode) transitionDialogMode(false);
      else onClose?.();
      return true;
    });
    return () => listener.remove();
  }, [visible, deleteDialogOpen, editMode, closeDeleteConfirm, transitionDialogMode, onClose]);

  useSpeakOnMount(sentences(editMode ? 'Modificar registro' : 'Detalhes do registro', describeRecord(record),
    !editMode && record ? getFilledVictimDetailItems(record.victimKey, record.details).map(item => `${item.label}: ${item.value}`) : '',
    editMode ? 'Preencha os campos. Você pode cancelar ou salvar as alterações' : canEdit ? 'Gerar ficha em PDF, cancelar ocorrência ou editar' : 'Registro disponível para consulta'),
  { active: visible && rendered && (layoutReady || reduceMotion), priority: 20 });
  useSpeakOnMount('Cancelar ocorrência. A ocorrência será preservada no histórico. Informe o motivo do cancelamento e escolha Cancelar ou Confirmar cancelamento',
    { active: visible && deleteDialogOpen, priority: 30 });
  if (!rendered || !record) return null;

  const activeVictimKey = draft?.victimKey || record.victimKey || 'humano';
  const activeDetails = detailsByType[activeVictimKey] || {};
  const serverVersion = record?._raw?.syncConflict?.serverRecord;
  const editBaseline = serverVersion ? toRecordView({ ...record._raw, ...serverVersion }) : record;
  const editionChanged = Boolean(draft && editBaseline && hasRecordEditChanges(
    { ...editBaseline, details: clearHiddenVictimFields(editBaseline.victimKey || 'humano', editBaseline.details || {}) },
    { ...draft, details: clearHiddenVictimFields(activeVictimKey, activeDetails) },
  ));

  const handleSelectVictimType = (newKey) => {
    if (!draft || newKey === draft.victimKey) return;
    setDraft((prev) => ({
      ...prev,
      victimKey: newKey,
      title: (VICTIM_META[newKey] || VICTIM_META.humano).title,
    }));
    setFieldErrors({});
  };

  const handleUpdateVictimField = (fieldKey, value) => {
    setDetailsByType((prev) => {
      const updated = clearHiddenVictimFields(activeVictimKey, {
        ...(prev[activeVictimKey] || {}),
        [fieldKey]: value,
      });
      return {
        ...prev,
        [activeVictimKey]: updated,
      };
    });
    setFieldErrors((prev) => ({ ...prev, [`vf_${fieldKey}`]: null }));
  };

  const applyEditorGpsCoords = async (lat, lng, acc, metadata = {}) => {
    const accText = acc != null ? ` (±${Math.round(acc)}m)` : '';
    const approximate = metadata.isHighAccuracy === false;
    const coordsText = `${lat.toFixed(5)}, ${lng.toFixed(5)}${accText}${approximate ? ' · Aproximada' : ''}`;
    setGpsLoading(false);
    setDraft((prev) =>
      prev
        ? {
            ...prev,
            gps: {
              lat,
              lng,
              accuracy: acc,
              source: metadata.source,
              isHighAccuracy: metadata.isHighAccuracy,
              text: coordsText,
            },
          }
        : prev,
    );
    showToast?.(approximate ? 'Localização aproximada registrada. Para mais precisão, tente novamente em área aberta.' : 'Coordenadas GPS atualizadas!');

    try {
      const geocoded = await reverseGeocodeMunicipio(lat, lng);
      const cityToUse = geocoded;
      if (cityToUse) {
        setDraft((prev) =>
          prev && !prev.city.trim() ? { ...prev, city: cityToUse } : prev,
        );
      }
    } catch (e) {
      // Coordenadas reais permanecem válidas mesmo sem geocodificação.
    }
  };

  const handleCaptureEditorGps = async () => {
    if (gpsLoading) return;
    setGpsLoading(true);
    try {
      const coords = await captureGpsLocation();
      await applyEditorGpsCoords(coords.lat, coords.lng, coords.accuracy, coords);
    } catch (error) {
      setGpsLoading(false);
      showToast?.(error.message);
    }
  };

  const handleRemoveEditorGps = () => {
    if (!draft?.gps) return;
    setDraft((prev) => (prev ? { ...prev, gps: null } : prev));
    showToast?.('Coordenadas GPS removidas.');
  };

  const handlePickEditorPhoto = async (source) => {
    try {
      const photo = await pickRegistroPhoto(source);
      if (!photo) return;
      setDraft(prev => prev ? { ...prev, photo } : prev);
      showToast?.(photo.notice?.message || 'Fotografia anexada ao registro.');
    } catch (error) {
      showToast?.(error.message || 'Não foi possível anexar a fotografia.');
    }
  };
  const handleRemoveEditorPhoto = () => {
    if (!draft?.photo) return;
    setDraft((prev) => (prev ? { ...prev, photo: null } : prev));
    showToast?.('Fotografia removida.');
  };

  const handleSaveEdition = async () => {
    if (!canEdit) { showToast?.('Esta ocorrência está disponível somente para consulta.'); return; }
    if (!draft || busyRef.current || !editionChanged) return;
    const nextErrors = {};
    const rep = String(record.reporter || '');
    const dt = String(draft.date || '').trim();
    const ct = String(draft.city || '').trim();
    const parsedDt = parseBrDate(dt);

    if (!dt || !parsedDt) {
      nextErrors.date = 'Selecione a data da ocorrência.';
    }
    if (!ct) {
      nextErrors.city = 'Informe o município da ocorrência.';
    }

    const cleanedDetails = clearHiddenVictimFields(
      activeVictimKey,
      activeDetails,
    );
    const vfValidation = validateVictimFields(activeVictimKey, cleanedDetails);
    if (!vfValidation.valid) {
      Object.entries(vfValidation.errors).forEach(([k, msg]) => {
        nextErrors[`vf_${k}`] = msg;
      });
    }

    if (Object.keys(nextErrors).length > 0) {
      setFieldErrors(nextErrors);
      showToast?.('Preencha os campos obrigatórios destacados');
      return;
    }

    const updatedRecord = {
      ...record,
      victimKey: activeVictimKey,
      title: (VICTIM_META[activeVictimKey] || VICTIM_META.humano).title,
      reporter: rep,
      city: ct,
      community: String(draft.community || '').trim(),
      date: parsedDt.display,
      isoDate: parsedDt.iso,
      gps: draft.gps ? { ...draft.gps } : null,
      photo: draft.photo ? { ...draft.photo } : null,
      details: cleanedDetails,
    };

    busyRef.current = true;
    setBusy(true);
    try { await onSaveRecord(updatedRecord); }
    catch (error) { showToast?.(error.message || 'Não foi possível salvar as alterações.'); }
    finally { busyRef.current = false; setBusy(false); }
  };

  const translateY = dialogAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [24, 0],
  });
  const scale = dialogAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.985, 1],
  });

  const deleteTranslateY = deleteAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [14, 0],
  });
  const deleteScale = deleteAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.98, 1],
  });

  const filledDetailItems = getFilledVictimDetailItems(
    record.victimKey,
    record.details,
  );
  const victimForm = VICTIM_FORMS[activeVictimKey];
  const hasEditorGps = isValidGpsCoordinates(draft?.gps?.lat, draft?.gps?.lng);
  const editorGpsAccuracy = gpsAccuracy(draft?.gps?.accuracy);

  return (
    <>
      <Animated.View
        testID="record-details-overlay"
        {...dialogCompositing}
        style={[styles.overlay, { opacity: dialogAnim }]}
        pointerEvents={visible ? 'auto' : 'none'}
        accessibilityViewIsModal
        accessibilityElementsHidden={!visible}
        importantForAccessibility={visible ? 'auto' : 'no-hide-descendants'}
      >
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityRole="button" accessibilityLabel="Fechar detalhes pelo fundo" />
        <Animated.View
          testID="record-details-dialog"
          onLayout={() => { if (visibility.current) setLayoutReady(true); }}
          style={[
            styles.dialog,
            {
              transform: [{ translateY }, { scale }],
            },
          ]}
        >
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.headerTitle}>
              {editMode ? 'Modificar registro' : 'Detalhes do registro'}
            </Text>
            <Pressable
              onPress={onClose}
              accessibilityRole="button"
              accessibilityLabel="Fechar detalhes do registro"
              style={({ pressed }) => [
                styles.closeBtn,
                pressed && { opacity: 0.75 },
              ]}
            >
              <CloseIcon size={16} color="#5E5473" />
            </Pressable>
          </View>

          {/* Body */}
          <ScrollViewWithScrollbar
            ref={scrollRef}
            style={styles.bodyScroll}
            contentContainerStyle={styles.bodyContent}
            showScrollbar={editMode}
            reduceMotion={reduceMotion}
            keyboardShouldPersistTaps="handled"
          >
            {record._raw?.syncConflict && (
              <View style={{backgroundColor:'#FFF8E1',padding:12,borderRadius:12,marginBottom:12,gap:8}}>
                <Text style={styles.fieldLabel}>Registro alterado em outro aparelho</Text>
                <Text>{record._raw.syncConflict.serverRecord?.lifecycleStatus === 'cancelled'
                  ? 'A ocorrência foi cancelada no servidor. Você pode carregar essa versão e preservar suas alterações anteriores no aparelho.'
                  : 'Revise os campos antes de salvar. Ao salvar novamente, você confirma estas alterações sobre a versão do servidor consultada. A cópia local continua preservada.'}</Text>
                {!editMode && onUseServerRecord && <Pressable disabled={busy} accessibilityRole="button" onPress={async()=>{
                  if(busyRef.current)return;
                  busyRef.current=true;setBusy(true);
                  try{await onUseServerRecord();}catch(error){showToast?.(error.message);}
                  finally{busyRef.current=false;setBusy(false);}
                }}><Text style={styles.secondaryBtnText}>Usar versão do servidor e preservar cópia local</Text></Pressable>}
              </View>
            )}
            {!editMode ? (
              /* DETAILS VIEW */
              <View>
                <View style={styles.statusRow}>
                  <View
                    style={[
                      styles.recordTag,
                      record.status !== 'synced'
                        ? styles.recordTagPending
                        : styles.recordTagSynced,
                    ]}
                  >
                    <View
                      style={[
                        styles.tagDot,
                        {
                          backgroundColor:
                            record.status !== 'synced' ? '#B45309' : '#047857',
                        },
                      ]}
                    />
                    <Text
                      style={[
                        styles.recordTagText,
                        record.status !== 'synced'
                          ? styles.recordTagTextPending
                          : styles.recordTagTextSynced,
                      ]}
                    >
                      {record.statusLabel}
                    </Text>
                  </View>
                </View>

                <View style={styles.detailGrid}>
                  {isCancelledRecord(record) && record.cancellation && <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Cancelamento</Text>
                    <Text style={styles.detailValue}>{record.cancellation.reason}</Text>
                    <Text style={styles.detailValue}>{[record.cancellation.actorName || record.cancellation.actorUid,
                      record.cancellation.clientAt ? new Date(record.cancellation.clientAt).toLocaleString('pt-BR') : null].filter(Boolean).join(' — ')}</Text>
                  </View>}
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Tipo de vítima</Text>
                    <Text style={styles.detailValue}>
                      {(VICTIM_META[record.victimKey] || {}).typeLabel ||
                        record.title}
                    </Text>
                  </View>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>
                      Responsável pelo registro
                    </Text>
                    <Text style={styles.detailValue}>
                      {record.reporter || 'Não informado'}
                    </Text>
                  </View>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Data da ocorrência</Text>
                    <Text style={styles.detailValue}>
                      {record.date || 'Não informada'}
                    </Text>
                  </View>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Município</Text>
                    <Text style={styles.detailValue}>
                      {record.city || 'Não informado'}
                    </Text>
                  </View>
                  <View style={[styles.detailRow, styles.detailRowLast]}>
                    <Text style={styles.detailLabel}>
                      Localidade / Comunidade
                    </Text>
                    <Text style={styles.detailValue}>
                      {record.community ? record.community : 'Não informado'}
                    </Text>
                  </View>
                </View>

                {record.gps?.text ? (
                  <View style={styles.detailSection}>
                    <Text style={styles.detailSectionTitle}>
                      GEORREFERENCIAMENTO
                    </Text>
                    <View style={styles.detailGrid}>
                      <View style={[styles.detailRow, styles.detailRowLast]}>
                        <Text style={styles.detailLabel}>Coordenadas</Text>
                        <Text style={styles.detailValue}>
                          {record.gps.text}
                        </Text>
                      </View>
                    </View>
                  </View>
                ) : null}

                {record.photo?.dataUrl ? (
                  <View style={styles.detailSection}>
                    <Text style={styles.detailSectionTitle}>FOTOGRAFIA</Text>
                    <Image
                      source={{ uri: record.photo.dataUrl }}
                      style={styles.detailPhoto}
                      resizeMode="cover"
                    />
                  </View>
                ) : null}

                {filledDetailItems.length > 0 ? (
                  <View style={styles.detailSection}>
                    <Text style={styles.detailSectionTitle}>
                      DADOS DA VÍTIMA
                    </Text>
                    <View style={styles.detailGrid}>
                      {filledDetailItems.map((item, idx) => (
                        <View
                          key={item.key}
                          style={[
                            styles.detailRow,
                            idx === filledDetailItems.length - 1 &&
                              styles.detailRowLast,
                          ]}
                        >
                          <Text style={styles.detailLabel}>{item.label}</Text>
                          <Text style={styles.detailValue}>{item.value}</Text>
                        </View>
                      ))}
                    </View>
                  </View>
                ) : null}
                <RecordAuditTrail record={record} />
              </View>
            ) : (
              /* MODIFICAR REGISTRO VIEW */
              <View>
                {/* Responsável pelo registro */}
                <View style={styles.editGroup}>
                  <Text style={styles.editGroupTitle}>
                    RESPONSÁVEL PELO REGISTRO
                  </Text>
                  <View style={[styles.fieldBlock, { marginBottom: 0 }]}>
                    <Text style={styles.fieldLabel}>
                      Nome completo <Text style={styles.reqStar}>*</Text>
                    </Text>
                    <TextInput
                      style={[
                        styles.textInput,
                        focusedField === 'reporter' && styles.textInputFocused,
                        fieldErrors.reporter && styles.textInputError,
                      ]}
                      value={draft?.reporter || ''}
                      editable={false}
                      accessibilityLabel="Responsável original pelo registro"
                      onFocus={() => setFocusedField('reporter')}
                      onBlur={() => setFocusedField(null)}
                      placeholder="Ex.: Agente de Saúde"
                      placeholderTextColor="#796E92"
                    />
                    {fieldErrors.reporter ? (
                      <Text style={styles.errorText}>
                        {fieldErrors.reporter}
                      </Text>
                    ) : null}
                  </View>
                </View>

                {/* 1. Qual o tipo de vítima? */}
                <View style={styles.editGroup}>
                  <Text style={styles.editGroupTitle}>
                    1. QUAL O TIPO DE VÍTIMA?
                  </Text>
                  <View style={styles.typeGrid}>
                    {VICTIM_OPTIONS.map((opt) => {
                      const selected = opt.key === activeVictimKey;
                      return (
                        <Pressable
                          key={opt.key}
                          onPress={() => handleSelectVictimType(opt.key)}
                          style={[
                            styles.typeOptionBtn,
                            selected && styles.typeOptionBtnSelected,
                          ]}
                        >
                          <VictimIconByKey
                            victimKey={opt.key}
                            size={18}
                            color={selected ? '#FFFFFF' : '#6824D6'}
                          />
                          <Text
                            style={[
                              styles.typeOptionLabel,
                              selected && styles.typeOptionLabelSelected,
                            ]}
                          >
                            {opt.label}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </View>

                {/* Dynamic Victim Field Groups */}
                {victimForm?.groups.map((grp) => (
                  <View key={grp.title} style={styles.editGroup}>
                    <Text style={styles.editGroupTitle}>
                      {grp.title.toUpperCase()}
                    </Text>
                    {grp.fields.map((field) => {
                      const isVis = isVictimFieldVisible(field, activeDetails);
                      const val = String(activeDetails[field.key] ?? '');
                      const errMsg = fieldErrors[`vf_${field.key}`];
                      const isSheetOpen =
                        activeSheetFieldKey === `editor_${field.key}`;

                      const isRequiredForEditor =
                        (!record?.demo ||
                          activeVictimKey !== record?.victimKey) &&
                        field.required;

                      const content = (
                        <View key={field.key} style={styles.fieldBlock}>
                          <Text style={styles.fieldLabel}>
                            {field.label}
                            {isRequiredForEditor ? (
                              <Text style={styles.reqStar}> *</Text>
                            ) : null}
                          </Text>

                          {field.type === 'select' ? (
                            <Pressable
                              onPress={() =>
                                onOpenBottomSheet({
                                  id: `editor_${field.key}`,
                                  title: field.label,
                                  options: field.options || [],
                                  selectedValue: val,
                                  onSelect: (chosen) =>
                                    handleUpdateVictimField(field.key, chosen),
                                })
                              }
                              style={[
                                styles.selectTrigger,
                                isSheetOpen && styles.selectTriggerOpen,
                                errMsg && styles.textInputError,
                              ]}
                            >
                              <Text
                                style={[
                                  styles.selectTriggerText,
                                  !val && styles.selectPlaceholderText,
                                ]}
                                numberOfLines={1}
                              >
                                {val || 'Selecione'}
                              </Text>
                              <View
                                style={{
                                  transform: [
                                    {
                                      rotate: isSheetOpen ? '180deg' : '0deg',
                                    },
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
                                focusedField === `vf_${field.key}` &&
                                  styles.textInputFocused,
                                errMsg && styles.textInputError,
                              ]}
                              value={val}
                              onChangeText={(txt) =>
                                handleUpdateVictimField(field.key, txt)
                              }
                              onFocus={() => setFocusedField(`vf_${field.key}`)}
                              onBlur={() => setFocusedField(null)}
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
                          visible={isVis}
                          reduceMotion={reduceMotion}
                        >
                          {content}
                        </AnimatedField>
                      ) : content;
                    })}
                  </View>
                ))}

                {/* 2. Georreferenciamento e Foto */}
                <View style={styles.editGroup}>
                  <Text style={styles.editGroupTitle}>
                    2. GEORREFERENCIAMENTO E FOTO
                  </Text>
                  <View style={styles.fieldBlock}>
                    <Text style={styles.fieldLabel}>Coordenadas GPS</Text>
                    <View
                      style={[
                        styles.mediaStatusBox,
                        hasEditorGps &&
                          !gpsLoading &&
                          styles.mediaStatusBoxHasData,
                        gpsLoading && styles.mediaStatusBoxLoading,
                      ]}
                    >
                      {hasEditorGps && !gpsLoading ? (
                        <>
                          <Text style={[styles.mediaStatusText, styles.mediaStatusTextHasData]}>
                            {`Coordenadas registradas: ${draft.gps.lat.toFixed(5)}, ${draft.gps.lng.toFixed(5)}`}
                          </Text>
                          {editorGpsAccuracy !== null ? (
                            <Text style={styles.gpsPrecision}>{`Precisão aproximada: ${Math.round(editorGpsAccuracy)} m`}</Text>
                          ) : draft.gps.isHighAccuracy === false ? <Text style={styles.gpsPrecision}>Localização aproximada</Text> : null}
                        </>
                      ) : (
                        <Text style={[styles.mediaStatusText, gpsLoading && styles.mediaStatusTextLoading]}>
                          {gpsLoading ? 'Obtendo coordenadas GPS do aparelho...' : 'Nenhuma coordenada GPS registrada'}
                        </Text>
                      )}
                    </View>
                    <View style={styles.mediaActionsRow}>
                      <Pressable
                        onPress={handleCaptureEditorGps}
                        style={({ pressed }) => [
                          styles.mediaBtn,
                          pressed && { opacity: 0.85 },
                        ]}
                      >
                        <Text style={styles.mediaBtnText}>
                          Capturar coordenadas GPS
                        </Text>
                      </Pressable>
                      <Pressable
                        onPress={handleRemoveEditorGps}
                        style={({ pressed }) => [
                          styles.mediaBtn,
                          pressed && { opacity: 0.85 },
                        ]}
                      >
                        <Text style={styles.mediaBtnText}>Remover GPS</Text>
                      </Pressable>
                    </View>

                    <GpsMapPreview
                      visible={Boolean(
                        draft?.gps &&
                          Number.isFinite(draft.gps.lat) &&
                          Number.isFinite(draft.gps.lng),
                      )}
                      lat={draft?.gps?.lat}
                      lng={draft?.gps?.lng}
                      reduceMotion={reduceMotion}
                    />
                  </View>

                  <View style={[styles.fieldBlock, { marginBottom: 0 }]}>
                    <Text style={styles.fieldLabel}>Fotografia</Text>
                    <Text style={styles.detailLabel}>Novas fotos ficam somente neste celular nesta versão.</Text>
                    {draft?.photo?.dataUrl ? (
                      <View style={styles.photoPreviewBox}>
                        <Image
                          source={{ uri: draft.photo.dataUrl }}
                          style={styles.photoPreviewImg}
                          resizeMode="cover"
                        />
                      </View>
                    ) : (
                      <View style={styles.mediaStatusBox}>
                        <Text style={styles.mediaStatusText}>
                          Nenhuma fotografia anexada
                        </Text>
                      </View>
                    )}

                    <View style={styles.mediaActionsRow}>
                      <Pressable
                        onPress={() => handlePickEditorPhoto('camera')}
                        style={({ pressed }) => [
                          styles.mediaBtn,
                          pressed && { opacity: 0.85 },
                        ]}
                      >
                        <Text style={styles.mediaBtnText}>Câmera</Text>
                      </Pressable>
                      <Pressable
                        onPress={() => handlePickEditorPhoto('gallery')}
                        style={({ pressed }) => [
                          styles.mediaBtn,
                          pressed && { opacity: 0.85 },
                        ]}
                      >
                        <Text style={styles.mediaBtnText}>Galeria</Text>
                      </Pressable>
                    </View>

                    <View style={styles.mediaDangerRow}>
                      <Pressable
                        disabled={!draft?.photo}
                        onPress={handleRemoveEditorPhoto}
                        style={({ pressed }) => [
                          styles.mediaDangerBtn,
                          !draft?.photo && styles.mediaBtnDisabled,
                          pressed && draft?.photo && { opacity: 0.85 },
                        ]}
                      >
                        <Text style={styles.mediaDangerBtnText}>
                          Remover foto
                        </Text>
                      </Pressable>
                    </View>
                  </View>
                </View>

                {/* 3. Dados do Local e Data */}
                <View style={[styles.editGroup, { marginBottom: 0 }]}>
                  <Text style={styles.editGroupTitle}>
                    3. DADOS DO LOCAL E DATA
                  </Text>
                  <View style={styles.fieldBlock}>
                    <Text style={styles.fieldLabel}>
                      Data da mordedura <Text style={styles.reqStar}>*</Text>
                    </Text>
                    <Pressable
                      onPress={() =>
                        onOpenCalendar({
                          currentIso: draft?.isoDate || '',
                          onPicked: ({ iso, display }) => {
                            setDraft((prev) =>
                              prev
                                ? { ...prev, date: display, isoDate: iso }
                                : prev,
                            );
                            setFieldErrors((prev) => ({ ...prev, date: null }));
                          },
                        })
                      }
                      style={[
                        styles.selectTrigger,
                        isCalendarOpenForEditor && styles.selectTriggerOpen,
                        fieldErrors.date && styles.textInputError,
                      ]}
                    >
                      <Text
                        style={[
                          styles.selectTriggerText,
                          !draft?.date && styles.selectPlaceholderText,
                        ]}
                      >
                        {draft?.date || 'Selecionar data no calendário'}
                      </Text>
                      <CalendarIcon size={18} color="#6824D6" />
                    </Pressable>
                    {fieldErrors.date ? (
                      <Text style={styles.errorText}>{fieldErrors.date}</Text>
                    ) : null}
                  </View>

                  <View style={styles.fieldBlock}>
                    <Text style={styles.fieldLabel}>
                      Município da ocorrência{' '}
                      <Text style={styles.reqStar}>*</Text>
                    </Text>
                    <TextInput
                      style={[
                        styles.textInput,
                        focusedField === 'city' && styles.textInputFocused,
                        fieldErrors.city && styles.textInputError,
                      ]}
                      value={draft?.city || ''}
                      accessibilityLabel="Município da ocorrência"
                      onChangeText={(txt) => {
                        setDraft((prev) => ({ ...prev, city: txt }));
                        setFieldErrors((prev) => ({ ...prev, city: null }));
                      }}
                      onFocus={() => setFocusedField('city')}
                      onBlur={() => setFocusedField(null)}
                      placeholder="Ex.: Curuçá"
                      placeholderTextColor="#796E92"
                    />
                    {fieldErrors.city ? (
                      <Text style={styles.errorText}>{fieldErrors.city}</Text>
                    ) : null}
                  </View>

                  <View style={[styles.fieldBlock, { marginBottom: 0 }]}>
                    <Text style={styles.fieldLabel}>
                      Localidade / Comunidade
                    </Text>
                    <TextInput
                      style={[
                        styles.textInput,
                        focusedField === 'community' && styles.textInputFocused,
                      ]}
                      value={draft?.community || ''}
                      accessibilityLabel="Localidade ou comunidade"
                      onChangeText={(txt) =>
                        setDraft((prev) => ({ ...prev, community: txt }))
                      }
                      onFocus={() => setFocusedField('community')}
                      onBlur={() => setFocusedField(null)}
                      placeholder="Opcional"
                      placeholderTextColor="#796E92"
                    />
                  </View>
                </View>
              </View>
            )}
          </ScrollViewWithScrollbar>

          {/* Footer Actions */}
          {!editMode && <Pressable onPress={onExportPdf} style={{ padding: 12, alignItems: 'center' }}><Text style={styles.secondaryBtnText}>Gerar ficha em PDF</Text></Pressable>}
          <View style={styles.footerActions}>
            {!editMode ? (
              canEdit ? (
                <>
                  <Pressable
                    onPress={openDeleteConfirm}
                    style={({ pressed }) => [
                      styles.dangerBtn,
                      pressed && { opacity: 0.85 },
                    ]}
                  >
                    <Text style={styles.dangerBtnText}>Cancelar ocorrência</Text>
                  </Pressable>
                  <Pressable
                    onPress={() => transitionDialogMode(true)}
                    style={({ pressed }) => [
                      styles.primaryBtn,
                      pressed && { opacity: 0.9 },
                    ]}
                  >
                    <Text style={styles.primaryBtnText}>Editar</Text>
                  </Pressable>
                </>
              ) : (
                <Pressable
                  onPress={onClose}
                  style={({ pressed }) => [
                    styles.primaryBtn,
                    { flex: 1 },
                    pressed && { opacity: 0.9 },
                  ]}
                >
                  <Text style={styles.primaryBtnText}>Fechar</Text>
                </Pressable>
              )
            ) : (
              <>
                <Pressable
                  onPress={() => transitionDialogMode(false)}
                  style={({ pressed }) => [
                    styles.secondaryBtn,
                    pressed && { opacity: 0.85 },
                  ]}
                >
                  <Text style={styles.secondaryBtnText}>Cancelar</Text>
                </Pressable>
                <Pressable
                  onPress={handleSaveEdition}
                  disabled={busy || !editionChanged}
                  accessibilityRole="button"
                  accessibilityState={{ disabled: busy || !editionChanged }}
                  style={({ pressed }) => [
                    styles.primaryBtn,
                    (busy || !editionChanged) && styles.primaryBtnDisabled,
                    pressed && !busy && editionChanged && { opacity: 0.9 },
                  ]}
                >
                  <Text style={[styles.primaryBtnText, (busy || !editionChanged) && styles.primaryBtnDisabledText]}>{busy ? 'Salvando...' : 'Salvar alterações'}</Text>
                </Pressable>
              </>
            )}
          </View>
        </Animated.View>
      </Animated.View>

      {/* Delete Confirmation Overlay (#record-delete-overlay) */}
      {deleteDialogOpen && (
        <Animated.View
          {...deleteCompositing}
          style={[styles.deleteOverlay, { opacity: deleteAnim }]}
          pointerEvents="auto"
        >
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={closeDeleteConfirm}
          />
          <Animated.View
            style={[
              styles.deleteDialog,
              {
                transform: [
                  { translateY: deleteTranslateY },
                  { scale: deleteScale },
                ],
              },
            ]}
          >
            <ScrollView style={styles.deleteScroll} keyboardShouldPersistTaps="handled">
              <View style={styles.header}>
                <Text style={styles.headerTitle}>Cancelar ocorrência?</Text>
              </View>
              <View style={styles.deleteBody}>
                <Text style={styles.deleteText}>
                  A ocorrência será preservada para consulta e auditoria e deixará de contar como caso ativo.
                </Text>
                <View style={{ marginTop: 14 }}>
                  <Text style={styles.fieldLabel}>Motivo do cancelamento</Text>
                  <TextInput style={styles.textInput} value={cancellationReason} onChangeText={setCancellationReason}
                    accessibilityLabel="Motivo do cancelamento" maxLength={1000} editable={!busy} />
                </View>
              </View>
              <View style={styles.footerActions}>
                <Pressable
                  onPress={closeDeleteConfirm}
                  style={({ pressed }) => [
                    styles.secondaryBtn,
                    pressed && { opacity: 0.85 },
                  ]}
                >
                  <Text style={styles.secondaryBtnText}>Cancelar</Text>
                </Pressable>
                <Pressable
                    disabled={busy}
                    onPress={async () => {
                      if (busyRef.current || !canEdit) return;
                      busyRef.current = true;
                      setBusy(true);
                      try {
                        if (!cancellationReason.trim()) throw new Error('Informe o motivo do cancelamento.');
                        await onDeleteRecord(record.id, cancellationReason.trim()); closeDeleteConfirm();
                      }
                      catch (error) { showToast?.(error.message || 'Não foi possível excluir o registro.'); }
                      finally { busyRef.current = false; setBusy(false); }
                  }}
                  style={({ pressed }) => [
                    styles.dangerBtn,
                    pressed && { opacity: 0.85 },
                  ]}
                >
                  <Text style={styles.dangerBtnText}>Confirmar cancelamento</Text>
                </Pressable>
              </View>
            </ScrollView>
          </Animated.View>
        </Animated.View>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(28, 13, 54, 0.56)',
    zIndex: 145,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  dialog: {
    width: '100%',
    maxWidth: 356,
    maxHeight: '82%',
    backgroundColor: '#FFFFFF',
    borderRadius: 22,
    borderWidth: 1.5,
    borderColor: '#EFE9FE',
    overflow: 'hidden',
    elevation: 18,
    shadowColor: '#181126',
    shadowOffset: { width: 0, height: 22 },
    shadowOpacity: 0.32,
    shadowRadius: 28,
  },
  header: {
    paddingTop: 18,
    paddingHorizontal: 18,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#EFE9FE',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  headerTitle: {
    fontSize: 18,
    fontFamily: 'PlusJakartaSans-ExtraBold',
    color: '#181126',
    letterSpacing: -0.3,
    includeFontPadding: false,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 999,
    backgroundColor: '#F6F3FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bodyScroll: {
    flexGrow: 0,
  },
  bodyContent: {
    padding: 18,
  },
  statusRow: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  recordTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 999,
    borderWidth: 1,
  },
  recordTagPending: {
    backgroundColor: '#FFF8E6',
    borderColor: '#FDE68A',
  },
  recordTagSynced: {
    backgroundColor: '#ECFDF5',
    borderColor: '#A7F3D0',
  },
  tagDot: {
    width: 6,
    height: 6,
    borderRadius: 999,
  },
  recordTagText: {
    fontSize: 11.5,
    fontFamily: 'PlusJakartaSans-Bold',
    includeFontPadding: false,
  },
  recordTagTextPending: {
    color: '#B45309',
  },
  recordTagTextSynced: {
    color: '#047857',
  },
  detailGrid: {
    backgroundColor: '#F8F7FC',
    borderWidth: 1,
    borderColor: '#EAE5F5',
    borderRadius: 15,
    paddingVertical: 12,
    paddingHorizontal: 14,
    gap: 10,
  },
  detailRow: {
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#EFE9FE',
  },
  detailRowLast: {
    paddingBottom: 0,
    borderBottomWidth: 0,
  },
  detailLabel: {
    fontSize: 11.5,
    fontFamily: 'PlusJakartaSans-Bold',
    color: '#796E92',
    marginBottom: 2,
    includeFontPadding: false,
  },
  detailValue: {
    fontSize: 14,
    fontFamily: 'PlusJakartaSans-ExtraBold',
    color: '#181126',
    lineHeight: 19,
    includeFontPadding: false,
  },
  detailSection: {
    marginTop: 14,
  },
  detailSectionTitle: {
    fontSize: 11.5,
    fontFamily: 'PlusJakartaSans-ExtraBold',
    color: '#5316B8',
    letterSpacing: 0.48,
    marginBottom: 8,
    includeFontPadding: false,
  },
  detailPhoto: {
    width: '100%',
    height: 170,
    borderRadius: 13,
    borderWidth: 1,
    borderColor: '#EAE5F5',
    backgroundColor: '#F8F7FC',
  },
  editGroup: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#EAE5F5',
    borderRadius: 16,
    padding: 14,
    marginBottom: 12,
  },
  editGroupTitle: {
    fontSize: 11.5,
    fontFamily: 'PlusJakartaSans-ExtraBold',
    color: '#5316B8',
    letterSpacing: 0.48,
    marginBottom: 10,
    includeFontPadding: false,
  },
  typeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  typeOptionBtn: {
    width: '48.5%',
    minHeight: 46,
    paddingVertical: 10,
    paddingHorizontal: 10,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#EAE5F5',
    backgroundColor: '#F8F7FC',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  typeOptionBtnSelected: {
    borderColor: '#6824D6',
    backgroundColor: '#6824D6',
  },
  typeOptionLabel: {
    flex: 1,
    fontSize: 12.5,
    fontFamily: 'PlusJakartaSans-ExtraBold',
    color: '#181126',
    lineHeight: 15,
    includeFontPadding: false,
  },
  typeOptionLabelSelected: {
    color: '#FFFFFF',
  },
  fieldBlock: {
    marginBottom: 13,
  },
  fieldLabel: {
    fontSize: 13.5,
    fontFamily: 'PlusJakartaSans-Bold',
    color: '#181126',
    marginBottom: 6,
    includeFontPadding: false,
  },
  reqStar: {
    color: '#C82333',
    fontFamily: 'PlusJakartaSans-ExtraBold',
  },
  textInput: {
    minHeight: 46,
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
  textInputError: {
    borderColor: '#C82333',
    backgroundColor: '#FFFBFB',
  },
  selectTrigger: {
    minHeight: 46,
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
  selectPlaceholderText: {
    color: '#796E92',
  },
  errorText: {
    fontSize: 12,
    fontFamily: 'PlusJakartaSans-SemiBold',
    color: '#C82333',
    marginTop: 5,
    includeFontPadding: false,
  },
  mediaStatusBox: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: '#DFD2FA',
    backgroundColor: '#F8F7FC',
  },
  mediaStatusBoxHasData: {
    borderStyle: 'solid',
    borderColor: '#DFD2FA',
    backgroundColor: '#F6F3FF',
  },
  mediaStatusBoxLoading: {
    borderStyle: 'solid',
    borderColor: '#6824D6',
    backgroundColor: '#F6F3FF',
  },
  mediaStatusText: {
    fontSize: 12.5,
    fontFamily: 'PlusJakartaSans-Bold',
    color: '#5E5473',
    lineHeight: 17.5,
    includeFontPadding: false,
  },
  mediaStatusTextHasData: {
    color: '#181126',
    fontFamily: 'PlusJakartaSans-ExtraBold',
  },
  gpsPrecision: {
    alignSelf: 'flex-start', maxWidth: '100%', marginTop: 6,
    paddingVertical: 3, paddingHorizontal: 8, borderRadius: 8,
    backgroundColor: '#EFE9FE', color: '#5316B8',
    fontSize: 12, lineHeight: 18, fontFamily: 'PlusJakartaSans-ExtraBold', includeFontPadding: false,
  },
  mediaStatusTextLoading: {
    color: '#5316B8',
  },
  mediaActionsRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
  },
  mediaBtn: {
    flex: 1,
    minHeight: 40,
    paddingVertical: 7,
    paddingHorizontal: 10,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: '#DFD2FA',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  mediaBtnDisabled: {
    opacity: 0.65,
  },
  mediaBtnText: {
    fontSize: 12,
    fontFamily: 'PlusJakartaSans-Bold',
    color: '#5316B8',
    textAlign: 'center',
    includeFontPadding: false,
    lineHeight: 16,
  },
  mediaDangerRow: {
    marginTop: 8,
  },
  mediaDangerBtn: {
    width: '100%',
    minHeight: 40,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 11,
    borderWidth: 1.5,
    borderColor: '#F5C2C7',
    backgroundColor: '#FFF5F5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  mediaDangerBtnText: {
    fontSize: 12.5,
    fontFamily: 'PlusJakartaSans-ExtraBold',
    color: '#C82333',
    includeFontPadding: false,
  },
  photoPreviewBox: {
    marginBottom: 4,
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#EAE5F5',
    backgroundColor: '#F8F7FC',
  },
  photoPreviewImg: {
    width: '100%',
    height: 150,
  },
  footerActions: {
    paddingVertical: 14,
    paddingHorizontal: 18,
    borderTopWidth: 1,
    borderTopColor: '#EFE9FE',
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: 10,
    backgroundColor: '#FFFFFF',
  },
  dangerBtn: {
    flex: 1,
    minWidth: 0,
    minHeight: 44,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#F5C2C7',
    backgroundColor: '#FFF5F5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dangerBtnText: {
    fontSize: 13.5,
    fontFamily: 'PlusJakartaSans-ExtraBold',
    color: '#C82333',
    textAlign: 'center',
    lineHeight: 19,
    flexShrink: 1,
    includeFontPadding: false,
  },
  secondaryBtn: {
    flex: 1,
    minWidth: 0,
    minHeight: 44,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#DFD2FA',
    backgroundColor: '#F6F3FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryBtnText: {
    fontSize: 13.5,
    fontFamily: 'PlusJakartaSans-ExtraBold',
    color: '#5316B8',
    textAlign: 'center',
    lineHeight: 19,
    flexShrink: 1,
    includeFontPadding: false,
  },
  primaryBtn: {
    flex: 1,
    minWidth: 0,
    minHeight: 44,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: 'transparent',
    backgroundColor: '#6824D6',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
    shadowColor: '#6824D6',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 14,
  },
  primaryBtnDisabled: { backgroundColor: '#E5E7EB', elevation: 0, shadowOpacity: 0 },
  primaryBtnDisabledText: { color: '#4B5563' },
  primaryBtnText: {
    fontSize: 13.5,
    fontFamily: 'PlusJakartaSans-ExtraBold',
    color: '#FFFFFF',
    textAlign: 'center',
    lineHeight: 19,
    flexShrink: 1,
    includeFontPadding: false,
  },
  deleteOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(28, 13, 54, 0.56)',
    zIndex: 155,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  deleteDialog: {
    width: '100%',
    maxWidth: 342,
    maxHeight: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 22,
    borderWidth: 1.5,
    borderColor: '#EFE9FE',
    overflow: 'hidden',
    elevation: 20,
  },
  deleteBody: {
    padding: 18,
  },
  deleteScroll: { flexShrink: 1, minHeight: 0 },
  deleteText: {
    fontSize: 14,
    lineHeight: 20.5,
    fontFamily: 'PlusJakartaSans-Medium',
    color: '#5E5473',
    includeFontPadding: false,
  },
});
