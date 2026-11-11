import { Animated, Pressable, ScrollView, Text, TextInput, View } from '../../ui/AccessibleNative';
import React, { useEffect, useRef, useState } from 'react';
import { BackHandler, Easing, Image, LayoutAnimation, Linking, StyleSheet, useWindowDimensions } from 'react-native';
import useSpotlightScroll from '../../ui/useSpotlightScroll';
import MainScreenHeader from '../../ui/MainScreenHeader';
import ScrollViewWithScrollbar from '../../ui/ScrollViewWithScrollbar';
import useAccessibility from '../../hooks/useAccessibility';
import useReduceMotion from '../../ui/useReduceMotion';
import useSpeakOnMount from '../../hooks/useSpeakOnMount';
import { sentences } from '../../services/accessibilityDescriptions';
import {
  ArrowLeftIcon,
  ArrowUpRightIcon,
  BookOpenIcon,
  CameraIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  DoubtsBubbleIcon,
  EyeIcon,
  EyeOffIcon,
  GalleryImageIcon,
  GuideCompassIcon,
  HelpCircleIcon,
  InfoCircleIcon,
  LockIcon,
  LogOutIcon,
  PlusIcon,
  SearchIcon,
  SettingsGearIcon,
  UsersIcon,
} from '../../ui/SismorcegoIcons';
import { getReporterInitials } from '../../services/sismorcegoData';
import { pickRegistroPhoto } from '../../services/deviceCapture';
import AnimatedOverlay from '../../ui/AnimatedOverlay';
import ZoomableImageModal from '../../ui/ZoomableImageModal';
import { hasProfileChanges, normalizedProfile } from '../../services/editChanges';
import { FIREBASE_PUSH_BACKEND_READY } from '../../services/firebaseIntegration';

const IMG_DIVERSIDADE = require('../../assets/images/InfoDiversidadeMorcegos.jpg');
const IMG_RAIVA = require('../../assets/images/InfoDoencaRaiva.jpg');
const IMG_DRA = require('../../assets/images/DRA.jpg');
const IMG_PEDRO = require('../../assets/images/pedro.jpg');
const IMG_ANDRE = require('../../assets/images/andre.png');
const IMG_PAULO = require('../../assets/images/paulo.png');
const IMG_SERUFFO = require('../../assets/images/seruffo.png');

const CREDITS_GROUPS = [
  {
    id: 'tecnologia',
    title: 'Tecnologia',
    countLabel: '5 participantes',
    members: [
      { name: 'Pedro Dimas', role: 'Bolsista', photo: IMG_PEDRO, initials: 'PD' },
      {
        name: 'André Vinicius',
        role: 'Bolsista',
        photo: IMG_ANDRE,
        initials: 'AV',
      },
      {
        name: 'Bradsson Santos',
        role: 'Bolsista',
        photo: null,
        initials: 'BS',
      },
      {
        name: 'Paulo Pontes',
        role: 'Orientador',
        photo: IMG_PAULO,
        initials: 'PP',
      },
      {
        name: 'Marcos Seruffo',
        role: 'Orientador',
        photo: IMG_SERUFFO,
        initials: 'MS',
      },
    ],
  },
  {
    id: 'traducao',
    title: 'Tradução do Conhecimento',
    countLabel: 'Sem participantes informados',
    members: [],
  },
  {
    id: 'campo',
    title: 'Campo/Laboratório',
    countLabel: 'Sem participantes informados',
    members: [],
  },
  {
    id: 'determinantes',
    title: 'Determinantes sociais',
    countLabel: 'Sem participantes informados',
    members: [],
  },
];

function AnimatedSwitch({ value, onToggle, label, disabled = false, reduceMotion = false }) {
  const { highContrast } = useAccessibility();
  const anim = useRef(new Animated.Value(value ? 1 : 0)).current;

  useEffect(() => {
    if (reduceMotion) {
      anim.setValue(value ? 1 : 0);
    } else {
      const animation = Animated.timing(anim, {
        toValue: value ? 1 : 0,
        duration: 200,
        easing: Easing.out(Easing.ease),
        useNativeDriver: false,
      });
      animation.start();
      return () => animation.stop();
    }
  }, [value, reduceMotion, anim]);

  const bg = anim.interpolate({
    inputRange: [0, 1],
    outputRange: ['#DFD2FA', '#6824D6'],
  });
  const translateX = anim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 20],
  });

  return (
    <Pressable onPress={onToggle} disabled={disabled} accessibilityRole="switch" accessibilityLabel={label} accessibilityState={{ checked: value, disabled }}>
      <Animated.View style={[styles.switchTrack, { backgroundColor: highContrast ? (value ? '#FFD700' : '#18181F') : bg, borderWidth: highContrast ? 1 : 0, borderColor: '#FFD700' }]}>
        <Animated.View
          style={[styles.switchKnob, { backgroundColor: highContrast && value ? '#000000' : '#FFFFFF', transform: [{ translateX }] }]}
        />
      </Animated.View>
    </Pressable>
  );
}

function CreditGroupAccordion({ group, reduceMotion = false }) {
  const [open, setOpen] = useState(false);
  const anim = useRef(new Animated.Value(0)).current;
  const previousOpen = useRef(false);
  const [contentHeight, setContentHeight] = useState(null);
  useEffect(() => {
    if (reduceMotion || previousOpen.current === open) { anim.setValue(open ? 1 : 0); previousOpen.current = open; return; }
    previousOpen.current = open;
    const animation = Animated.timing(anim, { toValue: open ? 1 : 0, duration: 200,
      easing: Easing.bezier(0.22, 0.82, 0.25, 1), useNativeDriver: false });
    animation.start();
    return () => animation.stop();
  }, [reduceMotion, open, anim]);

  const toggle = () => {
    setOpen(value => !value);
  };

  const targetHeight = contentHeight ?? (group.members.length > 0 ? group.members.length * 73 : 56);
  const maxHeight = anim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, targetHeight],
  });
  const rotate = anim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '180deg'],
  });

  return (
    <View style={styles.creditGroup}>
      <Pressable
        onPress={toggle}
        style={({ pressed }) => [
          styles.creditHeader,
          pressed && { backgroundColor: '#FAF8FF' },
        ]}
      >
        <Text style={styles.creditTitle}>{group.title}</Text>
        <View style={styles.creditMeta}>
          <Text style={styles.creditCount}>{group.countLabel}</Text>
          <Animated.View style={{ transform: [{ rotate }] }}>
            <ChevronDownIcon size={18} color="#5316B8" strokeWidth={2.2} />
          </Animated.View>
        </View>
      </Pressable>

      <Animated.View
        style={[
          styles.creditBodyWrap,
          {
            maxHeight,
            opacity: anim,
            borderTopWidth: open ? 1 : 0,
          },
        ]}
      >
        <View style={styles.creditBodyInner} onLayout={event => setContentHeight(event.nativeEvent.layout.height)}>
          {group.members.length > 0 ? (
            group.members.map((m, idx) => (
              <View
                key={m.name}
                style={[
                  styles.creditMember,
                  idx === group.members.length - 1 && { borderBottomWidth: 0 },
                ]}
              >
                {m.photo ? (
                  <Image
                    source={m.photo}
                    style={styles.creditMemberPhoto}
                    resizeMode="cover"
                    resizeMethod="resize"
                  />
                ) : (
                  <View style={styles.creditMemberPlaceholder}>
                    <Text style={styles.creditMemberPlaceholderText}>
                      {m.initials}
                    </Text>
                  </View>
                )}
                <View style={{ flex: 1 }}>
                  <Text style={styles.creditMemberName}>{m.name}</Text>
                  <Text style={styles.creditMemberRole}>{m.role}</Text>
                </View>
              </View>
            ))
          ) : (
            <Text style={styles.creditEmptyText}>
              Os participantes deste eixo ainda não foram informados.
            </Text>
          )}
        </View>
      </Animated.View>
    </View>
  );
}

export default function MaisScreens({
  activeSubscreen,
  setActiveSubscreen,
  accountProfile,
  onSaveAccountProfile,
  onSaveAvatarPhoto,
  doubtsView,
  setDoubtsView,
  doubts,
  answeredDoubts = [],
  doubtsLoading,
  doubtsError,
  onCreateDoubt,
  onDeleteDoubt,
  onChangePassword,
  onResetPassword,
  notificationsEnabled,
  onToggleNotifications,
  coordinator,
  accessibility,
  onUpdateAccessibility,
  onSignOut,
  showToast,
  onOpenInteractiveGuide,
  menuGuideRef,
  guideScroll,
  bottomInset = 0,
  keyboardVisible = false,
}) {
  const systemReduceMotion = useReduceMotion();
  const reduceMotion = Boolean(accessibility?.reduceMotion || systemReduceMotion);
  const { ttsError, ttsInitializing, speak } = useAccessibility();
  const guideScrollProps = useSpotlightScroll(guideScroll);
  const { width: windowWidth } = useWindowDimensions();
  // Account state
  // Imagem informativa aberta em tela cheia com zoom ({ source, title, aspectRatio }).
  const [zoomImage, setZoomImage] = useState(null);
  const [zoomVisible, setZoomVisible] = useState(false);
  const openZoom = image => { setZoomImage(image); setZoomVisible(true); };
  const [username, setUsername] = useState(
    accountProfile?.username || '',
  );
  const [email, setEmail] = useState(
    accountProfile?.email || '',
  );
  const [photoUri, setPhotoUri] = useState(accountProfile?.photoUri || null);
  const [accountBaseline, setAccountBaseline] = useState(() => normalizedProfile(accountProfile));
  const accountChanged = hasProfileChanges(accountBaseline, { username, email, photoUri });
  const [focusedField, setFocusedField] = useState(null);

  // Password state
  const [newPass, setNewPass] = useState('');
  const [confirmPass, setConfirmPass] = useState('');
  const [showNewPass, setShowNewPass] = useState(false);
  const [showConfirmPass, setShowConfirmPass] = useState(false);
  const [newPassErr, setNewPassErr] = useState(false);
  const [confirmPassErr, setConfirmPassErr] = useState(false);

  // Settings state
  const fontPercent = Math.round((accessibility?.fontScale || 1) * 100);
  const [accountSaving, setAccountSaving] = useState(false);
  const accountSavingRef = useRef(false);

  // Doubts state
  const doubtsScrollRef = useRef(null);
  const [doubtInput, setDoubtInput] = useState('');
  const [activeDraftId, setActiveDraftId] = useState(null);
  const [doubtSaving, setDoubtSaving] = useState(false);
  const [expandedDoubtIds, setExpandedDoubtIds] = useState({});
  const [pendingDeleteDoubtId, setPendingDeleteDoubtId] = useState(null);
  useSpeakOnMount(activeSubscreen === 'sub-settings'
    ? sentences('Configurações de acessibilidade', `Alto contraste ${accessibility?.highContrast ? 'ativado' : 'desativado'}`,
      `Leitura por voz ${accessibility?.ttsEnabled ? 'ativada' : 'desativada'}`, `Tamanho do texto: ${fontPercent} por cento`,
      `Redução de animações ${reduceMotion ? 'ativada' : 'desativada'}`, 'Use Ouvir exemplo de leitura para testar o áudio')
    : activeSubscreen === 'sub-account' ? 'Minha conta. Foto do perfil e dados pessoais. Alterar senha e salvar alterações'
    : activeSubscreen === 'sub-password' ? 'Alterar senha. Informe a nova senha e a confirmação. O conteúdo das senhas não será lido'
    : activeSubscreen === 'sub-faq' ? sentences(doubtsView === 'compose' ? 'Nova dúvida. Escreva sua pergunta e toque em Enviar pergunta'
      : doubtsView === 'faq' ? 'Perguntas frequentes' : 'Minhas perguntas',
      doubtsView === 'compose' ? '' : (doubtsView === 'faq' ? answeredDoubts : doubts || []).slice(0, 3).map(item => sentences(item.question, item.answer)))
    : ({ 'sub-info': 'Informativos. Diversidade de morcegos e materiais educativos', 'sub-about': 'Sobre o projeto Sismorcego', 'sub-credits': 'Créditos. Equipe e participantes do projeto' })[activeSubscreen]
      || 'Mais opções. Minha conta, configurações, informativos, dúvidas, sobre o projeto e créditos');
  useSpeakOnMount('Excluir pergunta? Deseja excluir esta pergunta e sua resposta? Escolha Cancelar ou Excluir', { active: pendingDeleteDoubtId !== null, priority: 30 });
  useEffect(() => {
    if (pendingDeleteDoubtId === null) return;
    const listener = BackHandler.addEventListener('hardwareBackPress', () => { setPendingDeleteDoubtId(null); return true; });
    return () => listener.remove();
  }, [pendingDeleteDoubtId]);
  useEffect(() => {
    if (activeSubscreen === 'sub-faq') {
      doubtsScrollRef.current?.scrollTo({ y: 0, animated: false });
    }
  }, [activeSubscreen, doubtsView]);

  // Floating question bubble animation
  const floatAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (reduceMotion || activeSubscreen !== 'sub-faq') {
      floatAnim.setValue(0);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(floatAnim, {
          toValue: -4,
          duration: 2250,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(floatAnim, {
          toValue: 0,
          duration: 2250,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [reduceMotion, floatAnim, activeSubscreen]);

  useEffect(() => {
    setUsername(accountProfile?.username || '');
    setAccountBaseline(previous => ({ ...previous, username: accountProfile?.username || '' }));
  }, [accountProfile?.username]);
  useEffect(() => {
    setEmail(accountProfile?.email || '');
    setAccountBaseline(previous => ({ ...previous, email: accountProfile?.email || '' }));
  }, [accountProfile?.email]);
  useEffect(() => {
    setPhotoUri(accountProfile?.photoUri || null);
    setAccountBaseline(previous => ({ ...previous, photoUri: accountProfile?.photoUri || null }));
  }, [accountProfile?.photoUri]);

  const handlePickAvatarPhoto = async (source) => {
    if (accountSavingRef.current) return;
    accountSavingRef.current = true;
    setAccountSaving(true);
    try {
      const photo = await pickRegistroPhoto(source);
      if (photo) {
        await onSaveAvatarPhoto(photo.localUri);
        setPhotoUri(photo.localUri);
        setAccountBaseline(previous => ({ ...previous, photoUri: photo.localUri }));
        showToast?.('Foto atualizada!');
      }
    } catch (e) {
      showToast?.(e.message || 'Não foi possível atualizar a foto.');
    } finally { accountSavingRef.current = false; setAccountSaving(false); }
  };

  /* 1. MINHA CONTA */
  if (activeSubscreen === 'sub-account') {
    const initials = getReporterInitials(username);
    return (
      <View style={styles.screen}>
        <View style={styles.subHeader}>
          <Pressable
            onPress={() => setActiveSubscreen(null)}
            style={({ pressed }) => [
              styles.backBtn,
              pressed && styles.backBtnPressed,
            ]}
          >
            <ArrowLeftIcon size={18} color="#5316B8" />
          </Pressable>
          <Text style={styles.subTitle}>Minha conta</Text>
        </View>

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={[styles.subContent, keyboardVisible && styles.keyboardContent]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <View style={[styles.sectionCard, { alignItems: 'center', paddingVertical: 20 }]}>
            <View style={styles.largeAvatarWrap}>
              {photoUri ? (
                <Image source={{ uri: photoUri }} style={styles.largeAvatarImg} />
              ) : (
                <Text style={styles.largeAvatarText}>{initials}</Text>
              )}
            </View>

            <View style={styles.avatarBtnRow}>
              <Pressable
                onPress={() => handlePickAvatarPhoto('gallery')}
                style={({ pressed }) => [
                  styles.avatarActionBtn,
                  pressed && { opacity: 0.85 },
                ]}
              >
                <GalleryImageIcon size={17} color="#6824D6" />
                <Text style={styles.avatarActionBtnText}>Galeria</Text>
              </Pressable>
              <Pressable
                onPress={() => handlePickAvatarPhoto('camera')}
                style={({ pressed }) => [
                  styles.avatarActionBtn,
                  pressed && { opacity: 0.85 },
                ]}
              >
                <CameraIcon size={17} color="#6824D6" />
                <Text style={styles.avatarActionBtnText}>Câmera</Text>
              </Pressable>
            </View>
          </View>

          <View style={styles.sectionCard}>
            <Text style={styles.cardEyebrow}>DADOS PESSOAIS</Text>
            <View style={styles.fieldBlock}>
              <Text style={styles.fieldLabel}>Nome de usuário</Text>
              <TextInput
                style={[
                  styles.textInput,
                  focusedField === 'acc_user' && styles.textInputFocused,
                ]}
                value={username}
                accessibilityLabel="Nome de usuário"
                onChangeText={setUsername}
                onFocus={() => setFocusedField('acc_user')}
                onBlur={() => setFocusedField(null)}
              />
            </View>
            <View style={[styles.fieldBlock, { marginBottom: 0 }]}>
              <Text style={styles.fieldLabel}>E-mail</Text>
              <TextInput
                style={[
                  styles.textInput,
                  focusedField === 'acc_email' && styles.textInputFocused,
                ]}
                value={email}
                accessibilityLabel="E-mail"
                onChangeText={setEmail}
                onFocus={() => setFocusedField('acc_email')}
                onBlur={() => setFocusedField(null)}
                keyboardType="email-address"
                autoCapitalize="none"
              />
            </View>
          </View>

          <Pressable
            onPress={() => {
              setNewPass('');
              setConfirmPass('');
              setNewPassErr(false);
              setConfirmPassErr(false);
              setActiveSubscreen('sub-password');
            }}
            style={({ pressed }) => [
              styles.forgotPassBtn,
              styles.accountPasswordBtn,
              pressed && { opacity: 0.85 },
            ]}
          >
            <LockIcon size={17} color="#6824D6" />
            <Text style={styles.forgotPassBtnText}>Alterar senha</Text>
          </Pressable>

          <Pressable
            disabled={accountSaving || !accountChanged}
            accessibilityRole="button"
            accessibilityState={{ disabled: accountSaving || !accountChanged }}
            onPress={async () => {
              if (accountSavingRef.current || !accountChanged) return;
              const requested = normalizedProfile({ username, email, photoUri });
              accountSavingRef.current = true;
              setAccountSaving(true);
              try {
                await onSaveAccountProfile(requested);
                setAccountBaseline(requested);
                showToast?.('Perfil atualizado!');
              } catch (error) { showToast?.(error.message || 'Não foi possível atualizar o perfil.'); }
              finally { accountSavingRef.current = false; setAccountSaving(false); }
            }}
            style={({ pressed }) => [
              styles.primaryBtn,
              (accountSaving || !accountChanged) && styles.primaryBtnDisabled,
              pressed && !accountSaving && accountChanged && styles.primaryBtnPressed,
            ]}
          >
            <Text style={[styles.primaryBtnText, (accountSaving || !accountChanged) && styles.primaryBtnDisabledText]}>{accountSaving ? 'Salvando...' : 'Salvar alterações'}</Text>
          </Pressable>
        </ScrollView>
      </View>
    );
  }

  /* 2. ALTERAR SENHA */
  if (activeSubscreen === 'sub-password') {
    const handleSavePassword = async () => {
      if (accountSavingRef.current) return;
      let ok = true;
      if (newPass.trim().length < 6) {
        setNewPassErr(true);
        ok = false;
      } else {
        setNewPassErr(false);
      }
      if (!confirmPass.trim() || confirmPass !== newPass) {
        setConfirmPassErr(true);
        ok = false;
      } else {
        setConfirmPassErr(false);
      }
      if (!ok) {
        showToast?.('Verifique os campos da nova senha');
        return;
      }
      accountSavingRef.current = true;
      setAccountSaving(true);
      try {
        await onChangePassword(newPass);
        setNewPass('');
        setConfirmPass('');
        showToast?.('Senha alterada com sucesso!');
        setActiveSubscreen('sub-account');
      } catch (error) { showToast?.(error.message || 'Não foi possível alterar a senha.'); }
      finally { accountSavingRef.current = false; setAccountSaving(false); }
    };

    return (
      <View style={styles.screen}>
        <View style={styles.subHeader}>
          <Pressable
            onPress={() => setActiveSubscreen('sub-account')}
            style={({ pressed }) => [
              styles.backBtn,
              pressed && styles.backBtnPressed,
            ]}
          >
            <ArrowLeftIcon size={18} color="#5316B8" />
          </Pressable>
          <Text style={styles.subTitle}>Alterar senha</Text>
        </View>

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={[styles.subContent, keyboardVisible && styles.keyboardContent]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.sectionCard}>
            <Text style={[styles.cardEyebrow, { marginBottom: 6 }]}>
              NOVA SENHA DE ACESSO
            </Text>
            <Text style={styles.passwordHint}>
              Crie uma nova senha para entrar no app. Use pelo menos 6
              caracteres.
            </Text>

            <View style={styles.fieldBlock}>
              <Text style={styles.fieldLabel}>Nova senha</Text>
              <View style={styles.passwordInputWrap}>
                <TextInput
                  style={[
                    styles.textInput,
                    { paddingRight: 44 },
                    focusedField === 'pw_new' && styles.textInputFocused,
                    newPassErr && styles.inputError,
                  ]}
                  value={newPass}
                  accessibilityLabel="Nova senha"
                  onChangeText={(t) => {
                    setNewPass(t);
                    if (newPassErr && t.trim().length >= 6) setNewPassErr(false);
                  }}
                  onFocus={() => setFocusedField('pw_new')}
                  onBlur={() => setFocusedField(null)}
                  secureTextEntry={!showNewPass}
                />
                <Pressable
                  onPress={() => setShowNewPass((p) => !p)}
                  style={styles.eyeToggleBtn}
                >
                  {showNewPass ? (
                    <EyeOffIcon size={18} color="#5E5473" />
                  ) : (
                    <EyeIcon size={18} color="#5E5473" />
                  )}
                </Pressable>
              </View>
              {newPassErr ? (
                <Text style={styles.errorText}>
                  A senha deve ter pelo menos 6 caracteres.
                </Text>
              ) : null}
            </View>

            <View style={[styles.fieldBlock, { marginBottom: 0 }]}>
              <Text style={styles.fieldLabel}>Confirmar nova senha</Text>
              <View style={styles.passwordInputWrap}>
                <TextInput
                  style={[
                    styles.textInput,
                    { paddingRight: 44 },
                    focusedField === 'pw_confirm' && styles.textInputFocused,
                    confirmPassErr && styles.inputError,
                  ]}
                  value={confirmPass}
                  accessibilityLabel="Confirmar nova senha"
                  onChangeText={(t) => {
                    setConfirmPass(t);
                    if (confirmPassErr && t === newPass)
                      setConfirmPassErr(false);
                  }}
                  onFocus={() => setFocusedField('pw_confirm')}
                  onBlur={() => setFocusedField(null)}
                  secureTextEntry={!showConfirmPass}
                />
                <Pressable
                  onPress={() => setShowConfirmPass((p) => !p)}
                  style={styles.eyeToggleBtn}
                >
                  {showConfirmPass ? (
                    <EyeOffIcon size={18} color="#5E5473" />
                  ) : (
                    <EyeIcon size={18} color="#5E5473" />
                  )}
                </Pressable>
              </View>
              {confirmPassErr ? (
                <Text style={styles.errorText}>As senhas não coincidem.</Text>
              ) : null}
            </View>
          </View>

          <Pressable
            onPress={handleSavePassword}
            disabled={accountSaving}
            style={({ pressed }) => [
              styles.primaryBtn,
              pressed && styles.primaryBtnPressed,
            ]}
          >
            <Text style={styles.primaryBtnText}>{accountSaving ? 'Salvando...' : 'Salvar nova senha'}</Text>
          </Pressable>
          <Pressable style={styles.forgotPassBtn} onPress={async () => {
            try { await onResetPassword(); showToast?.('Email de recuperação enviado para sua conta.'); }
            catch (error) { showToast?.(error.message || 'Não foi possível enviar o email de recuperação.'); }
          }}><Text style={styles.forgotPassBtnText}>Receber email de recuperação</Text></Pressable>
        </ScrollView>
      </View>
    );
  }

  /* 3. CONFIGURAÇÕES */
  if (activeSubscreen === 'sub-settings') {
    const steps = [85, 100, 115, 130];
    const adjustFont = (dir) => {
      const next = dir > 0 ? steps.find(step => step > fontPercent) ?? steps.at(-1) : [...steps].reverse().find(step => step < fontPercent) ?? steps[0];
      onUpdateAccessibility?.({ fontScale: next / 100 });
    };

    return (
      <View style={styles.screen}>
        <View style={styles.subHeader}>
          <Pressable
            onPress={() => setActiveSubscreen(null)}
            style={({ pressed }) => [
              styles.backBtn,
              pressed && styles.backBtnPressed,
            ]}
          >
            <ArrowLeftIcon size={18} color="#5316B8" />
          </Pressable>
          <Text style={styles.subTitle}>Configurações</Text>
        </View>

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={[styles.subContent, keyboardVisible && styles.keyboardContent]}
          showsVerticalScrollIndicator={false}
        >
          <View style={[styles.sectionCard, { paddingVertical: 6 }]}>
            <Text style={[styles.cardEyebrow, { paddingTop: 12, marginBottom: 4 }]}>
              ACESSIBILIDADE VISUAL E AUDITIVA
            </Text>

            <View style={styles.toggleRow}>
              <View style={styles.toggleInfo}>
                <Text style={styles.toggleTitle}>Alto contraste</Text>
                <Text style={styles.toggleSub}>
                  Fundo escuro e destaques reforçados
                </Text>
              </View>
              <AnimatedSwitch
                label="Alto contraste"
                value={Boolean(accessibility?.highContrast)}
                onToggle={() =>
                  onUpdateAccessibility?.({
                    highContrast: !accessibility?.highContrast,
                  })
                }
                reduceMotion={reduceMotion}
              />
            </View>

            <View style={styles.toggleRow}>
              <View style={styles.toggleInfo}>
                <Text style={styles.toggleTitle}>Leitura em voz alta</Text>
                <Text style={styles.toggleSub}>
                  O app fala o conteúdo das telas
                </Text>
              </View>
              <AnimatedSwitch
                label="Leitura em voz alta"
                disabled={ttsInitializing}
                value={Boolean(accessibility?.ttsEnabled)}
                onToggle={() =>
                  onUpdateAccessibility?.({
                    ttsEnabled: !accessibility?.ttsEnabled,
                  })
                }
                reduceMotion={reduceMotion}
              />
            </View>

            {ttsInitializing && <Text accessibilityLiveRegion="polite" style={styles.toggleSub}>Preparando leitura por voz…</Text>}
            {!!ttsError && <Text accessibilityLiveRegion="polite" style={styles.toggleSub}>{ttsError}</Text>}
            <Pressable accessibilityRole="button" accessibilityLabel="Ouvir exemplo de leitura" disabled={!accessibility?.ttsEnabled || ttsInitializing}
              style={styles.fontStepBtn} onPress={async () => {
                const success = await speak('Leitura por voz do Sismorcego. Os títulos, resumos e detalhes das telas serão lidos em português.');
                if (!success) showToast?.('Não foi possível reproduzir a leitura. Confira as configurações de voz do celular.');
              }}>
              <Text style={styles.fontStepBtnText}>Ouvir exemplo de leitura</Text>
            </Pressable>
            {accessibility?.canAdjustMotion !== false && <View style={[styles.toggleRow, { borderBottomWidth: 0 }]}>
              <View style={styles.toggleInfo}>
                <Text style={styles.toggleTitle}>Reduzir animações</Text>
                <Text style={styles.toggleSub}>
                  {accessibility?.systemReduceMotion ? 'A redução de movimento do celular também está ativa' : 'Desativa efeitos de movimento entre telas'}
                </Text>
              </View>
              <AnimatedSwitch
                label="Reduzir animações"
                value={Boolean(accessibility?.preferredReduceMotion ?? accessibility?.reduceMotion)}
                onToggle={() => {
                  const next = !(accessibility?.preferredReduceMotion ?? accessibility?.reduceMotion);
                  onUpdateAccessibility?.({ reduceMotion: next });
                  showToast?.(
                    next ? 'Animações desativadas' : accessibility?.systemReduceMotion ? 'A redução de movimento do celular continua ativa' : 'Animações ativadas',
                  );
                }}
                reduceMotion={reduceMotion}
              />
            </View>}
          </View>

          <View style={styles.sectionCard}>
            <View style={styles.fontHeaderRow}>
              <Text style={styles.toggleTitle}>Tamanho do texto</Text>
              <Text style={styles.fontPercentText}>{`${fontPercent}%`}</Text>
            </View>
            <Text
              style={[
                styles.fontSampleText,
                { fontSize: 14 },
              ]}
            >
              Assim o texto aparece nas telas do app.
            </Text>
            <View style={styles.fontBtnsRow}>
              <Pressable
                onPress={() => adjustFont(-1)}
                accessibilityRole="button" accessibilityLabel="Diminuir tamanho do texto" disabled={fontPercent <= 85}
                style={({ pressed }) => [
                  styles.fontStepBtn,
                  pressed && { backgroundColor: '#F6F3FF' },
                ]}
              >
                <Text style={styles.fontStepBtnText}>− Diminuir</Text>
              </Pressable>
              <Pressable
                onPress={() => adjustFont(1)}
                accessibilityRole="button" accessibilityLabel="Aumentar tamanho do texto" disabled={fontPercent >= 130}
                style={({ pressed }) => [
                  styles.fontStepBtn,
                  pressed && { backgroundColor: '#F6F3FF' },
                ]}
              >
                <Text style={styles.fontStepBtnText}>+ Aumentar</Text>
              </Pressable>
            </View>
          </View>

          {coordinator && (
            <View style={[styles.sectionCard, { paddingVertical: 6 }]}>
              <Text style={[styles.cardEyebrow, { paddingTop: 12, marginBottom: 4 }]}>
                AVISOS
              </Text>
              <View style={[styles.toggleRow, { borderBottomWidth: 0 }]}>
                <View style={styles.toggleInfo}>
                  <Text style={styles.toggleTitle}>{FIREBASE_PUSH_BACKEND_READY ? 'Notificações' : 'Alertas no aplicativo'}</Text>
                  <Text style={styles.toggleSub}>
                    {FIREBASE_PUSH_BACKEND_READY ? 'Receber avisos do SisMorcego' : 'Disponíveis na central com o app aberto e conectado. Push com o app fechado ainda indisponível.'}
                  </Text>
                </View>
                {FIREBASE_PUSH_BACKEND_READY && <AnimatedSwitch
                  label="Notificações"
                  value={notificationsEnabled}
                  onToggle={async () => {
                    try { await onToggleNotifications(!notificationsEnabled); }
                    catch (error) { showToast?.(error.message || 'Não foi possível alterar as notificações.'); }
                  }}
                  reduceMotion={reduceMotion}
                />}
              </View>
            </View>
          )}
        </ScrollView>
      </View>
    );
  }

  /* 4. INFORMATIVOS */
  if (activeSubscreen === 'sub-info') {
    const infoImgWidth = Math.max(200, windowWidth - 40 - 32 - 3);
    return (
      <View style={styles.screen}>
        <View style={styles.subHeader}>
          <Pressable
            onPress={() => setActiveSubscreen(null)}
            style={({ pressed }) => [
              styles.backBtn,
              pressed && styles.backBtnPressed,
            ]}
          >
            <ArrowLeftIcon size={18} color="#5316B8" />
          </Pressable>
          <Text style={styles.subTitle}>Informativos</Text>
        </View>

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={[styles.subContent, keyboardVisible && styles.keyboardContent]}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.infoPosterCard}>
            <Text style={styles.infoPosterTitle}>Diversidade de morcegos</Text>
            <Pressable
              accessibilityRole="imagebutton"
              accessibilityLabel="Ampliar imagem: Diversidade de morcegos"
              onPress={() => openZoom({ source: IMG_DIVERSIDADE, title: 'Diversidade de morcegos', aspectRatio: 1600 / 1131 })}
              style={({ pressed }) => [styles.infoBannerFrame, pressed && styles.infoBannerPressed]}
            >
              <Image
                source={IMG_DIVERSIDADE}
                style={{
                  width: infoImgWidth,
                  height: Math.round(infoImgWidth * (1131 / 1600)),
                }}
                resizeMode="cover"
                resizeMethod="resize"
              />
              <View style={styles.zoomChip} pointerEvents="none">
                <SearchIcon size={13} color="#FFFFFF" strokeWidth={2.6} />
                <Text style={styles.zoomChipText}>Toque para ampliar</Text>
              </View>
            </Pressable>
          </View>

          <View style={styles.infoPosterCard}>
            <Text style={styles.infoPosterTitle}>A doença raiva</Text>
            <Pressable
              accessibilityRole="imagebutton"
              accessibilityLabel="Ampliar imagem: A doença raiva"
              onPress={() => openZoom({ source: IMG_RAIVA, title: 'A doença raiva', aspectRatio: 1600 / 2114 })}
              style={({ pressed }) => [styles.infoBannerFrame, pressed && styles.infoBannerPressed]}
            >
              <Image
                source={IMG_RAIVA}
                style={{
                  width: infoImgWidth,
                  height: Math.round(infoImgWidth * (2114 / 1600)),
                }}
                resizeMode="cover"
                resizeMethod="resize"
              />
              <View style={styles.zoomChip} pointerEvents="none">
                <SearchIcon size={13} color="#FFFFFF" strokeWidth={2.6} />
                <Text style={styles.zoomChipText}>Toque para ampliar</Text>
              </View>
            </Pressable>
          </View>
        </ScrollView>
        <ZoomableImageModal
          visible={zoomVisible}
          source={zoomImage?.source}
          title={zoomImage?.title}
          aspectRatio={zoomImage?.aspectRatio}
          onClose={() => setZoomVisible(false)}
        />
      </View>
    );
  }

  /* 5. DÚVIDAS */
  if (activeSubscreen === 'sub-faq') {
    const isDoubtsList = doubtsView === 'list';
    // O histórico recebe o espaço restante; somente seus itens podem rolar.
    const DoubtsContainer = isDoubtsList ? View : ScrollViewWithScrollbar;
    const headerTitle =
      doubtsView === 'compose'
        ? 'Nova dúvida'
        : doubtsView === 'faq'
        ? 'Perguntas frequentes'
        : 'Dúvidas';

    const handleDoubtsBack = () => {
      if (doubtsView !== 'list') {
        setDoubtsView('list');
      } else {
        setActiveSubscreen(null);
      }
    };

    const trimmedDoubt = doubtInput.trim();
    const canSaveDoubt = trimmedDoubt.length >= 10 && !doubtSaving;

    const handleSaveNewDoubt = async () => {
      if (!canSaveDoubt) return;
      setDoubtSaving(true);
      try {
        await onCreateDoubt(trimmedDoubt, activeDraftId);
        setDoubtInput('');
        setActiveDraftId(null);
        setDoubtsView('list');
        showToast?.('Pergunta enviada à equipe.');
      } catch (error) { showToast?.(error.message || 'Não foi possível enviar sua pergunta. O texto foi preservado.'); }
      finally { setDoubtSaving(false); }
    };

    const toggleExpandDoubt = (id) => {
      if (!reduceMotion) {
        LayoutAnimation.configureNext({
          duration: 340,
          create: {
            type: LayoutAnimation.Types.easeInEaseOut,
            property: LayoutAnimation.Properties.opacity,
          },
          update: {
            type: LayoutAnimation.Types.easeInEaseOut,
          },
          delete: {
            type: LayoutAnimation.Types.easeInEaseOut,
            property: LayoutAnimation.Properties.opacity,
          },
        });
      }
      setExpandedDoubtIds((prev) => ({
        ...prev,
        [id]: !prev[id],
      }));
    };

    return (
      <View style={[styles.screen, { paddingBottom: keyboardVisible ? 0 : 94 + bottomInset }]}>
        <View style={styles.subHeader}>
          <Pressable
            onPress={handleDoubtsBack}
            accessibilityRole="button"
            accessibilityLabel="Voltar"
            style={({ pressed }) => [
              styles.backBtn,
              pressed && styles.backBtnPressed,
            ]}
          >
            <ArrowLeftIcon size={18} color="#5316B8" />
          </Pressable>
          <Text style={styles.subTitle}>{headerTitle}</Text>
        </View>

        <DoubtsContainer
          {...(isDoubtsList ? {
            style: [styles.subContent, styles.doubtsListContent],
          } : {
            ref: doubtsScrollRef,
            style: styles.scroll,
            contentContainerStyle: [styles.subContent, styles.doubtsContent],
            reduceMotion: reduceMotion,
            showScrollbar: !(doubtsView === 'compose' && keyboardVisible),
            keyboardShouldPersistTaps: 'handled',
          })}
        >
          {doubtsLoading ? <Text style={styles.faqA}>Carregando dúvidas...</Text> : null}
          {doubtsError ? <Text style={styles.errorText}>{doubtsError}</Text> : null}
          {doubtsView === 'list' && (
            <View style={styles.doubtsListView}>
              <Text style={styles.doubtsIntro}>
                Precisa de orientação? Registre uma nova pergunta ou consulte as
                perguntas frequentes.
              </Text>

              <Pressable
                onPress={() => {
                  setDoubtInput('');
                  setActiveDraftId(null);
                  setDoubtsView('compose');
                }}
                style={({ pressed }) => [
                  styles.doubtsNewBtn,
                  pressed && styles.primaryBtnPressed,
                ]}
              >
                <View style={styles.doubtsNewIconBox}>
                  <PlusIcon size={16} color="#FFFFFF" />
                </View>
                <Text style={styles.primaryBtnText}>Nova dúvida</Text>
              </Pressable>

              <Pressable
                onPress={() => setDoubtsView('faq')}
                style={({ pressed }) => [
                  styles.doubtsFaqShortcut,
                  pressed && { backgroundColor: '#FAF8FF' },
                ]}
              >
                <Text style={styles.doubtsFaqShortcutTitle}>
                  Perguntas frequentes
                </Text>
                <Text style={styles.doubtsFaqShortcutSub}>
                  Veja respostas rápidas para as dúvidas mais comuns.
                </Text>
              </Pressable>

              {(!doubts || doubts.length === 0) ? (
                <View style={styles.doubtsEmpty}>
                  <Animated.View
                    style={[
                      styles.doubtsIllustration,
                      { transform: [{ translateY: floatAnim }] },
                    ]}
                  >
                    <DoubtsBubbleIcon size={34} color="#6824D6" />
                  </Animated.View>
                  <Text style={styles.doubtsEmptyTitle}>
                    Nenhuma dúvida registrada
                  </Text>
                  <Text style={styles.doubtsEmptyText}>
                    Suas perguntas aparecerão aqui depois que você as registrar.
                  </Text>
                </View>
              ) : (
                <View style={styles.doubtsListWrap}>
                  <Text style={styles.doubtsSectionHeader}>
                    {`Minhas perguntas (${doubts.length})`}
                  </Text>
                  <ScrollViewWithScrollbar
                    ref={doubtsScrollRef}
                    style={styles.doubtsListBox}
                    contentContainerStyle={styles.doubtsItems}
                    variant="inset"
                    accessibilityLabel="Minhas perguntas"
                    reduceMotion={reduceMotion}
                    bounces={false}
                    overScrollMode="never"
                  >
                      {doubts.map((item) => {
                        const isLong = item.question.length > 80 || item.question.includes('\n');
                        const expanded = Boolean(expandedDoubtIds[item.id]);
                        return (
                          <View key={item.id} style={styles.doubtsItem}>
                            <View>
                              <View style={styles.doubtsItemTop}>
                                <View style={styles.doubtsStatusTag}>
                                  <Text style={styles.doubtsStatusTagText}>
                                    {item.draft ? 'Rascunho local' : item.answer ? 'Respondida' : 'Aguardando resposta'}
                                  </Text>
                                </View>
                                <Text style={styles.doubtsTime}>
                                  {item.createdAt}
                                </Text>
                              </View>

                              <View style={styles.doubtsQuestionWrap}>
                                <Text
                                  style={styles.doubtsQuestionText}
                                  numberOfLines={
                                    isLong && !expanded ? 3 : undefined
                                  }
                                >
                                  {item.question}
                                </Text>
                                {item.answer ? <Text style={styles.faqA}>{item.answer}</Text> : null}
                                {isLong && (
                                  <Pressable
                                    onPress={() => toggleExpandDoubt(item.id)}
                                    style={styles.doubtsMoreToggle}
                                  >
                                    <Text style={styles.doubtsMoreToggleText}>
                                      {expanded ? 'Ler menos' : '… Ler mais'}
                                    </Text>
                                  </Pressable>
                                )}
                              </View>
                            </View>

                            <View style={styles.doubtsItemFooter}>
                              <Text style={styles.doubtsSyncHint}>
                                {item.draft ? 'Ainda não enviada' : item.answer ? 'Resposta da equipe' : 'Enviada à equipe'}
                              </Text>
                              {item.draft && <Pressable onPress={() => { setDoubtInput(item.question); setActiveDraftId(item.id); setDoubtsView('compose'); }}><Text style={styles.doubtsMoreToggleText}>Revisar e enviar</Text></Pressable>}
                              <Pressable
                                onPress={() => setPendingDeleteDoubtId(item.id)}
                                style={({ pressed }) => [
                                  styles.doubtsDeleteBtn,
                                  pressed && { backgroundColor: '#FDE8E8' },
                                ]}
                              >
                                <Text style={styles.doubtsDeleteBtnText}>
                                  Excluir
                                </Text>
                              </Pressable>
                            </View>
                          </View>
                        );
                      })}
                  </ScrollViewWithScrollbar>
                </View>
              )}
            </View>
          )}

          {doubtsView === 'compose' && (
            <View style={styles.doubtsComposeCard}>
              <Text style={styles.fieldLabel}>Sua pergunta</Text>
              <TextInput
                style={[
                  styles.doubtsTextarea,
                  focusedField === 'doubt_input' && styles.textInputFocused,
                ]}
                value={doubtInput}
                accessibilityLabel="Sua pergunta"
                onChangeText={setDoubtInput}
                onFocus={() => setFocusedField('doubt_input')}
                onBlur={() => setFocusedField(null)}
                placeholder="Escreva sua dúvida aqui..."
                placeholderTextColor="#796E92"
                multiline
                scrollEnabled
                numberOfLines={6}
                textAlignVertical="top"
                maxLength={500}
              />
              <View style={styles.doubtsComposeMeta}>
                <Text style={styles.doubtsComposeMetaText}>
                  Mínimo de 10 caracteres.
                </Text>
                <Text style={styles.doubtsComposeMetaText}>
                  {`${doubtInput.length} / 500`}
                </Text>
              </View>
              <View style={styles.doubtsComposeActions}>
                <Pressable
                  onPress={() => setDoubtsView('list')}
                  style={({ pressed }) => [
                    styles.doubtsSecondaryBtn,
                    pressed && { opacity: 0.85 },
                  ]}
                >
                  <Text style={styles.doubtsSecondaryBtnText}>Cancelar</Text>
                </Pressable>
                <Pressable
                  disabled={!canSaveDoubt}
                  onPress={handleSaveNewDoubt}
                  style={({ pressed }) => [
                    styles.doubtsSubmitBtn,
                    !canSaveDoubt && { opacity: 0.48 },
                    pressed && canSaveDoubt && { opacity: 0.9 },
                  ]}
                >
                  <Text style={styles.primaryBtnText}>
                    {doubtSaving ? 'Enviando...' : 'Enviar pergunta'}
                  </Text>
                </Pressable>
              </View>
            </View>
          )}

          {doubtsView === 'faq' && (
            <View>
              {answeredDoubts.map(item => <View style={styles.faqCard} key={item.id}><Text style={styles.faqQ}>{item.question}</Text><Text style={styles.faqA}>{item.answer}</Text></View>)}
              {!doubtsLoading && !answeredDoubts.length && !doubtsError ? <Text style={styles.faqA}>A equipe ainda não publicou respostas.</Text> : null}
            </View>
          )}
        </DoubtsContainer>

        {/* Delete Doubt Confirmation Dialog */}
          <AnimatedOverlay visible={pendingDeleteDoubtId !== null} style={styles.doubtsDialogBackdrop} reduceMotion={reduceMotion}>
            <Pressable
              style={StyleSheet.absoluteFill}
              onPress={() => setPendingDeleteDoubtId(null)}
            />
            <View style={styles.doubtsDialogCard}>
              <Text style={styles.doubtsDialogTitle}>Excluir pergunta?</Text>
              <Text style={styles.doubtsDialogText}>
                Deseja excluir esta pergunta e sua resposta?
              </Text>
              <View style={styles.doubtsDialogActions}>
                <Pressable
                  onPress={() => setPendingDeleteDoubtId(null)}
                  style={styles.doubtsDialogCancel}
                >
                  <Text style={styles.doubtsSecondaryBtnText}>Cancelar</Text>
                </Pressable>
                <Pressable
                  disabled={doubtSaving}
                  onPress={async () => {
                    if (doubtSaving) return;
                    setDoubtSaving(true);
                    try {
                      await onDeleteDoubt(doubts.find(item => item.id === pendingDeleteDoubtId));
                      setPendingDeleteDoubtId(null);
                      showToast?.('Pergunta excluída.');
                    } catch (error) { showToast?.(error.message || 'Não foi possível excluir a pergunta.'); }
                    finally { setDoubtSaving(false); }
                  }}
                  style={styles.doubtsDialogConfirm}
                >
                  <Text style={styles.primaryBtnText}>Excluir</Text>
                </Pressable>
              </View>
            </View>
          </AnimatedOverlay>
      </View>
    );
  }

  /* 6. SOBRE O PROJETO */
  if (activeSubscreen === 'sub-about') {
    const socialLinks = [
      {
        label: 'Instagram',
        url: 'https://www.instagram.com/saudeunica_amazoniabr/?app=desktop',
      },
      {
        label: 'Twitter/X',
        url: 'https://x.com/saudeamazoniabr?app=desktop',
      },
      {
        label: 'YouTube',
        url: 'https://www.youtube.com/@SaudeUnicaAmazoniaBR?app=desktop',
      },
    ];
    return (
      <View style={styles.screen}>
        <View style={styles.subHeader}>
          <Pressable
            onPress={() => setActiveSubscreen(null)}
            style={({ pressed }) => [
              styles.backBtn,
              pressed && styles.backBtnPressed,
            ]}
          >
            <ArrowLeftIcon size={18} color="#5316B8" />
          </Pressable>
          <Text style={styles.subTitle}>Sobre o projeto</Text>
        </View>

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={[styles.subContent, keyboardVisible && styles.keyboardContent]}
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.aboutSectionTitle}>Eventos</Text>
          <View style={styles.aboutEventCard}>
            <View style={styles.infoBannerFrame}>
              <Image
                source={IMG_DRA}
                style={{
                  width: Math.max(200, windowWidth - 40 - 28 - 3),
                  height: Math.round(
                    Math.max(200, windowWidth - 40 - 28 - 3) * (9 / 16),
                  ),
                }}
                resizeMode="cover"
                resizeMethod="resize"
              />
            </View>
            <Text style={styles.aboutEventTitle}>DRA - Curuçá 2024</Text>
          </View>

          <Text style={styles.aboutSectionTitle}>Redes sociais</Text>
          <View style={styles.socialCard}>
            {socialLinks.map((item, idx) => (
              <Pressable
                key={item.label}
                onPress={() => Linking.openURL(item.url).catch(() => showToast?.('Não foi possível abrir o link no aparelho.'))}
                style={({ pressed }) => [
                  styles.socialLinkItem,
                  idx === socialLinks.length - 1 && { borderBottomWidth: 0 },
                  pressed && { backgroundColor: '#FAF8FF' },
                ]}
              >
                <Text style={styles.socialName}>{item.label}</Text>
                <View style={styles.socialTrailing}>
                  <Text style={styles.socialTrailingText}>Abrir link</Text>
                  <ArrowUpRightIcon size={14} color="#6824D6" />
                </View>
              </Pressable>
            ))}
          </View>
        </ScrollView>
      </View>
    );
  }

  /* 7. CRÉDITOS */
  if (activeSubscreen === 'sub-credits') {
    return (
      <View style={styles.screen}>
        <View style={styles.subHeader}>
          <Pressable
            onPress={() => setActiveSubscreen(null)}
            style={({ pressed }) => [
              styles.backBtn,
              pressed && styles.backBtnPressed,
            ]}
          >
            <ArrowLeftIcon size={18} color="#5316B8" />
          </Pressable>
          <Text style={styles.subTitle}>Créditos</Text>
        </View>

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={[styles.subContent, keyboardVisible && styles.keyboardContent]}
          showsVerticalScrollIndicator={false}
        >
          {CREDITS_GROUPS.map((grp) => (
            <CreditGroupAccordion
              key={grp.id}
              group={grp}
              reduceMotion={reduceMotion}
            />
          ))}
        </ScrollView>
      </View>
    );
  }

  /* MAIN MAIS SCREEN (#screen-more) */
  const initials = getReporterInitials(accountProfile?.username || 'SC');
  const menuItems = [
    {
      key: 'guide',
      label: 'Guia interativo',
      icon: <GuideCompassIcon size={20} color="#6824D6" />,
      onPress: onOpenInteractiveGuide,
    },
    {
      key: 'sub-settings',
      label: 'Configurações',
      icon: <SettingsGearIcon size={20} color="#6824D6" />,
    },
    {
      key: 'sub-info',
      label: 'Informativos',
      icon: <BookOpenIcon size={20} color="#6824D6" />,
    },
    {
      key: 'sub-faq',
      label: 'Dúvidas',
      icon: <HelpCircleIcon size={20} color="#6824D6" />,
    },
    {
      key: 'sub-about',
      label: 'Sobre o projeto',
      icon: <InfoCircleIcon size={20} color="#6824D6" />,
    },
    {
      key: 'sub-credits',
      label: 'Créditos',
      icon: <UsersIcon size={20} color="#6824D6" />,
    },
  ];

  return (
    <View style={styles.screen}>
      <MainScreenHeader title="Mais" subtitle="Conta, guias educativos e ajustes do sistema" />

      <ScrollView
        {...guideScrollProps}
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Account Hero */}
        <Pressable
          onPress={() => setActiveSubscreen('sub-account')}
          style={({ pressed }) => [
            styles.accountHero,
            pressed && { borderColor: '#DFD2FA', transform: [{ scale: 0.99 }] },
          ]}
        >
          <View style={styles.accountAvatar}>
            {accountProfile?.photoUri ? (
              <Image
                source={{ uri: accountProfile.photoUri }}
                style={styles.accountAvatarImg}
              />
            ) : (
              <Text style={styles.accountAvatarText}>{initials}</Text>
            )}
          </View>
          <View style={styles.accountInfo}>
            <Text style={styles.accountInfoTitle}>Minha conta</Text>
            <Text style={styles.accountInfoSub}>
              Editar perfil, foto e senha de acesso
            </Text>
          </View>
          <ChevronRightIcon size={18} color="#796E92" strokeWidth={2.2} />
        </Pressable>

        {/* Menu Group */}
        <View style={styles.menuGroup}>
          {menuItems.map((item, idx) => (
            <Pressable
              key={item.key}
              ref={item.key === 'guide' ? menuGuideRef : undefined}
              collapsable={false}
              onPress={() => {
                if (item.onPress) {
                  item.onPress();
                  return;
                }
                if (item.key === 'sub-faq') setDoubtsView('list');
                setActiveSubscreen(item.key);
              }}
              style={({ pressed }) => [
                styles.menuItem,
                idx === menuItems.length - 1 && { borderBottomWidth: 0 },
                pressed && { backgroundColor: '#FAF8FF' },
              ]}
            >
              <View style={styles.menuIconBox}>{item.icon}</View>
              <Text style={styles.menuItemLabel}>{item.label}</Text>
              <ChevronRightIcon size={18} color="#796E92" strokeWidth={2.2} />
            </Pressable>
          ))}
        </View>

        {/* Danger Sair Group */}
        <View style={styles.menuGroup}>
          <Pressable
            onPress={onSignOut}
            style={({ pressed }) => [
              styles.menuItem,
              { borderBottomWidth: 0 },
              pressed && { backgroundColor: '#FFF5F5' },
            ]}
          >
            <View style={[styles.menuIconBox, { backgroundColor: '#FDE8E8' }]}>
              <LogOutIcon size={20} color="#C82333" />
            </View>
            <Text style={[styles.menuItemLabel, { color: '#C82333' }]}>
              Sair
            </Text>
            <ChevronRightIcon size={18} color="#796E92" strokeWidth={2.2} />
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
  subHeader: {
    paddingTop: 10,
    paddingHorizontal: 16,
    paddingBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1.5,
    borderBottomColor: '#EFE9FE',
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 11,
    borderWidth: 1.5,
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
    fontSize: 18,
    fontFamily: 'PlusJakartaSans-ExtraBold',
    color: '#181126',
    letterSpacing: -0.3,
    includeFontPadding: false,
  },
  scroll: {
    flex: 1,
  },
  content: {
    paddingTop: 16,
    paddingHorizontal: 20,
    paddingBottom: 104,
  },
  subContent: {
    paddingTop: 14,
    paddingHorizontal: 20,
    paddingBottom: 104,
  },
  keyboardContent: { paddingBottom: 16 },
  accountHero: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 16,
    borderWidth: 1.5,
    borderColor: '#EAE5F5',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginBottom: 18,
  },
  accountAvatar: {
    width: 52,
    height: 52,
    borderRadius: 999,
    borderWidth: 2,
    borderColor: '#DFD2FA',
    backgroundColor: '#EFE9FE',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  accountAvatarImg: {
    width: '100%',
    height: '100%',
  },
  gradientFillCenter: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  accountAvatarText: {
    fontSize: 18,
    fontFamily: 'PlusJakartaSans-ExtraBold',
    color: '#5316B8',
    includeFontPadding: false,
  },
  accountInfo: {
    flex: 1,
  },
  accountInfoTitle: {
    fontSize: 15,
    fontFamily: 'PlusJakartaSans-ExtraBold',
    color: '#181126',
    includeFontPadding: false,
  },
  accountInfoSub: {
    fontSize: 12.5,
    fontFamily: 'PlusJakartaSans-Medium',
    color: '#5E5473',
    marginTop: 2,
    includeFontPadding: false,
  },
  menuGroup: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: '#EAE5F5',
    overflow: 'hidden',
    marginBottom: 16,
  },
  menuItem: {
    paddingVertical: 15,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#EFE9FE',
  },
  menuIconBox: {
    width: 38,
    height: 38,
    borderRadius: 11,
    backgroundColor: '#F6F3FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuItemLabel: {
    flex: 1,
    fontSize: 14.5,
    fontFamily: 'PlusJakartaSans-Bold',
    color: '#181126',
    includeFontPadding: false,
  },
  sectionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 18,
    marginBottom: 16,
    borderWidth: 1.5,
    borderColor: '#EAE5F5',
  },
  cardEyebrow: {
    fontSize: 12,
    fontFamily: 'PlusJakartaSans-ExtraBold',
    color: '#6824D6',
    letterSpacing: 0.6,
    marginBottom: 12,
    includeFontPadding: false,
  },
  largeAvatarWrap: {
    width: 112,
    height: 112,
    borderRadius: 999,
    borderWidth: 2,
    borderColor: '#DFD2FA',
    backgroundColor: '#EFE9FE',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    marginBottom: 16,
  },
  largeAvatarImg: {
    width: '100%',
    height: '100%',
  },
  largeAvatarText: {
    fontSize: 34,
    fontFamily: 'PlusJakartaSans-ExtraBold',
    color: '#5316B8',
    includeFontPadding: false,
  },
  avatarBtnRow: {
    flexDirection: 'row',
    gap: 10,
    width: '100%',
  },
  avatarActionBtn: {
    flex: 1,
    minHeight: 44,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#EAE5F5',
    backgroundColor: '#FFFFFF',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  avatarActionBtnText: {
    fontSize: 13.5,
    fontFamily: 'PlusJakartaSans-Bold',
    color: '#5316B8',
    includeFontPadding: false,
  },
  fieldBlock: {
    marginBottom: 14,
  },
  fieldLabel: {
    fontSize: 14,
    fontFamily: 'PlusJakartaSans-Bold',
    color: '#181126',
    marginBottom: 6,
    includeFontPadding: false,
  },
  textInput: {
    width: '100%',
    minHeight: 48,
    paddingVertical: 11,
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
  divider: {
    height: 1,
    backgroundColor: '#EFE9FE',
    marginVertical: 16,
  },
  forgotPassBtn: {
    width: '100%',
    marginTop: 16,
    minHeight: 48,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#EAE5F5',
    backgroundColor: '#FFFFFF',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 14,
  },
  forgotPassBtnText: {
    fontSize: 14,
    fontFamily: 'PlusJakartaSans-ExtraBold',
    color: '#5316B8',
    includeFontPadding: false,
  },
  accountPasswordBtn: {
    marginTop: 0,
  },
  passwordHint: {
    fontSize: 13.5,
    lineHeight: 19.5,
    fontFamily: 'PlusJakartaSans-Medium',
    color: '#5E5473',
    marginBottom: 14,
    includeFontPadding: false,
  },
  passwordInputWrap: {
    position: 'relative',
    justifyContent: 'center',
  },
  eyeToggleBtn: {
    position: 'absolute',
    right: 10,
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryBtn: {
    width: '100%',
    minHeight: 52,
    borderRadius: 14,
    backgroundColor: '#6824D6',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 6,
    shadowColor: '#6824D6',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.28,
    shadowRadius: 20,
  },
  primaryBtnDisabled: { backgroundColor: '#E5E7EB', elevation: 0, shadowOpacity: 0 },
  primaryBtnDisabledText: { color: '#4B5563' },
  primaryBtnPressed: {
    backgroundColor: '#5316B8',
    transform: [{ scale: 0.99 }],
  },
  primaryBtnText: {
    fontSize: 15,
    fontFamily: 'PlusJakartaSans-ExtraBold',
    color: '#FFFFFF',
    includeFontPadding: false,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 14,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#EFE9FE',
  },
  toggleInfo: {
    flex: 1,
  },
  toggleTitle: {
    fontSize: 14.5,
    fontFamily: 'PlusJakartaSans-Bold',
    color: '#181126',
    includeFontPadding: false,
  },
  toggleSub: {
    fontSize: 12.5,
    fontFamily: 'PlusJakartaSans-Medium',
    color: '#5E5473',
    marginTop: 2,
    includeFontPadding: false,
  },
  switchTrack: {
    width: 48,
    height: 28,
    borderRadius: 999,
    padding: 3,
    justifyContent: 'center',
  },
  switchKnob: {
    width: 22,
    height: 22,
    borderRadius: 999,
    backgroundColor: '#FFFFFF',
    elevation: 2,
  },
  fontHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  fontPercentText: {
    fontSize: 14,
    fontFamily: 'PlusJakartaSans-ExtraBold',
    color: '#6824D6',
    includeFontPadding: false,
  },
  fontSampleText: {
    fontFamily: 'PlusJakartaSans-Medium',
    color: '#5E5473',
    marginVertical: 10,
    includeFontPadding: false,
  },
  fontBtnsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  fontStepBtn: {
    flex: 1,
    minHeight: 42,
    borderRadius: 11,
    borderWidth: 1.5,
    borderColor: '#EAE5F5',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  fontStepBtnText: {
    fontSize: 13.5,
    fontFamily: 'PlusJakartaSans-Bold',
    color: '#5316B8',
    includeFontPadding: false,
  },
  infoPosterCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1.5,
    borderColor: '#EAE5F5',
  },
  infoPosterTitle: {
    fontSize: 17,
    fontFamily: 'PlusJakartaSans-ExtraBold',
    color: '#181126',
    letterSpacing: -0.3,
    marginBottom: 12,
    includeFontPadding: false,
  },
  infoBannerFrame: {
    width: '100%',
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1.5,
    borderColor: '#EAE5F5',
    backgroundColor: '#F6F3FF',
    position: 'relative',
  },
  infoBannerPressed: { opacity: 0.88 },
  zoomChip: {
    position: 'absolute', right: 10, bottom: 10, flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, backgroundColor: 'rgba(28, 13, 54, 0.72)',
  },
  zoomChipText: { fontSize: 12, fontFamily: 'PlusJakartaSans-Bold', color: '#FFFFFF', includeFontPadding: false },
  fullBannerImg: {
    ...StyleSheet.absoluteFillObject,
    width: '100%',
    height: '100%',
  },
  doubtsIntro: {
    fontSize: 14,
    lineHeight: 20.3,
    fontFamily: 'PlusJakartaSans-Medium',
    color: '#5E5473',
    marginBottom: 14,
    includeFontPadding: false,
  },
  doubtsNewBtn: {
    width: '100%',
    minHeight: 54,
    paddingVertical: 13,
    paddingHorizontal: 18,
    borderRadius: 16,
    backgroundColor: '#6824D6',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 10,
    elevation: 6,
    shadowColor: '#6824D6',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.24,
    shadowRadius: 18,
  },
  doubtsNewIconBox: {
    width: 28,
    height: 28,
    borderRadius: 9,
    backgroundColor: 'rgba(255, 255, 255, 0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  doubtsFaqShortcut: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 15,
    borderWidth: 1.5,
    borderColor: '#EAE5F5',
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginBottom: 18,
  },
  doubtsFaqShortcutTitle: {
    fontSize: 14.5,
    fontFamily: 'PlusJakartaSans-ExtraBold',
    color: '#5316B8',
    marginBottom: 3,
    includeFontPadding: false,
  },
  doubtsFaqShortcutSub: {
    fontSize: 12.5,
    lineHeight: 17.5,
    fontFamily: 'PlusJakartaSans-Medium',
    color: '#5E5473',
    includeFontPadding: false,
  },
  doubtsEmpty: {
    paddingTop: 36,
    paddingHorizontal: 20,
    paddingBottom: 24,
    alignItems: 'center',
  },
  doubtsIllustration: {
    width: 72,
    height: 72,
    borderRadius: 22,
    backgroundColor: '#EFE9FE',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  doubtsEmptyTitle: {
    fontSize: 16.5,
    fontFamily: 'PlusJakartaSans-ExtraBold',
    color: '#181126',
    marginBottom: 6,
    textAlign: 'center',
    includeFontPadding: false,
  },
  doubtsEmptyText: {
    fontSize: 13.5,
    lineHeight: 19.5,
    fontFamily: 'PlusJakartaSans-Medium',
    color: '#5E5473',
    maxWidth: 260,
    textAlign: 'center',
    includeFontPadding: false,
  },
  doubtsContent: {
    paddingBottom: 24,
  },
  doubtsListContent: {
    flex: 1,
    minHeight: 0,
    overflow: 'hidden',
    paddingTop: 18,
    paddingBottom: 12,
  },
  doubtsListView: {
    flex: 1,
    minHeight: 0,
  },
  doubtsListWrap: {
    flex: 1,
    minHeight: 0,
    overflow: 'hidden',
  },
  doubtsSectionHeader: {
    flexShrink: 0,
    fontSize: 14,
    fontFamily: 'PlusJakartaSans-ExtraBold',
    color: '#181126',
    marginBottom: 10,
    includeFontPadding: false,
  },
  doubtsListBox: {
    flex: 1,
    minHeight: 0,
    overflow: 'hidden',
    borderRadius: 16,
    backgroundColor: '#F4F0FC',
    borderWidth: 1,
    borderColor: '#EFE9FE',
  },
  doubtsItems: {
    paddingTop: 10,
    paddingBottom: 2,
    paddingLeft: 8,
    paddingRight: 17,
  },
  doubtsItem: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    paddingTop: 15,
    paddingHorizontal: 16,
    paddingBottom: 13,
    borderWidth: 1.5,
    borderColor: '#EAE5F5',
    minHeight: 202,
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  doubtsItemTop: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 10,
    marginBottom: 10,
  },
  doubtsStatusTag: {
    maxWidth: '100%',
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 999,
    backgroundColor: '#FFF8E6',
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  doubtsStatusTagText: {
    fontSize: 11.5,
    fontFamily: 'PlusJakartaSans-ExtraBold',
    color: '#B45309',
    includeFontPadding: false,
  },
  doubtsTime: {
    fontSize: 11.5,
    fontFamily: 'PlusJakartaSans-SemiBold',
    color: '#796E92',
    includeFontPadding: false,
  },
  doubtsQuestionWrap: {
    marginBottom: 12,
  },
  doubtsQuestionText: {
    fontSize: 14,
    lineHeight: 20.4,
    fontFamily: 'PlusJakartaSans-SemiBold',
    color: '#181126',
    includeFontPadding: false,
  },
  doubtsMoreToggle: {
    marginTop: 4,
    alignSelf: 'flex-start',
  },
  doubtsMoreToggleText: {
    fontSize: 12.5,
    fontFamily: 'PlusJakartaSans-ExtraBold',
    color: '#6824D6',
    includeFontPadding: false,
  },
  doubtsItemFooter: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#EFE9FE',
  },
  doubtsSyncHint: {
    fontSize: 12,
    fontFamily: 'PlusJakartaSans-SemiBold',
    color: '#796E92',
    includeFontPadding: false,
  },
  doubtsDeleteBtn: {
    paddingVertical: 5,
    paddingHorizontal: 9,
    borderRadius: 8,
  },
  doubtsDeleteBtnText: {
    fontSize: 12.5,
    fontFamily: 'PlusJakartaSans-ExtraBold',
    color: '#C82333',
    includeFontPadding: false,
  },
  doubtsComposeCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 18,
    borderWidth: 1.5,
    borderColor: '#EAE5F5',
  },
  doubtsTextarea: {
    width: '100%',
    height: 168,
    maxHeight: 168,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#431682',
    backgroundColor: '#FFFFFF',
    fontSize: 14,
    lineHeight: 21,
    fontFamily: 'PlusJakartaSans-Medium',
    color: '#181126',
    textAlignVertical: 'top',
    includeFontPadding: false,
  },
  doubtsComposeMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 16,
  },
  doubtsComposeMetaText: {
    fontSize: 12,
    fontFamily: 'PlusJakartaSans-SemiBold',
    color: '#796E92',
    includeFontPadding: false,
  },
  doubtsComposeActions: {
    flexDirection: 'row',
    gap: 10,
  },
  doubtsSecondaryBtn: {
    flex: 1,
    minHeight: 48,
    borderRadius: 13,
    borderWidth: 1.5,
    borderColor: '#DFD2FA',
    backgroundColor: '#F6F3FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  doubtsSecondaryBtnText: {
    fontSize: 14,
    fontFamily: 'PlusJakartaSans-ExtraBold',
    color: '#5316B8',
    includeFontPadding: false,
  },
  doubtsSubmitBtn: {
    flex: 1,
    minHeight: 48,
    borderRadius: 13,
    backgroundColor: '#6824D6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  faqCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 10,
    borderWidth: 1.5,
    borderColor: '#EAE5F5',
  },
  faqQ: {
    fontSize: 14,
    fontFamily: 'PlusJakartaSans-ExtraBold',
    color: '#5316B8',
    marginBottom: 6,
    includeFontPadding: false,
  },
  faqA: {
    fontSize: 13.5,
    lineHeight: 20,
    fontFamily: 'PlusJakartaSans-Medium',
    color: '#5E5473',
    includeFontPadding: false,
  },
  doubtsDialogBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(28, 13, 54, 0.5)',
    zIndex: 95,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 22,
  },
  doubtsDialogCard: {
    width: '100%',
    maxWidth: 332,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 20,
    borderWidth: 1.5,
    borderColor: '#EAE5F5',
    elevation: 16,
  },
  doubtsDialogTitle: {
    fontSize: 16.5,
    fontFamily: 'PlusJakartaSans-ExtraBold',
    color: '#181126',
    marginBottom: 6,
    includeFontPadding: false,
  },
  doubtsDialogText: {
    fontSize: 13.5,
    lineHeight: 19.5,
    fontFamily: 'PlusJakartaSans-Medium',
    color: '#5E5473',
    marginBottom: 16,
    includeFontPadding: false,
  },
  doubtsDialogActions: {
    flexDirection: 'row',
    gap: 10,
  },
  doubtsDialogCancel: {
    flex: 1,
    minHeight: 44,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#EAE5F5',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  doubtsDialogConfirm: {
    flex: 1,
    minHeight: 44,
    borderRadius: 12,
    backgroundColor: '#C82333',
    alignItems: 'center',
    justifyContent: 'center',
  },
  aboutSectionTitle: {
    fontSize: 18,
    fontFamily: 'PlusJakartaSans-ExtraBold',
    color: '#181126',
    letterSpacing: -0.3,
    marginBottom: 10,
    includeFontPadding: false,
  },
  aboutEventCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 14,
    borderWidth: 1.5,
    borderColor: '#EAE5F5',
    marginBottom: 22,
  },
  aboutEventTitle: {
    fontSize: 16,
    fontFamily: 'PlusJakartaSans-ExtraBold',
    color: '#181126',
    marginTop: 12,
    paddingHorizontal: 2,
    includeFontPadding: false,
  },
  socialCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: '#EAE5F5',
    overflow: 'hidden',
  },
  socialLinkItem: {
    paddingVertical: 16,
    paddingHorizontal: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: '#EFE9FE',
  },
  socialName: {
    fontSize: 15,
    fontFamily: 'PlusJakartaSans-ExtraBold',
    color: '#181126',
    includeFontPadding: false,
  },
  socialTrailing: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  socialTrailingText: {
    fontSize: 12.5,
    fontFamily: 'PlusJakartaSans-Bold',
    color: '#6824D6',
    includeFontPadding: false,
  },
  creditGroup: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: '#EAE5F5',
    marginBottom: 12,
    overflow: 'hidden',
  },
  creditHeader: {
    paddingVertical: 17,
    paddingHorizontal: 14,
    minHeight: 58,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 6,
  },
  creditTitle: {
    flexShrink: 1,
    fontSize: 12.5,
    fontFamily: 'PlusJakartaSans-ExtraBold',
    color: '#181126',
    includeFontPadding: false,
  },
  creditMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexShrink: 0,
  },
  creditCount: {
    fontSize: 9.8,
    fontFamily: 'PlusJakartaSans-SemiBold',
    color: '#796E92',
    includeFontPadding: false,
  },
  creditBodyWrap: {
    overflow: 'hidden',
    borderTopColor: '#EFE9FE',
  },
  creditBodyInner: {
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  creditMember: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#EFE9FE',
  },
  creditMemberPhoto: {
    width: 48,
    height: 48,
    borderRadius: 999,
    borderWidth: 2,
    borderColor: '#DFD2FA',
    backgroundColor: '#F6F3FF',
  },
  creditMemberPlaceholder: {
    width: 48,
    height: 48,
    borderRadius: 999,
    backgroundColor: '#F6F3FF',
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: '#DFD2FA',
    alignItems: 'center',
    justifyContent: 'center',
  },
  creditMemberPlaceholderText: {
    fontSize: 13,
    fontFamily: 'PlusJakartaSans-ExtraBold',
    color: '#5316B8',
    includeFontPadding: false,
  },
  creditMemberName: {
    fontSize: 14,
    fontFamily: 'PlusJakartaSans-ExtraBold',
    color: '#181126',
    includeFontPadding: false,
  },
  creditMemberRole: {
    fontSize: 12.5,
    fontFamily: 'PlusJakartaSans-SemiBold',
    color: '#5E5473',
    marginTop: 2,
    includeFontPadding: false,
  },
  creditEmptyText: {
    paddingVertical: 12,
    paddingHorizontal: 2,
    fontSize: 13,
    fontFamily: 'PlusJakartaSans-SemiBold',
    color: '#796E92',
    includeFontPadding: false,
  },
});
