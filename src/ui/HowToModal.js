import { Animated, Pressable, Text, View } from './AccessibleNative';
import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Easing, Image, PanResponder, StyleSheet } from 'react-native';
import useFadeCompositing from './useFadeCompositing';
import useReduceMotion from './useReduceMotion';
import useSpeakOnMount from '../hooks/useSpeakOnMount';
import HowToRecordsPreview from './HowToRecordsPreview';

const SLIDE_2_IMG = require('../assets/images/howto_slide_2.png');
const SLIDE_3_IMG = require('../assets/images/howto_slide_3.png');

export default function HowToModal({ visible, onClose, isCoordenador = false, reduceMotion: reduceMotionProp = false }) {
  const reduceMotion = useReduceMotion() || reduceMotionProp;
  const [rendered, setRendered] = useState(visible);
  const [step, setStep] = useState(0);
  const [viewportWidth, setViewportWidth] = useState(310);

  const modalAnim = useRef(new Animated.Value(visible ? 1 : 0)).current;
  const compositing = useFadeCompositing(modalAnim, visible ? 1 : 0, reduceMotion);
  const slideAnim = useRef(new Animated.Value(0)).current;
  const slideMotion = useRef(null);
  const stepRef = useRef(0);
  stepRef.current = step;

  useLayoutEffect(() => {
    if (visible) {
      setStep(0);
      slideAnim.setValue(0);
      setRendered(true);
    }
  }, [visible, slideAnim]);
  useEffect(() => {
    if (!rendered) return;
    if (reduceMotion) {
      modalAnim.setValue(visible ? 1 : 0);
      if (!visible) setRendered(false);
      return;
    }
    let cancelled = false;
    const transition = Animated.timing(modalAnim, {
      toValue: visible ? 1 : 0, duration: visible ? 220 : 200,
      easing: Easing.out(Easing.ease), useNativeDriver: true,
    });
    transition.start(({ finished }) => { if (finished && !cancelled && !visible) setRendered(false); });
    return () => { cancelled = true; transition.stop(); };
  }, [visible, rendered, reduceMotion, modalAnim]);

  const goToStep = (nextIdx) => {
    const clamped = Math.max(0, Math.min(2, nextIdx));
    slideMotion.current?.stop();
    setStep(clamped);
    if (reduceMotion) {
      slideAnim.setValue(clamped);
    } else {
      slideMotion.current = Animated.timing(slideAnim, {
        toValue: clamped,
        duration: 280,
        easing: Easing.bezier(0.22, 0.82, 0.25, 1),
        useNativeDriver: true,
      });
      slideMotion.current.start();
    }
  };
  const navigateStep = useRef(goToStep);
  navigateStep.current = goToStep;
  useEffect(() => {
    if (reduceMotion) {
      slideMotion.current?.stop();
      slideAnim.setValue(stepRef.current);
    }
    return () => slideMotion.current?.stop();
  }, [reduceMotion, slideAnim]);

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gestureState) =>
        Math.abs(gestureState.dx) > 15 &&
        Math.abs(gestureState.dx) > Math.abs(gestureState.dy),
      onPanResponderRelease: (_, gestureState) => {
        if (gestureState.dx < -38 && stepRef.current < 2) {
          navigateStep.current(stepRef.current + 1);
        } else if (gestureState.dx > 38 && stepRef.current > 0) {
          navigateStep.current(stepRef.current - 1);
        }
      },
    }),
  ).current;

  useSpeakOnMount(`Como usar o Sismorcego. Passo ${step + 1} de 3. ${[
    'Consulte os registros disponíveis no aparelho e filtre entre todos, pendentes e enviados',
    'Registre a ocorrência em Notificar, informando a espécie mordida e os dados do local',
    'Toque em Sincronizar agora para enviar os registros pendentes quando houver conexão',
  ][step]}. Use os botões para avançar ou voltar`, { active: visible, priority: 30 });
  if (!rendered) return null;

  const translateY = modalAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [14, 0],
  });
  const scale = modalAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.98, 1],
  });
  const trackTranslateX = slideAnim.interpolate({
    inputRange: [0, 1, 2],
    outputRange: [0, -viewportWidth, -viewportWidth * 2],
  });

  const handleSecondary = () => {
    if (step === 0) {
      onClose();
    } else {
      goToStep(step - 1);
    }
  };

  const handlePrimary = () => {
    if (step < 2) {
      goToStep(step + 1);
    } else {
      onClose();
    }
  };

  return (
    <Animated.View
      {...compositing}
      style={[styles.overlay, { opacity: modalAnim }]}
      pointerEvents={visible ? 'auto' : 'none'}
    >
      <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
      <Animated.View
        style={[
          styles.card,
          {
            transform: [{ translateY }, { scale }],
          },
        ]}
      >
        <View style={styles.header}>
          <Text style={styles.title}>Como usar?</Text>
          <View style={styles.counterPill}>
            <Text style={styles.counterText}>{`${step + 1} / 3`}</Text>
          </View>
        </View>

        <View
          style={styles.viewport}
          onLayout={(e) => {
            const w = e.nativeEvent.layout.width;
            if (w > 0 && Math.abs(w - viewportWidth) > 1) {
              setViewportWidth(w);
            }
          }}
          {...panResponder.panHandlers}
        >
          <Animated.View
            style={[
              styles.track,
              {
                width: viewportWidth * 3,
                transform: [{ translateX: trackTranslateX }],
              },
            ]}
          >
            {/* Slide 1 */}
            <View style={[styles.slide, { width: viewportWidth }]}>
              <View style={styles.visualBox}>
                <HowToRecordsPreview isCoordenador={isCoordenador} />
              </View>
              <View style={styles.stepCard}>
                <View style={styles.stepNumBadge}>
                  <Text style={styles.stepNumText}>1</Text>
                </View>
                <View style={styles.stepContent}>
                  <Text style={styles.stepTitle}>Consultar Registros</Text>
                  <Text style={styles.stepDesc}>
                    Na aba <Text style={styles.stepBold}>Registros</Text>,
                    acompanhe todas as notificações salvas e filtre entre
                    pendentes e enviadas.
                  </Text>
                </View>
              </View>
            </View>

            {/* Slide 2 */}
            <View style={[styles.slide, { width: viewportWidth }]}>
              <View style={styles.visualBox}>
                <Image
                  source={SLIDE_2_IMG}
                  style={styles.slideImg}
                  resizeMode="contain"
                />
              </View>
              <View style={styles.stepCard}>
                <View style={styles.stepNumBadge}>
                  <Text style={styles.stepNumText}>2</Text>
                </View>
                <View style={styles.stepContent}>
                  <Text style={styles.stepTitle}>
                    Registrar Nova Ocorrência
                  </Text>
                  <Text style={styles.stepDesc}>
                    Toque no botão roxo central{' '}
                    <Text style={styles.stepBold}>+ Notificar</Text> para
                    cadastrar um caso de mordedura, mesmo sem internet.
                  </Text>
                </View>
              </View>
            </View>

            {/* Slide 3 */}
            <View style={[styles.slide, { width: viewportWidth }]}>
              <View style={styles.visualBox}>
                <Image
                  source={SLIDE_3_IMG}
                  style={styles.slideImg}
                  resizeMode="contain"
                />
              </View>
              <View style={styles.stepCard}>
                <View style={styles.stepNumBadge}>
                  <Text style={styles.stepNumText}>3</Text>
                </View>
                <View style={styles.stepContent}>
                  <Text style={styles.stepTitle}>Sincronização</Text>
                  <Text style={styles.stepDesc}>
                    Quando estiver com internet, toque em{' '}
                    <Text style={styles.stepBold}>Sincronizar agora</Text> no
                    card roxo para enviar os registros pendentes.
                  </Text>
                </View>
              </View>
            </View>
          </Animated.View>
        </View>

        {/* Dots */}
        <View style={styles.dotsRow}>
          {[0, 1, 2].map((idx) => {
            const active = idx === step;
            return (
              <Pressable
                key={idx}
                onPress={() => goToStep(idx)}
                style={[styles.dot, active && styles.dotActive]}
              />
            );
          })}
        </View>

        {/* Actions */}
        <View style={styles.actionsRow}>
          <Pressable
            onPress={handleSecondary}
            style={({ pressed }) => [
              styles.secondaryBtn,
              pressed && { opacity: 0.85 },
            ]}
          >
            <Text style={styles.secondaryBtnText}>
              {step === 0 ? 'Pular' : 'Voltar'}
            </Text>
          </Pressable>
          <Pressable
            onPress={handlePrimary}
            style={({ pressed }) => [
              styles.primaryBtn,
              pressed && { opacity: 0.9 },
            ]}
          >
            <Text style={styles.primaryBtnText}>
              {step === 2 ? 'Entendi' : 'Avançar'}
            </Text>
          </Pressable>
        </View>
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(28, 13, 54, 0.56)',
    zIndex: 120,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  card: {
    width: '100%',
    maxWidth: 356,
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    paddingTop: 22,
    paddingHorizontal: 20,
    paddingBottom: 20,
    borderWidth: 1.5,
    borderColor: '#EFE9FE',
    elevation: 16,
    shadowColor: '#181126',
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 0.28,
    shadowRadius: 24,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  title: {
    fontSize: 20,
    fontFamily: 'PlusJakartaSans-ExtraBold',
    color: '#181126',
    letterSpacing: -0.4,
    includeFontPadding: false,
  },
  counterPill: {
    paddingVertical: 5,
    paddingHorizontal: 11,
    borderRadius: 999,
    backgroundColor: '#F6F3FF',
    borderWidth: 1,
    borderColor: '#EFE9FE',
  },
  counterText: {
    fontSize: 12,
    fontFamily: 'PlusJakartaSans-ExtraBold',
    color: '#5316B8',
    includeFontPadding: false,
  },
  viewport: {
    width: '100%',
    overflow: 'hidden',
  },
  track: {
    flexDirection: 'row',
  },
  slide: {
    flexShrink: 0,
  },
  visualBox: {
    height: 158,
    backgroundColor: '#F8F7FC',
    borderWidth: 1.5,
    borderColor: '#EAE5F5',
    borderRadius: 16,
    padding: 8,
    marginBottom: 14,
    overflow: 'hidden',
  },
  slideImg: {
    width: '100%',
    height: '100%',
    alignSelf: 'stretch',
    borderRadius: 10,
  },
  stepCard: {
    backgroundColor: '#F6F3FF',
    borderWidth: 1,
    borderColor: '#EFE9FE',
    borderRadius: 16,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    minHeight: 114,
  },
  stepNumBadge: {
    width: 26,
    height: 26,
    borderRadius: 999,
    backgroundColor: '#6824D6',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  stepNumText: {
    fontSize: 13,
    fontFamily: 'PlusJakartaSans-ExtraBold',
    color: '#FFFFFF',
    includeFontPadding: false,
  },
  stepContent: {
    flex: 1,
  },
  stepTitle: {
    fontSize: 15,
    fontFamily: 'PlusJakartaSans-ExtraBold',
    color: '#181126',
    marginBottom: 4,
    includeFontPadding: false,
  },
  stepDesc: {
    fontSize: 13.5,
    lineHeight: 19.6,
    fontFamily: 'PlusJakartaSans-Medium',
    color: '#5E5473',
    includeFontPadding: false,
  },
  stepBold: {
    fontFamily: 'PlusJakartaSans-ExtraBold',
    color: '#5316B8',
  },
  dotsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    marginTop: 16,
    marginBottom: 14,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 999,
    backgroundColor: '#DFD2FA',
  },
  dotActive: {
    width: 22,
    backgroundColor: '#6824D6',
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  secondaryBtn: {
    flex: 1,
    minHeight: 46,
    borderRadius: 13,
    borderWidth: 1.5,
    borderColor: '#DFD2FA',
    backgroundColor: '#F6F3FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryBtnText: {
    fontSize: 14,
    fontFamily: 'PlusJakartaSans-ExtraBold',
    color: '#5316B8',
    includeFontPadding: false,
  },
  primaryBtn: {
    flex: 1,
    minHeight: 46,
    borderRadius: 13,
    backgroundColor: '#6824D6',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
    shadowColor: '#6824D6',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 14,
  },
  primaryBtnText: {
    fontSize: 14,
    fontFamily: 'PlusJakartaSans-ExtraBold',
    color: '#FFFFFF',
    includeFontPadding: false,
  },
});
