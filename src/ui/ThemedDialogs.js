import { Animated, Pressable, ScrollView, Text, TextInput, View } from './AccessibleNative';
import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Easing, StyleSheet } from 'react-native';
import { HelpQuestionIcon, ReporterBadgeIcon } from './SismorcegoIcons';
import useFadeCompositing from './useFadeCompositing';
import useReduceMotion from './useReduceMotion';
import useSpeakOnMount from '../hooks/useSpeakOnMount';
import { describeMessage, sentences } from '../services/accessibilityDescriptions';

export function ReporterModal({
  visible,
  currentName,
  onSave,
  onError,
  onClose,
  reduceMotion: reduceMotionProp = false,
}) {
  const reduceMotion = useReduceMotion() || reduceMotionProp;
  const [rendered, setRendered] = useState(visible);
  const [nameInput, setNameInput] = useState('');
  const [hasError, setHasError] = useState(false);
  const [focused, setFocused] = useState(false);
  const savingRef = useRef(false);
  const anim = useRef(new Animated.Value(visible ? 1 : 0)).current;
  const compositing = useFadeCompositing(anim, visible ? 1 : 0, reduceMotion);

  useLayoutEffect(() => {
    if (visible) {
      setNameInput(String(currentName || '').trim());
      setHasError(false);
      setRendered(true);
    }
  }, [visible, currentName]);

  useEffect(() => {
    if (!rendered) return;
    if (reduceMotion) {
      anim.setValue(visible ? 1 : 0);
      if (!visible) setRendered(false);
      return;
    }
    let cancelled = false;
    const transition = Animated.timing(anim, {
      toValue: visible ? 1 : 0, duration: visible ? 220 : 200,
      easing: Easing.out(Easing.ease), useNativeDriver: true,
    });
    transition.start(({ finished }) => { if (finished && !cancelled && !visible) setRendered(false); });
    return () => { cancelled = true; transition.stop(); };
  }, [visible, rendered, reduceMotion, anim]);

  useSpeakOnMount(sentences('Alterar responsável', currentName, 'Informe o nome completo do notificador. Escolha Cancelar ou Salvar'), { active: visible, priority: 30 });
  if (!rendered) return null;

  const handleSave = async () => {
    if (savingRef.current) return;
    const val = nameInput.trim();
    if (!val) {
      setHasError(true);
      return;
    }
    setHasError(false);
    savingRef.current = true;
    try { await onSave(val); onClose(); }
    catch (error) { onError?.(error.message || 'Não foi possível salvar o responsável.'); }
    finally { savingRef.current = false; }
  };

  const translateY = anim.interpolate({
    inputRange: [0, 1],
    outputRange: [14, 0],
  });
  const scale = anim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.98, 1],
  });

  return (
    <Animated.View
      {...compositing}
      style={[styles.overlay, { opacity: anim, zIndex: 140 }]}
      pointerEvents={visible ? 'auto' : 'none'}
    >
      <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
      <Animated.View
        style={[
          styles.dialog,
          styles.reporterDialog,
          {
            transform: [{ translateY }, { scale }],
          },
        ]}
      >
        <ScrollView style={styles.reporterScroll} keyboardShouldPersistTaps="handled">
          <View style={styles.topRow}>
            <View style={styles.badge}>
              <ReporterBadgeIcon size={22} color="#6824D6" />
            </View>
            <Text style={styles.title}>Alterar responsável</Text>
          </View>

          <View style={styles.body}>
            <Text style={[styles.descText, { marginBottom: 14 }]}>
              Informe o nome de quem está registrando esta ocorrência. Ele
              aparecerá no card do notificador.
            </Text>
            <View>
              <Text style={styles.fieldLabel}>Nome completo do notificador</Text>
              <TextInput
                accessibilityLabel="Nome completo do notificador"
                style={[
                  styles.textInput,
                  focused && styles.textInputFocused,
                  hasError && styles.textInputError,
                ]}
                value={nameInput}
                onChangeText={(txt) => {
                  setNameInput(txt);
                  if (hasError && txt.trim()) setHasError(false);
                }}
                onFocus={() => setFocused(true)}
                onBlur={() => setFocused(false)}
                onSubmitEditing={handleSave}
                maxLength={60}
                selectTextOnFocus
                autoFocus
              />
              {hasError ? (
                <Text style={styles.errorText}>
                  Digite o nome do responsável.
                </Text>
              ) : null}
            </View>
          </View>

          <View style={styles.actionsRow}>
            <Pressable
              onPress={onClose}
              style={({ pressed }) => [
                styles.secondaryBtn,
                pressed && { opacity: 0.85 },
              ]}
            >
              <Text style={styles.secondaryBtnText}>Cancelar</Text>
            </Pressable>
            <Pressable
              onPress={handleSave}
              style={({ pressed }) => [
                styles.primaryBtn,
                pressed && { opacity: 0.9 },
              ]}
            >
              <Text style={styles.primaryBtnText}>Salvar</Text>
            </Pressable>
          </View>
        </ScrollView>
      </Animated.View>
    </Animated.View>
  );
}

export function ThemedInfoModal({
  visible,
  title,
  message,
  onClose,
  onConfirm,
  confirmLabel = 'Confirmar',
  onExited,
  reduceMotion: reduceMotionProp = false,
}) {
  const reduceMotion = useReduceMotion() || reduceMotionProp;
  const [rendered, setRendered] = useState(visible);
  const anim = useRef(new Animated.Value(visible ? 1 : 0)).current;
  const compositing = useFadeCompositing(anim, visible ? 1 : 0, reduceMotion);
  const exitedRef = useRef(onExited);
  exitedRef.current = onExited;

  useLayoutEffect(() => { if (visible) setRendered(true); }, [visible]);
  useEffect(() => {
    if (!rendered) return;
    if (reduceMotion) {
      anim.setValue(visible ? 1 : 0);
      if (!visible) { setRendered(false); exitedRef.current?.(); }
      return;
    }
    let cancelled = false;
    const transition = Animated.timing(anim, {
      toValue: visible ? 1 : 0, duration: visible ? 220 : 200,
      easing: Easing.out(Easing.ease), useNativeDriver: true,
    });
    transition.start(({ finished }) => {
      if (finished && !cancelled && !visible) { setRendered(false); exitedRef.current?.(); }
    });
    return () => { cancelled = true; transition.stop(); };
  }, [visible, rendered, reduceMotion, anim]);

  useSpeakOnMount(sentences(title, describeMessage(message), onConfirm
    ? `Escolha Cancelar ou ${confirmLabel}` : 'Toque em Entendi para fechar'), { active: visible, priority: 30 });
  if (!rendered) return null;

  const translateY = anim.interpolate({
    inputRange: [0, 1],
    outputRange: [14, 0],
  });
  const scale = anim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.98, 1],
  });

  const isStructured = message && typeof message === 'object';
  const displayTitle = isStructured ? message.title || title : title;

  return (
    <Animated.View
      {...compositing}
      style={[styles.overlay, { opacity: anim, zIndex: 160 }]}
      pointerEvents={visible || onConfirm ? 'auto' : 'none'}
      accessibilityViewIsModal
      accessibilityElementsHidden={!visible}
      importantForAccessibility={visible ? 'auto' : 'no-hide-descendants'}
    >
      <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
      <Animated.View
        style={[
          styles.dialog,
          {
            transform: [{ translateY }, { scale }],
          },
        ]}
      >
        <View style={styles.topRow}>
          <View style={styles.badge}>
            <HelpQuestionIcon size={26} color="#6824D6" />
          </View>
          <Text style={styles.title}>{displayTitle}</Text>
        </View>

        <View style={styles.body}>
          {isStructured ? (
            <>
              <Text style={[styles.descText, { marginBottom: 10 }]}>
                {message.prefix}
                <Text style={styles.descBold}>{message.bold}</Text>
                {message.suffix}
              </Text>
              <View style={styles.modalStep}>
                <Text style={styles.modalStepTitle}>{message.stepTitle}</Text>
                <Text style={styles.modalStepBody}>{message.stepBody}</Text>
              </View>
            </>
          ) : (
            <Text style={styles.descText}>{String(message || '')}</Text>
          )}
        </View>

        <View style={styles.actionsRow}>
          {onConfirm && <Pressable onPress={onClose} style={styles.secondaryBtn} accessibilityRole="button">
            <Text style={styles.secondaryBtnText}>Cancelar</Text>
          </Pressable>}
          <Pressable
            onPress={onConfirm || onClose}
            accessibilityRole="button"
            style={({ pressed }) => [
              styles.primaryBtn,
              pressed && { opacity: 0.9 },
            ]}
          >
            <Text style={styles.primaryBtnText}>{onConfirm ? confirmLabel : 'Entendi'}</Text>
          </Pressable>
        </View>
      </Animated.View>
    </Animated.View>
  );
}

export function SignOutConfirmationModal({ message, ...props }) {
  return <ThemedInfoModal {...props} title="Sair da conta?" confirmLabel="Sair"
    message={message || 'Deseja encerrar sua sessão no Sismorcego?'} />;
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(28, 13, 54, 0.56)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  dialog: {
    width: '100%',
    maxWidth: 342,
    backgroundColor: '#FFFFFF',
    borderRadius: 22,
    padding: 22,
    elevation: 18,
    shadowColor: '#181126',
    shadowOffset: { width: 0, height: 22 },
    shadowOpacity: 0.3,
    shadowRadius: 28,
  },
  reporterDialog: { maxHeight: '100%' },
  reporterScroll: { flexGrow: 0, flexShrink: 1, minHeight: 0 },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 14,
  },
  badge: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#F6F3FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    flex: 1,
    fontSize: 18,
    fontFamily: 'PlusJakartaSans-ExtraBold',
    color: '#181126',
    letterSpacing: -0.3,
    includeFontPadding: false,
  },
  body: {
    marginBottom: 18,
  },
  descText: {
    fontSize: 13,
    lineHeight: 20,
    fontFamily: 'PlusJakartaSans-Medium',
    color: '#5E5473',
    includeFontPadding: false,
  },
  descBold: {
    fontFamily: 'PlusJakartaSans-Bold',
    color: '#5E5473',
  },
  modalStep: {
    backgroundColor: '#F6F3FF',
    borderRadius: 12,
    padding: 12,
  },
  modalStepTitle: {
    fontSize: 13,
    fontFamily: 'PlusJakartaSans-Bold',
    color: '#5316B8',
    marginBottom: 4,
    includeFontPadding: false,
  },
  modalStepBody: {
    fontSize: 12,
    lineHeight: 18.5,
    fontFamily: 'PlusJakartaSans-Medium',
    color: '#5E5473',
    includeFontPadding: false,
  },
  fieldLabel: {
    fontSize: 13,
    fontFamily: 'PlusJakartaSans-Bold',
    color: '#181126',
    marginBottom: 6,
    includeFontPadding: false,
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
  errorText: {
    fontSize: 12,
    fontFamily: 'PlusJakartaSans-SemiBold',
    color: '#C82333',
    marginTop: 5,
    includeFontPadding: false,
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  secondaryBtn: {
    flex: 1,
    minHeight: 46,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#DFD2FA',
    backgroundColor: '#F6F3FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryBtnText: {
    fontSize: 14,
    fontFamily: 'PlusJakartaSans-Bold',
    color: '#5316B8',
    includeFontPadding: false,
  },
  primaryBtn: {
    flex: 1,
    minHeight: 46,
    borderRadius: 12,
    backgroundColor: '#6824D6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryBtnText: {
    fontSize: 14,
    fontFamily: 'PlusJakartaSans-Bold',
    color: '#FFFFFF',
    includeFontPadding: false,
  },
});
