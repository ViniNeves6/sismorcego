import { Animated, Pressable, Text, View } from '../ui/AccessibleNative';
import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { BackHandler, AppState, DeviceEventEmitter, Easing, Keyboard, StatusBar, StyleSheet } from 'react-native';
import Svg, { Line } from 'react-native-svg';
import LinearGradient from '../ui/AccessibleLinearGradient';
import {
  SafeAreaView,
  useSafeAreaInsets,
} from 'react-native-safe-area-context';
import {
  DockAlertasIcon,
  DockMaisIcon,
  DockPainelIcon,
  DockRegistrosIcon,
} from '../ui/SismorcegoIcons';
import HowToModal from '../ui/HowToModal';
import BottomSheetModal from '../ui/BottomSheetModal';
import AppCalendarModal from '../ui/AppCalendarModal';
import RecordDetailsModal from '../ui/RecordDetailsModal';
import { ReporterModal, SignOutConfirmationModal, ThemedInfoModal } from '../ui/ThemedDialogs';
import RegistrosScreen from '../pages/Main/RegistrosScreen';
import NovaNotificacaoScreen from '../pages/Main/NovaNotificacaoScreen';
import MaisScreens from '../pages/Extras/MaisScreens';
import AdminPanelScreen from '../pages/Admin/AdminPanelScreen';
import AdminAlertsScreen from '../pages/Admin/AdminAlertsScreen';
import AnimatedScreenTransition from '../ui/AnimatedScreenTransition';
import SwipeDismissibleToast from '../ui/SwipeDismissibleToast';
import {
  VICTIM_META,
  addNewRecordToStorage,
  deleteRecordFromStorage,
  loadAccountProfile,
  loadRecordsFromStorage,
  loadPendingCount,
  loadReporterName,
  saveAccountProfile,
  saveReporterNameToStorage,
  triggerSyncRecords,
  updateRecordInStorage,
  acceptRemoteRecordInStorage,
} from '../services/sismorcegoData';
import useAccessibility from '../hooks/useAccessibility';
import useKeyboardVisible from '../hooks/useKeyboardVisible';
import KeyboardDock from '../ui/KeyboardDock';
import useAuth from '../hooks/useAuth';
import { hasProfileChanges, normalizedProfile, normalizeEmail, normalizeName } from '../services/editChanges';
import NetInfo from '@react-native-community/netinfo';
import { createDoubt, deleteDoubt, subscribeDoubts } from '../services/duvidas';
import { loadDoubtDrafts, removeDoubtDraft } from '../services/doubtDrafts';
import useNotifications from '../hooks/useNotifications';
import useCoordenadorNotifications from '../hooks/useCoordenadorNotifications';
import useCoordinatorNavigation from '../hooks/useCoordinatorNavigation';
import useCoordinatorAlerts from '../hooks/useCoordinatorAlerts';
import { canAccessCoordinatorArea } from '../services/roleAccess';
import { generateRegistroPdf, savePdf } from '../services/registroPdf';
import { withCloudPhotoRaw, withCloudPhotoView } from '../services/recordPhotoCloud';
import PdfOptionsSheet from '../pages/Main/buscar/PdfOptionsSheet';
import PdfViewerModal from '../pages/Main/buscar/PdfViewerModal';
import AsyncStorage from '@react-native-async-storage/async-storage';
import SpotlightWelcomeModal, { SPOTLIGHT_WELCOME_KEY } from '../ui/SpotlightWelcomeModal';
import SpotlightGuideModal, { SPOTLIGHT_STORAGE_KEY } from '../ui/SpotlightGuideModal';
import { completeRecordDraft, getRecordDraftIdentity } from '../services/recordDraftIdentity';
import { isRecordOwner, canModifyRecord, assertCanModifyRecord, recordIdentity } from '../services/recordLifecycle';
import { registroIsoDate } from '../services/registroDate';

function createDefaultNotificationDate() {
  const iso = registroIsoDate(new Date());
  return { iso, display: iso.split('-').reverse().join('/') };
}

export default function SismorcegoShell({ onInitialScreenReady } = {}) {
  const insets = useSafeAreaInsets();
  const keyboardVisible = useKeyboardVisible();
  const { settings: accessibility, updateSettings: updateAccessibility } =
    useAccessibility();
  const { user, role, signOut, updateUser, resetPassword } = useAuth();
  // Start closed even while checking storage: the initial tour must precede data work.
  // Replaying the guide later does not close this gate again.
  const [dataEnabled, setDataEnabled] = useState(false);
  const dataEnabledRef = useRef(dataEnabled);
  dataEnabledRef.current = dataEnabled;
  const notifications = useNotifications({ enabled: dataEnabled });
  useCoordenadorNotifications({ trackUnread: false, enabled: dataEnabled });
  const reduceMotion = Boolean(accessibility?.reduceMotion);

  // Navigation state
  const isCoordenador = canAccessCoordinatorArea(role);
  const [activeTab, setActiveTab] = useState('home'); // 'home' | 'panel' | 'new' | 'alerts' | 'more'
  const [activeVictimSubscreen, setActiveVictimSubscreen] = useState(null); // 'humano' | 'canino' | 'aves' | 'producao' | null
  const [activeMaisSubscreen, setActiveMaisSubscreen] = useState(null); // 'sub-account' | 'sub-password' | 'sub-settings' | 'sub-info' | 'sub-faq' | 'sub-about' | 'sub-credits' | null
  const [doubtsView, setDoubtsView] = useState('list');

  // Coordinator state
  const [adminCityFilter, setAdminCityFilter] = useState('all');
  const [adminVictimFilter, setAdminVictimFilter] = useState('all');

  // Persistent data state
  const [records, setRecords] = useState([]);
  const [reporterName, setReporterName] = useState(user?.displayName || '');
  const [accountProfile, setAccountProfile] = useState({
    username: user?.displayName || '',
    email: user?.email || '',
    photoUri: null,
  });
  const [doubts, setDoubts] = useState([]);
  const [doubtDrafts, setDoubtDrafts] = useState([]);
  const [doubtsError, setDoubtsError] = useState('');
  const [doubtsLoading, setDoubtsLoading] = useState(true);
  const [recordsLoading, setRecordsLoading] = useState(true);
  const [recordsError, setRecordsError] = useState('');
  const [syncing, setSyncing] = useState(false);
  const syncUiBusy = useRef(false);
  const [pendingCount, setPendingCount] = useState(0);
  const savingRef = useRef(false);
  const [saving, setSaving] = useState(false);
  const [pdfRecord, setPdfRecord] = useState(null);
  const [pdf, setPdf] = useState(null);
  const [generatingPdf, setGeneratingPdf] = useState(false);
  const pendingPdf = useRef(null);
  const pendingPdfRecord = useRef(null);

  // New notification form state
  const [selectedVictimKey, setSelectedVictimKey] = useState('humano');
  const [victimData, setVictimData] = useState({
    humano: {},
    canino: {},
    aves: {},
    producao: {},
  });
  const [victimSaved, setVictimSaved] = useState({
    humano: false,
    canino: false,
    aves: false,
    producao: false,
  });
  const [gpsState, setGpsState] = useState(null);
  const [photoState, setPhotoState] = useState(null);
  const [dateState, setDateState] = useState(createDefaultNotificationDate);
  const [newFormStarted, setNewFormStarted] = useState(false);
  const [city, setCity] = useState('');
  const [community, setCommunity] = useState('');

  useLayoutEffect(() => {
    if (activeTab === 'new' && !newFormStarted) {
      setDateState(createDefaultNotificationDate());
      setNewFormStarted(true);
    }
  }, [activeTab, newFormStarted]);

  // Overlays state
  const [howToVisible, setHowToVisible] = useState(false);
  const [reporterModalVisible, setReporterModalVisible] = useState(false);
  const [infoModalState, setInfoModalState] = useState({
    visible: false,
    title: '',
    message: '',
  });
  const [selectedRecord, setSelectedRecord] = useState(null);
  const [recordDetailsVisible, setRecordDetailsVisible] = useState(false);
  const [bottomSheetConfig, setBottomSheetConfig] = useState({
    visible: false,
    id: null,
    title: '',
    options: [],
    selectedValue: '',
    onSelect: null,
  });
  const [calendarConfig, setCalendarConfig] = useState({
    visible: false,
    mode: null, // 'new' | 'editor'
    selectedIso: '',
    onPicked: null,
  });

  const toastRef = useRef(null);

  // Welcome & Interactive Guide state
  const [welcomeVisible, setWelcomeVisible] = useState(false);
  const [guideVisible, setGuideVisible] = useState(false);
  const [guideLayoutActive, setGuideLayoutActive] = useState(false);
  const [initialLayoutReady, setInitialLayoutReady] = useState(false);
  const [initialGuideSeen, setInitialGuideSeen] = useState(false);
  const initialReadyReported = useRef(false);
  const reportInitialReady = useCallback(() => {
    if (initialReadyReported.current) return;
    initialReadyReported.current = true;
    onInitialScreenReady?.();
  }, [onInitialScreenReady]);
  useEffect(() => {
    if (initialLayoutReady && initialGuideSeen) reportInitialReady();
  }, [initialLayoutReady, initialGuideSeen, reportInitialReady]);
  const welcomeAfterGuideRef = useRef(false);
  const guideClosingRef = useRef(false);

  // Target refs for interactive guide
  const guideTargetRefs = useMemo(() => Object.fromEntries(
    ['syncBanner', 'recordsOverview', 'recordsSearch', 'filterPills', 'firstRecord', 'dockFab',
      'reporterCard', 'notificationOverview', 'victimSection', 'victimGrid', 'gpsSection', 'formSection',
      'panelOverview', 'panelTop', 'panelMapSection', 'panelTrendSection',
      'alertsOverview', 'menuGuide'].map(key => [key, React.createRef()]),
  ), []);
  const guideScrollTargets = useRef({
    home: { node: null, offset: 0 },
    new: { node: null, offset: 0 },
    panel: { node: null, offset: 0 },
    alerts: { node: null, offset: 0 },
    more: { node: null, offset: 0 },
  }).current;
  const guideDockRef = useRef(null);
  useEffect(() => { if (guideVisible) setGuideLayoutActive(true); }, [guideVisible]);

  // FAB rotation & color overlay animation
  const fabOverlayAnim = useRef(new Animated.Value(0)).current;
  const fabRotationAnim = useRef(new Animated.Value(0)).current;
  const fabClearCountRef = useRef(0);

  const showToast = useCallback(msg => toastRef.current?.show(msg), []);
  const [signOutDialog, setSignOutDialog] = useState('closed');
  const signOutConfirmed = useRef(false);
  const signingOut = useRef(false);
  const requestSignOut = () => {
    if (signOutDialog !== 'closed' || signingOut.current) return;
    signOutConfirmed.current = false;
    setSignOutDialog('open');
  };
  const cancelSignOut = () => {
    if (signOutDialog !== 'open') return;
    signOutConfirmed.current = false;
    setSignOutDialog('closing');
  };
  const confirmSignOut = () => {
    if (signOutDialog !== 'open' || signOutConfirmed.current) return;
    signOutConfirmed.current = true;
    setSignOutDialog('closing');
  };
  const finishSignOutDialog = async () => {
    if (signOutDialog !== 'closing') return;
    setSignOutDialog('closed');
    if (!signOutConfirmed.current || signingOut.current) return;
    signOutConfirmed.current = false;
    signingOut.current = true;
    try { await signOut(); }
    catch (error) { showToast(error.message || 'Não foi possível encerrar a sessão.'); }
    finally { signingOut.current = false; }
  };

  useEffect(() => {
    if (dataEnabled && activeTab === 'new' && user?.uid) getRecordDraftIdentity(user.uid).catch(error => showToast(error.message));
  }, [dataEnabled, activeTab, user?.uid, showToast]);

  const loadSequence = useRef(0);
  const refreshRecords = useCallback(async () => {
    if (!dataEnabledRef.current) return;
    const sequence = ++loadSequence.current;
    setRecordsError('');
    try {
      const loaded = await loadRecordsFromStorage(role, { onCloudError: () => {
        if (sequence === loadSequence.current) setRecordsError('Não foi possível consultar a nuvem. Exibindo os dados salvos no aparelho.');
      } });
      const count = await loadPendingCount();
      if (sequence === loadSequence.current) { setRecords(loaded); setPendingCount(count); }
    } catch (error) {
      if (sequence === loadSequence.current) setRecordsError(error.message || 'Não foi possível carregar os registros.');
    } finally {
      if (sequence === loadSequence.current) setRecordsLoading(false);
    }
  }, [role]);

  const syncRecords = useCallback(async (manual = false) => {
    if (!dataEnabledRef.current) return;
    if (syncUiBusy.current) {
      // Solicita mais uma passagem se houve uma edição durante o envio.
      await triggerSyncRecords();
      if (manual) showToast('Uma sincronização já está em andamento.');
      return;
    }
    syncUiBusy.current = true;
    setSyncing(true);
    try {
      const result = await triggerSyncRecords();
      if (manual) {
        const reasons = { offline: 'Sem conexão. Os registros continuam salvos e serão enviados ao reconectar.',
          'no-user': 'Faça login para sincronizar.', 'no-db': 'Banco de dados indisponível.', empty: 'Nenhum registro pendente.',
          'already-syncing': 'Uma sincronização já está em andamento.' };
        showToast(reasons[result.reason] || (result.error ? result.error : result.failed
          ? `${result.synced} enviados; ${result.failed} com falha. Tente novamente.` : `${result.synced} registro(s) sincronizado(s).`));
      }
    } finally {
      syncUiBusy.current = false;
      setSyncing(false);
      await refreshRecords();
    }
  }, [refreshRecords, showToast]);

  useEffect(() => {
    if (!dataEnabled) return;
    let active = true;
    refreshRecords();
    Promise.all([loadReporterName(), loadAccountProfile()]).then(([name, profile]) => {
      if (active) { setReporterName(name); setAccountProfile(profile); }
    }).catch(error => active && showToast(error.message));
    loadDoubtDrafts().then(items => active && setDoubtDrafts(items)).catch(error => active && showToast(error.message));
    const recordsListener = DeviceEventEmitter.addListener('registros:changed', refreshRecords);
    const networkListener = NetInfo.addEventListener(state => {
      if (active && state.isConnected && state.isInternetReachable !== false) syncRecords();
    });
    const appListener = AppState.addEventListener('change', state => { if (active && state === 'active') syncRecords(); });
    return () => { active = false; loadSequence.current += 1; recordsListener.remove(); networkListener(); appListener.remove(); };
  }, [dataEnabled, refreshRecords, syncRecords, showToast]);

  useEffect(() => {
    if (!dataEnabled) return;
    setDoubtsLoading(true);
    return subscribeDoubts(items => { setDoubts(items); setDoubtsError(''); setDoubtsLoading(false); }, () => {
      setDoubtsError('Não foi possível consultar as dúvidas. Verifique sua conexão e tente novamente.');
      setDoubtsLoading(false);
    }, role);
  }, [dataEnabled, user?.uid, role, activeMaisSubscreen]);

  const coordinatorNavigation = useMemo(() => ({ navigate: screen => {
    const tab = { Painel: 'panel', Notificacoes: 'alerts' }[screen];
    if (!tab || !isCoordenador) return;
    setActiveVictimSubscreen(null);
    setActiveMaisSubscreen(null);
    setActiveTab(tab);
  } }), [isCoordenador]);
  const { alerts: coordinatorAlerts, loading: alertsLoading, error: alertsError,
    unreadCount: naoLidas, resolveRecord: resolveAlertRecord, markRead: markAlertRead,
    markUnread: markAlertUnread, liveRecords,
    markAllRead: markAllAlertsRead, reload: reloadAlerts } = useCoordinatorAlerts(records, { enabled: dataEnabled });
  const visibleRecords = useMemo(() => {
    if (!isCoordenador || !liveRecords) return records;
    const result = new Map(liveRecords.map(item => [`${item.uid}/${item.id}`,item]));
    records.filter(item => item.uid === user?.uid).forEach(item => {
      const key=`${item.uid}/${item.id}`;
      if(item.status !== 'synced')result.set(key,item);
      else if(item._raw?.photoPolicyVersion === 1 && result.has(key))result.set(key,{...result.get(key),photo:item.photo});
    });
    return [...result.values()];
  }, [isCoordenador,liveRecords,records,user?.uid]);

  useEffect(() => {
    if (isCoordenador) return;
    if (activeTab === 'panel' || activeTab === 'alerts') setActiveTab('home');
    if (selectedRecord && selectedRecord.uid !== user?.uid) {
      setRecordDetailsVisible(false);
      setSelectedRecord(null);
    }
  }, [isCoordenador, activeTab, selectedRecord, user?.uid]);

  const handleMarkAlertRead = async item => {
    try { await markAlertRead(item); }
    catch (error) { showToast(error.message || 'Não foi possível marcar o alerta como lido.'); }
  };
  const handleMarkAlertUnread = async item => {
    try { await markAlertUnread(item); }
    catch (error) { showToast(error.message || 'Não foi possível marcar o alerta como não lido.'); }
  };
  const handleMarkAllAlertsRead = async () => {
    try {
      const count = await markAllAlertsRead();
      showToast(count ? 'Todos os alertas foram marcados como lidos.' : 'Nenhum alerta aguardando leitura.');
    } catch (error) { showToast(error.message || 'Não foi possível marcar todos como lidos.'); }
  };
  // Registros vindos da nuvem (de outro aparelho) buscam a foto ao abrir os detalhes.
  const openRecordDetails = record => {
    setSelectedRecord(record);
    setRecordDetailsVisible(true);
    withCloudPhotoView(record).then(withPhoto => {
      if (withPhoto === record) return;
      setSelectedRecord(current => (current && current.id === record.id && current.uid === record.uid && !current.photo ? withPhoto : current));
    }).catch(() => {});
  };
  const handleSelectAlert = async item => {
    try {
      const record = await resolveAlertRecord(item);
      setRecords(previous => previous.map(current => current.id === record.id && current.uid === record.uid ? record : current));
      openRecordDetails(record);
      if (!item.lida) handleMarkAlertRead(item);
    } catch (error) { showToast(error.message || 'Não foi possível carregar a ocorrência.'); }
  };
  const openCoordinatorScreen = useCoordinatorNavigation(coordinatorNavigation, showToast, target => {
    handleSelectAlert({ ...target, id: target.alertId, lida: true });
  }, { enabled: dataEnabled });

  const handleOpenAdminCityFilter = () => {
    const set = new Set();
    visibleRecords.forEach((r) => {
      if (r.city) set.add(r.city);
    });
    const cities = Array.from(set).sort((a, b) => a.localeCompare(b, 'pt-BR'));
    setBottomSheetConfig({
      visible: true,
      id: 'reg-city',
      title: 'Município',
      options: [
        { id: 'all', label: 'Todos os municípios' },
        ...cities.map((c) => ({ id: c, label: c })),
      ],
      selectedValue: adminCityFilter,
      onSelect: (opt) => setAdminCityFilter(opt.id),
    });
  };

  const handleOpenAdminVictimFilter = () => {
    setBottomSheetConfig({
      visible: true,
      id: 'reg-victim',
      title: 'Espécie mordida',
      options: [
        { id: 'all', label: 'Todas as espécies mordidas' },
        { id: 'humano', label: 'Humano' },
        { id: 'canino', label: 'Canino / Felino' },
        { id: 'aves', label: 'Aves' },
        { id: 'producao', label: 'Animal de produção' },
      ],
      selectedValue: adminVictimFilter,
      onSelect: (opt) => setAdminVictimFilter(opt.id),
    });
  };

  // Check initial guide on app launch
  useEffect(() => {
    let isMounted = true;
    let timer;
    const checkInitialGuides = async () => {
      let seen;
      try {
        seen = await AsyncStorage.getItem(SPOTLIGHT_STORAGE_KEY);
      } catch (_) {}
      if (!isMounted) return;
      if (seen) { setInitialGuideSeen(true); setDataEnabled(true); }
      else timer = setTimeout(() => { if (isMounted) setGuideVisible(true); }, 500);
    };
    checkInitialGuides();
    return () => {
      isMounted = false;
      clearTimeout(timer);
    };
  }, []);

  const handleCompleteGuide = async () => {
    try {
      await AsyncStorage.setItem(SPOTLIGHT_STORAGE_KEY, '1');
      const welcomeShown = await AsyncStorage.getItem(SPOTLIGHT_WELCOME_KEY);
      welcomeAfterGuideRef.current = !welcomeShown;
    } catch (_) {}
    guideClosingRef.current = true;
    setGuideVisible(false);
  };

  const handleGuideExited = () => {
    if (!guideClosingRef.current) return;
    guideClosingRef.current = false;
    setGuideLayoutActive(false);
    if (welcomeAfterGuideRef.current) {
      welcomeAfterGuideRef.current = false;
      setWelcomeVisible(true);
    } else setDataEnabled(true);
  };

  const handleSkipGuide = async () => {
    welcomeAfterGuideRef.current = false;
    guideClosingRef.current = true;
    setGuideVisible(false);
    try {
      await AsyncStorage.setItem(SPOTLIGHT_STORAGE_KEY, '1');
    } catch (_) {}
  };

  const handleStartGuide = () => {
    welcomeAfterGuideRef.current = false;
    setGuideVisible(true);
  };

  // Animate FAB when entering/leaving 'new' tab
  useEffect(() => {
    const isNewTab = activeTab === 'new';
    if (!isNewTab) {
      fabClearCountRef.current = 0;
      if (reduceMotion) {
        fabOverlayAnim.setValue(0);
        fabRotationAnim.setValue(0);
      } else {
        Animated.parallel([
          Animated.timing(fabOverlayAnim, {
            toValue: 0,
            duration: 380,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(fabRotationAnim, {
            toValue: 0,
            duration: 480,
            easing: Easing.bezier(0.22, 0.82, 0.25, 1),
            useNativeDriver: true,
          }),
        ]).start();
      }
    } else {
      const targetDeg = 45 + fabClearCountRef.current * 180;
      if (reduceMotion) {
        fabOverlayAnim.setValue(1);
        fabRotationAnim.setValue(targetDeg);
      } else {
        Animated.parallel([
          Animated.timing(fabOverlayAnim, {
            toValue: 1,
            duration: 380,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(fabRotationAnim, {
            toValue: targetDeg,
            duration: 480,
            easing: Easing.bezier(0.22, 0.82, 0.25, 1),
            useNativeDriver: true,
          }),
        ]).start();
      }
    }
  }, [activeTab, reduceMotion, fabOverlayAnim, fabRotationAnim]);

  // Uma única fadeSlide por navegação, como .screen no HTML de referência.
  const currentScreenKey = activeTab === 'more'
    ? `more_${activeMaisSubscreen || 'menu'}_${activeMaisSubscreen === 'sub-faq' ? doubtsView : ''}`
    : activeTab === 'new'
    ? `new_${activeVictimSubscreen || ''}`
    : activeTab;

  const clearNotificationFields = useCallback(() => {
    setSelectedVictimKey('');
    setVictimData({
      humano: {},
      canino: {},
      aves: {},
      producao: {},
    });
    setVictimSaved({
      humano: false,
      canino: false,
      aves: false,
      producao: false,
    });
    setGpsState(null);
    setPhotoState(null);
    setDateState(createDefaultNotificationDate());
    setNewFormStarted(false);
    setCity('');
    setCommunity('');
  }, []);

  const handleDockNotificarPress = () => {
    if (activeTab === 'new') {
      Keyboard.dismiss();
      clearNotificationFields();
      guideScrollTargets.new.node?.scrollTo({ y: 0, animated: !reduceMotion });
      if (activeVictimSubscreen) {
        setActiveVictimSubscreen(null);
      }
      // Rotação acumulativa: anima +180° a cada toque, mantendo o desenho em X
      fabClearCountRef.current += 1;
      const targetDeg = 45 + fabClearCountRef.current * 180;
      if (reduceMotion) {
        fabRotationAnim.setValue(targetDeg);
      } else {
        Animated.timing(fabRotationAnim, {
          toValue: targetDeg,
          duration: 480,
          easing: Easing.bezier(0.22, 0.82, 0.25, 1),
          useNativeDriver: true,
        }).start();
      }
      showToast('Campos limpos');
      return;
    }
    setActiveVictimSubscreen(null);
    setActiveTab('new');
  };

  const handleDockRegistrosPress = () => {
    setActiveVictimSubscreen(null);
    setActiveMaisSubscreen(null);
    setActiveTab('home');
  };

  const handleDockPainelPress = () => {
    openCoordinatorScreen('Painel');
  };

  const handleDockAlertasPress = () => {
    openCoordinatorScreen('Notificacoes');
  };

  const handleDockMaisPress = () => {
    setActiveMaisSubscreen(null);
    setActiveTab('more');
  };

  const handleSaveCompleteRecord = async (vKey, vDetails) => {
    if (!dataEnabledRef.current) return;
    if (savingRef.current) return;
    if (!reporterName.trim()) { setReporterModalVisible(true); showToast('Informe o responsável pelo registro.'); return; }
    savingRef.current = true;
    setSaving(true);
    const meta = VICTIM_META[vKey] || VICTIM_META.humano;
    const newRecord = {
      status: 'pending',
      statusLabel: 'Aguardando envio',
      title: meta.title,
      victimKey: vKey,
      city: city.trim(),
      community: community.trim(),
      date: dateState.display,
      isoDate: dateState.iso,
      reporter: reporterName,
      gps:
        gpsState?.status === 'done'
          ? {
              lat: gpsState.lat,
              lng: gpsState.lng,
              accuracy: gpsState.accuracy,
              text: gpsState.text,
              source: gpsState.source,
              isHighAccuracy: gpsState.isHighAccuracy,
            }
          : null,
      photo: photoState ? { ...photoState } : null,
      details: { ...(vDetails || {}) },
    };

    try {
      const identity = await getRecordDraftIdentity(user.uid);
      newRecord.id = identity.id;
      const savedRecord = await addNewRecordToStorage(newRecord);
      await completeRecordDraft(user.uid, identity.id);
      setRecords(previous => [savedRecord, ...previous]);
      clearNotificationFields();
      setActiveVictimSubscreen(null);
      showToast('Notificação salva no dispositivo!');
      setActiveTab('home');
      syncRecords();
    } catch (error) {
      showToast(error.message || 'Não foi possível salvar. Seus campos foram preservados.');
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };

  // Back button handler
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (signOutDialog !== 'closed') {
        if (signOutDialog === 'open') {
          signOutConfirmed.current = false;
          setSignOutDialog('closing');
        }
        return true;
      }
      // The guide handles previous steps before the underlying screen navigates.
      if (guideVisible) return false;
      if (calendarConfig.visible) {
        setCalendarConfig((p) => ({ ...p, visible: false }));
        return true;
      }
      if (bottomSheetConfig.visible) {
        setBottomSheetConfig((p) => ({ ...p, visible: false }));
        return true;
      }
      if (infoModalState.visible) {
        setInfoModalState((p) => ({ ...p, visible: false }));
        return true;
      }
      if (recordDetailsVisible) {
        setRecordDetailsVisible(false);
        return true;
      }
      if (reporterModalVisible) {
        setReporterModalVisible(false);
        return true;
      }
      if (howToVisible) {
        setHowToVisible(false);
        return true;
      }
      if (activeTab === 'new' && activeVictimSubscreen) {
        setActiveVictimSubscreen(null);
        return true;
      }
      if (activeTab === 'more' && activeMaisSubscreen) {
        if (activeMaisSubscreen === 'sub-faq' && doubtsView !== 'list') {
          setDoubtsView('list');
        } else if (activeMaisSubscreen === 'sub-password') {
          setActiveMaisSubscreen('sub-account');
        } else {
          setActiveMaisSubscreen(null);
        }
        return true;
      }
      if (activeTab !== 'home') {
        setActiveTab('home');
        return true;
      }
      return false;
    });
    return () => sub.remove();
  }, [
    signOutDialog,
    guideVisible,
    calendarConfig.visible,
    bottomSheetConfig.visible,
    infoModalState.visible,
    recordDetailsVisible,
    reporterModalVisible,
    howToVisible,
    activeTab,
    activeVictimSubscreen,
    activeMaisSubscreen,
    doubtsView,
  ]);

  const fabRotate = fabRotationAnim.interpolate({
    inputRange: [-36000, 36000],
    outputRange: ['-36000deg', '36000deg'],
  });

  const isRegistrosActive = activeTab === 'home';
  const isPainelActive = activeTab === 'panel';
  const isNotificarActive = activeTab === 'new';
  const isAlertasActive = activeTab === 'alerts';
  const isMaisActive = activeTab === 'more';

  const bottomInset = Math.max(insets.bottom, 0);

  return (
    <SafeAreaView testID="sismorcego-shell" onLayout={() => setInitialLayoutReady(true)}
      style={[styles.safeRoot, accessibility?.highContrast && { backgroundColor: '#08080C' }]} edges={['top', 'left', 'right']}>
      <StatusBar barStyle={accessibility?.highContrast ? 'light-content' : 'dark-content'} backgroundColor={accessibility?.highContrast ? '#08080C' : '#FFFFFF'} />

      <View style={styles.appContainer}>
        {/* Animated Screen Viewport */}
        <AnimatedScreenTransition screenKey={currentScreenKey} style={styles.screenViewport} reduceMotion={reduceMotion}>
          {activeTab === 'home' && (
            <RegistrosScreen
              records={visibleRecords}
              loading={dataEnabled && recordsLoading}
              error={recordsError}
              syncing={syncing}
              pendingOperations={pendingCount}
              onRefresh={refreshRecords}
              onOpenHowTo={() => setHowToVisible(true)}
              onSyncNow={() => syncRecords(true)}
              onSelectRecord={openRecordDetails}
              guideRefs={guideTargetRefs}
              guideScroll={guideScrollTargets.home}
              isCoordenador={isCoordenador}
              adminCityFilter={adminCityFilter}
              adminVictimFilter={adminVictimFilter}
              onOpenAdminCityFilter={handleOpenAdminCityFilter}
              onOpenAdminVictimFilter={handleOpenAdminVictimFilter}
            />
          )}

          {isCoordenador && activeTab === 'panel' && (
            <AdminPanelScreen
              records={visibleRecords}
              bottomInset={bottomInset}
              reduceMotion={reduceMotion}
              onOpenBottomSheet={(cfg) =>
                setBottomSheetConfig({
                  visible: true,
                  id: cfg.id,
                  title: cfg.title,
                  options: cfg.options,
                  selectedValue: cfg.selectedValue,
                  onSelect: (chosen) => {
                    cfg.onSelect?.(chosen);
                    setBottomSheetConfig((p) => ({
                      ...p,
                      visible: false,
                      selectedValue: chosen,
                    }));
                  },
                })
              }
              guideRefs={guideTargetRefs}
              scrollRef={guideScrollTargets.panel}
              guideActive={guideLayoutActive}
            />
          )}

          {activeTab === 'new' && (
            <NovaNotificacaoScreen
              reporterName={reporterName}
              onOpenReporterModal={() => setReporterModalVisible(true)}
              onOpenVictimInfo={(title, message) =>
                setInfoModalState({ visible: true, title, message })
              }
              activeVictimSubscreen={activeVictimSubscreen}
              setActiveVictimSubscreen={setActiveVictimSubscreen}
              selectedVictimKey={selectedVictimKey}
              setSelectedVictimKey={setSelectedVictimKey}
              victimData={victimData}
              setVictimData={setVictimData}
              victimSaved={victimSaved}
              setVictimSaved={setVictimSaved}
              gpsState={gpsState}
              setGpsState={setGpsState}
              photoState={photoState}
              setPhotoState={setPhotoState}
              dateState={dateState}
              onOpenCalendarForNew={() =>
                setCalendarConfig({
                  visible: true,
                  mode: 'new',
                  selectedIso: dateState.iso,
                  onPicked: ({ iso, display }) =>
                    setDateState({ iso, display }),
                })
              }
              isCalendarOpenForNew={
                calendarConfig.visible && calendarConfig.mode === 'new'
              }
              city={city}
              setCity={setCity}
              community={community}
              setCommunity={setCommunity}
              onOpenBottomSheet={(cfg) =>
                setBottomSheetConfig({
                  visible: true,
                  id: cfg.id,
                  title: cfg.title,
                  options: cfg.options,
                  selectedValue: cfg.selectedValue,
                  onSelect: (chosen) => {
                    cfg.onSelect?.(chosen);
                    setBottomSheetConfig((p) => ({
                      ...p,
                      visible: false,
                      selectedValue: chosen,
                    }));
                  },
                })
              }
              activeSheetFieldKey={
                bottomSheetConfig.visible ? bottomSheetConfig.id : null
              }
              onSaveCompleteRecord={handleSaveCompleteRecord}
              saving={saving}
              showToast={showToast}
              reduceMotion={reduceMotion}
              bottomInset={bottomInset}
              guideRefs={guideTargetRefs}
              guideScroll={guideScrollTargets.new}
            />
          )}

          {isCoordenador && activeTab === 'alerts' && (
            <AdminAlertsScreen
              alerts={coordinatorAlerts}
              loading={alertsLoading}
              error={alertsError}
              onRetry={reloadAlerts}
              onMarkRead={handleMarkAlertRead}
              onMarkUnread={handleMarkAlertUnread}
              onMarkAllRead={handleMarkAllAlertsRead}
              onSelectAlert={handleSelectAlert}
              guideRefs={guideTargetRefs}
              reduceMotion={reduceMotion}
            />
          )}

          {activeTab === 'more' && (
              <MaisScreens
                bottomInset={bottomInset}
                activeSubscreen={activeMaisSubscreen}
                keyboardVisible={keyboardVisible}
                setActiveSubscreen={setActiveMaisSubscreen}
                doubtsView={doubtsView}
                setDoubtsView={setDoubtsView}
                accountProfile={accountProfile}
                onSaveAccountProfile={async (nextAcc) => {
                  if (!nextAcc.username.trim()) throw new Error('Informe seu nome.');
                  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(nextAcc.email.trim())) throw new Error('Informe um email válido.');
                  const current = await loadAccountProfile();
                  const next = normalizedProfile(nextAcc);
                  if (!hasProfileChanges(current, next)) return current;
                  const nameChanged = next.username !== normalizeName(current.username);
                  const emailChanged = next.email !== normalizeEmail(current.email);
                  if (nameChanged || emailChanged) await updateUser({
                    ...(nameChanged ? { nome: next.username } : {}), ...(emailChanged ? { email: next.email } : {}),
                  });
                  if (next.photoUri !== (current.photoUri || null)) await saveAccountProfile({ photoUri: next.photoUri });
                  const loaded = await loadAccountProfile();
                  setAccountProfile(loaded);
                  if (nameChanged) { await saveReporterNameToStorage(next.username); setReporterName(next.username); }
                  return loaded;
                }}
                onSaveAvatarPhoto={async photoUri => {
                  await saveAccountProfile({ photoUri });
                  setAccountProfile(previous => ({ ...previous, photoUri }));
                }}
                onChangePassword={senha => updateUser({ senha })}
                onResetPassword={() => resetPassword(user.email)}
                doubts={[...doubtDrafts, ...doubts.filter(item => item.userId === user.uid)]}
                answeredDoubts={doubts.filter(item => item.answer)}
                doubtsLoading={dataEnabled && doubtsLoading}
                doubtsError={doubtsError}
                onCreateDoubt={async (question, draftId) => {
                  await createDoubt(question);
                  if (draftId) setDoubtDrafts(await removeDoubtDraft(draftId));
                }}
                onDeleteDoubt={async item => {
                  if (item.draft) setDoubtDrafts(await removeDoubtDraft(item.id));
                  else await deleteDoubt(item);
                }}
                notificationsEnabled={notifications.notificationsEnabled}
                onToggleNotifications={notifications.toggleNotifications}
                coordinator={canAccessCoordinatorArea(role)}
                accessibility={accessibility}
                onUpdateAccessibility={patch => updateAccessibility(patch).catch(error => showToast(error.message || 'Não foi possível salvar a configuração.'))}
                onSignOut={requestSignOut}
                showToast={showToast}
                onOpenInteractiveGuide={handleStartGuide}
                menuGuideRef={guideTargetRefs.menuGuide}
                guideScroll={guideScrollTargets.more}
              />
          )}
        </AnimatedScreenTransition>

        {/* The dock stays out of the keyboard viewport while typing. */}
        <KeyboardDock hidden={keyboardVisible}
          testID="bottom-dock"
          style={[
            styles.bottomDockContainer,
            { height: 94 + bottomInset },
          ]}
          pointerEvents="box-none"
        >
          <View ref={guideDockRef} collapsable={false} style={styles.bottomDockSurface} />
          <View
            style={[
              styles.bottomDockRow,
              { paddingBottom: 14 + bottomInset },
              isCoordenador && styles.bottomDockRowAdmin,
            ]}
          >
            {/* Tab 1: Registros */}
            <Pressable
              onPress={handleDockRegistrosPress}
              style={styles.dockItem}
            >
              <DockRegistrosIcon
                size={22}
                color={isRegistrosActive ? '#6824D6' : '#796E92'}
              />
              <Text
                style={[
                  styles.dockLabel,
                  isRegistrosActive && styles.dockLabelActive,
                ]}
              >
                Registros
              </Text>
            </Pressable>

            {/* Tab 2 (Coordinator only): Painel */}
            {isCoordenador && (
              <Pressable
                onPress={handleDockPainelPress}
                style={styles.dockItem}
                accessibilityLabel="Painel"
              >
                <DockPainelIcon
                  size={22}
                  color={isPainelActive ? '#6824D6' : '#796E92'}
                />
                <Text
                  style={[
                    styles.dockLabel,
                    isPainelActive && styles.dockLabelActive,
                  ]}
                >
                  Painel
                </Text>
              </Pressable>
            )}

            {/* Tab 3: Center FAB Notificar (+ / X) */}
            <View style={styles.dockFabWrapper}>
              <Pressable
                ref={guideTargetRefs.dockFab}
                collapsable={false}
                onPress={handleDockNotificarPress}
                style={({ pressed }) => [
                  styles.dockFab,
                  pressed && { transform: [{ scale: 0.94 }] },
                ]}
              >
                <LinearGradient
                  colors={['#6824D6', '#7B39E8']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.dockFabBgClip}
                >
                  {/* Active Dark Purple (#1C0D36) Fade Overlay */}
                  <Animated.View
                    style={[
                      StyleSheet.absoluteFill,
                      styles.dockFabActiveOverlay,
                      { opacity: fabOverlayAnim },
                    ]}
                  />
                  {/* Rotating + / X Icon */}
                  <Animated.View
                    style={{
                      transform: [{ rotate: fabRotate }],
                    }}
                  >
                    <Svg
                      width={26}
                      height={26}
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="#FFFFFF"
                      strokeWidth={2.5}
                      strokeLinecap="round"
                    >
                      <Line x1="12" y1="5" x2="12" y2="19" />
                      <Line x1="5" y1="12" x2="19" y2="12" />
                    </Svg>
                  </Animated.View>
                </LinearGradient>
              </Pressable>
              <Text
                style={[
                  styles.dockFabLabel,
                  isNotificarActive && styles.dockLabelActive,
                ]}
              >
                Notificar
              </Text>
            </View>

            {/* Tab 4 (Coordinator only): Alertas */}
            {isCoordenador && (
              <Pressable
                onPress={handleDockAlertasPress}
                style={styles.dockItem}
                accessibilityLabel="Alertas"
              >
                <View style={styles.dockAlertIcon}>
                  <DockAlertasIcon
                    size={22}
                    color={isAlertasActive ? '#6824D6' : '#796E92'}
                  />
                  {naoLidas > 0 && (
                    <View style={styles.dockAlertBadge}>
                      <Text style={styles.dockAlertBadgeText}>
                        {naoLidas > 99 ? '99+' : naoLidas}
                      </Text>
                    </View>
                  )}
                </View>
                <Text
                  style={[
                    styles.dockLabel,
                    isAlertasActive && styles.dockLabelActive,
                  ]}
                >
                  Alertas
                </Text>
              </Pressable>
            )}

            {/* Tab 5: Mais */}
            <Pressable onPress={handleDockMaisPress} style={styles.dockItem}>
              <DockMaisIcon
                size={22}
                color={isMaisActive ? '#6824D6' : '#796E92'}
              />
              <Text
                style={[
                  styles.dockLabel,
                  isMaisActive && styles.dockLabelActive,
                ]}
              >
                Mais
              </Text>
            </Pressable>
          </View>
        </KeyboardDock>

        {/* OVERLAYS (Exact z-index hierarchy from HTML) */}

        {/* 1. Como usar? Modal (#howto-modal, zIndex: 120) */}
        <HowToModal
          visible={howToVisible}
          isCoordenador={isCoordenador}
          onClose={() => setHowToVisible(false)}
          reduceMotion={reduceMotion}
        />

        {/* 2. Alterar responsável Modal (#reporter-modal, zIndex: 140) */}
        <ReporterModal
          visible={reporterModalVisible}
          currentName={reporterName}
          onSave={async (newName) => {
            await saveReporterNameToStorage(newName);
            setReporterName(newName);
            showToast('Responsável atualizado!');
          }}
          onError={message => showToast(message)}
          onClose={() => setReporterModalVisible(false)}
          reduceMotion={reduceMotion}
        />

        {/* 3. Detalhes / Modificar / Excluir Registro Modal (#record-details-overlay, zIndex: 145 & 155) */}
        <RecordDetailsModal
          visible={recordDetailsVisible}
          record={selectedRecord}
          onClose={() => setRecordDetailsVisible(false)}
          onUseServerRecord={isRecordOwner(selectedRecord, user?.uid) ? async () => {
            const restored = await acceptRemoteRecordInStorage(selectedRecord);
            setSelectedRecord(restored);
            await refreshRecords();
            showToast('Versão do servidor carregada. A cópia anterior foi preservada neste aparelho.');
          } : undefined}
          onSaveRecord={async (updatedRecord) => {
            if (!canModifyRecord(selectedRecord, user?.uid)) throw new Error('Esta ocorrência está disponível somente para consulta.');
            assertCanModifyRecord(updatedRecord, user?.uid);
            if (recordIdentity(updatedRecord) !== recordIdentity(selectedRecord)) throw new Error('A identidade original da ocorrência não pode ser alterada.');
            const savedRecord = await updateRecordInStorage(updatedRecord);
            setRecords(previous => previous.map(item => recordIdentity(item) === recordIdentity(savedRecord) ? savedRecord : item));
            setSelectedRecord(savedRecord);
            setRecordDetailsVisible(false);
            showToast('Registro atualizado!');
            syncRecords();
          }}
          onDeleteRecord={async (_id, reason) => {
            if (!canModifyRecord(selectedRecord, user?.uid)) throw new Error('Esta ocorrência está disponível somente para consulta.');
            const cancelled = await deleteRecordFromStorage(selectedRecord, reason);
            setRecords(previous => previous.map(item => recordIdentity(item) === recordIdentity(cancelled) ? cancelled : item));
            setRecordDetailsVisible(false);
            showToast('Ocorrência cancelada');
            syncRecords();
          }}
          canEdit={canModifyRecord(selectedRecord, user?.uid)}
          onExportPdf={() => { pendingPdfRecord.current = selectedRecord?._raw; setRecordDetailsVisible(false); }}
          onExited={() => {
            if (pendingPdfRecord.current) { setPdfRecord(pendingPdfRecord.current); pendingPdfRecord.current = null; }
          }}
          onOpenBottomSheet={(cfg) =>
            setBottomSheetConfig({
              visible: true,
              id: cfg.id,
              title: cfg.title,
              options: cfg.options,
              selectedValue: cfg.selectedValue,
              onSelect: (chosen) => {
                cfg.onSelect?.(chosen);
                setBottomSheetConfig((p) => ({
                  ...p,
                  visible: false,
                  selectedValue: chosen,
                }));
              },
            })
          }
          activeSheetFieldKey={
            bottomSheetConfig.visible ? bottomSheetConfig.id : null
          }
          onOpenCalendar={({ currentIso, onPicked }) =>
            setCalendarConfig({
              visible: true,
              mode: 'editor',
              selectedIso: currentIso,
              onPicked,
            })
          }
          isCalendarOpenForEditor={
            calendarConfig.visible && calendarConfig.mode === 'editor'
          }
          showToast={showToast}
          reduceMotion={reduceMotion}
        />

        <PdfOptionsSheet registro={pdfRecord} generating={generatingPdf} onClose={() => setPdfRecord(null)}
          onExited={() => { if (pendingPdf.current) { setPdf(pendingPdf.current); pendingPdf.current = null; } }}
          onSelect={async (registro, options) => {
            setGeneratingPdf(true);
            try { pendingPdf.current = await generateRegistroPdf(await withCloudPhotoRaw(registro), options); setPdfRecord(null); }
            catch (error) { showToast(error.message || 'Não foi possível gerar o PDF.'); }
            finally { setGeneratingPdf(false); }
          }} />
        <PdfViewerModal pdf={pdf} onClose={() => setPdf(null)}
          onError={() => { setPdf(null); showToast('Não foi possível abrir o PDF.'); }}
          onDownload={async () => {
            try { const result = await savePdf(pdf); if (result === 'saved') showToast('PDF salvo no local escolhido.'); if (result) setPdf(null); }
            catch (error) { showToast(error.message || 'Não foi possível salvar o PDF.'); }
          }} />

        {/* 4. Themed Info Modal (#themed-modal, zIndex: 160) */}
        <SignOutConfirmationModal visible={signOutDialog === 'open'}
          onClose={cancelSignOut} onConfirm={confirmSignOut} onExited={finishSignOutDialog}
          reduceMotion={reduceMotion} />
        <ThemedInfoModal
          visible={infoModalState.visible}
          title={infoModalState.title}
          message={infoModalState.message}
          onClose={() =>
            setInfoModalState((p) => ({ ...p, visible: false }))
          }
          reduceMotion={reduceMotion}
        />

        {/* 5. Shared Bottom Sheet Modal (#sheet-backdrop, zIndex: 210) */}
        <BottomSheetModal
          visible={bottomSheetConfig.visible}
          bottomInset={bottomInset}
          title={bottomSheetConfig.title}
          options={bottomSheetConfig.options}
          selectedValue={bottomSheetConfig.selectedValue}
          onSelect={(opt) => {
            bottomSheetConfig.onSelect?.(opt);
            setBottomSheetConfig(p => ({
              ...p,
              visible: false,
              selectedValue: opt?.id ?? opt?.value ?? opt,
            }));
          }}
          onClose={() =>
            setBottomSheetConfig((p) => ({ ...p, visible: false }))
          }
          reduceMotion={reduceMotion}
        />

        {/* 6. Custom App Calendar Modal (#app-calendar-overlay, zIndex: 230) */}
        <AppCalendarModal
          visible={calendarConfig.visible}
          selectedIsoDate={calendarConfig.selectedIso}
          onSelectDate={(picked) => {
            calendarConfig.onPicked?.(picked);
          }}
          onClose={() =>
            setCalendarConfig((p) => ({ ...p, visible: false }))
          }
          reduceMotion={reduceMotion}
        />

        {/* 7. Guia Interativo Spotlight */}
        <SpotlightGuideModal
          visible={guideVisible}
          onReady={reportInitialReady}
          currentTab={activeTab}
          isCoordenador={isCoordenador}
          bottomInset={bottomInset}
          onSwitchTab={(targetTab) => {
            setActiveVictimSubscreen(null);
            setActiveMaisSubscreen(null);
            setActiveTab(targetTab);
          }}
          targetRefs={guideTargetRefs}
          scrollTargets={guideScrollTargets}
          dockRef={guideDockRef}
          onComplete={handleCompleteGuide}
          onSkip={handleSkipGuide}
          onExited={handleGuideExited}
          reduceMotion={reduceMotion}
        />

        {/* 8. Tela de Boas-Vindas Animada */}
        <SpotlightWelcomeModal
          visible={welcomeVisible}
          onClose={() => setWelcomeVisible(false)}
          onExited={() => {
            handleDockRegistrosPress();
            setDataEnabled(true);
          }}
          reduceMotion={reduceMotion}
        />

        {/* 9. Toast Notification (#toast, zIndex: 300) */}
        <SwipeDismissibleToast ref={toastRef} reduceMotion={reduceMotion} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeRoot: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  appContainer: {
    flex: 1,
    backgroundColor: '#F8F7FC',
    position: 'relative',
  },
  screenViewport: {
    flex: 1,
  },
  bottomDockContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 94,
    zIndex: 50,
  },
  bottomDockSurface: {
    position: 'absolute',
    top: 18,
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1.5,
    borderTopColor: '#EFE9FE',
  },
  bottomDockRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 16,
    paddingBottom: 14,
  },
  dockItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 4,
  },
  dockLabel: {
    fontSize: 11,
    fontFamily: 'PlusJakartaSans-Bold',
    color: '#796E92',
    includeFontPadding: false,
  },
  dockLabelActive: {
    color: '#6824D6',
  },
  dockFabWrapper: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  dockFab: {
    width: 54,
    height: 54,
    borderRadius: 18,
    borderWidth: 4,
    borderColor: '#FFFFFF',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 10,
    shadowColor: '#6824D6',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 20,
  },
  dockFabBgClip: {
    width: '100%',
    height: '100%',
    borderRadius: 14,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dockFabActiveOverlay: {
    backgroundColor: '#1C0D36',
  },
  dockFabLabel: {
    fontSize: 11,
    fontFamily: 'PlusJakartaSans-Bold',
    color: '#796E92',
    marginTop: 3,
    includeFontPadding: false,
  },
  bottomDockRowAdmin: {
    paddingHorizontal: 3,
  },
  dockAlertIcon: {
    position: 'relative',
    width: 22,
    height: 22,
  },
  dockAlertBadge: {
    position: 'absolute',
    top: -6,
    right: -8,
    backgroundColor: '#DC2626',
    borderWidth: 2,
    borderColor: '#FFFFFF',
    borderRadius: 12,
    minWidth: 17,
    height: 17,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  dockAlertBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#FFFFFF',
    lineHeight: 11,
  },
});
