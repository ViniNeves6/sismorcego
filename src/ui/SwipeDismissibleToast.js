import React, { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { Easing, PanResponder, StyleSheet, useWindowDimensions } from 'react-native';
import { Animated, Text } from './AccessibleNative';
import { CheckIcon } from './SismorcegoIcons';
import useReduceMotion from './useReduceMotion';

const AUTO_HIDE_MS = 2300;

export default forwardRef(function SwipeDismissibleToast({ reduceMotion = false }, ref) {
  const systemReduceMotion = useReduceMotion();
  const skipMotion = reduceMotion || systemReduceMotion;
  const { width } = useWindowDimensions();
  const viewportWidth = useRef(width);
  viewportWidth.current = width;
  const [toast, setToast] = useState(null);
  const current = useRef(null);
  const pending = useRef(null);
  const phase = useRef('hidden');
  const serial = useRef(0);
  const timer = useRef(null);
  const motion = useRef(null);
  const opacity = useRef(new Animated.Value(0)).current;
  const drag = useRef(new Animated.Value(0)).current;

  const finishDismiss = useCallback(() => {
    const next = pending.current;
    pending.current = null;
    current.current = next;
    phase.current = next ? 'entering' : 'hidden';
    setToast(next);
  }, []);

  const dismiss = useCallback((gesture) => {
    if (phase.current === 'hidden' || phase.current === 'exiting') return;
    phase.current = 'exiting';
    clearTimeout(timer.current);
    motion.current?.stop();
    if (skipMotion) {
      opacity.setValue(0);
      finishDismiss();
      return;
    }
    const destination = gesture ? Math.sign(gesture.dx) * viewportWidth.current : 0;
    const leavingToast = current.current;
    const animation = Animated.parallel([
      Animated.timing(opacity, { toValue: 0, duration: 140, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      Animated.timing(drag, { toValue: destination, duration: 140, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
    ]);
    motion.current = animation;
    animation.start(({ finished }) => {
      if (finished && current.current === leavingToast) finishDismiss();
    });
  }, [drag, finishDismiss, opacity, skipMotion]);

  const restartTimer = useCallback(() => {
    clearTimeout(timer.current);
    timer.current = setTimeout(() => dismiss(), AUTO_HIDE_MS);
  }, [dismiss]);

  const show = useCallback((message) => {
    const next = { message: String(message), id: ++serial.current };
    if (phase.current !== 'hidden') {
      pending.current = next;
      dismiss();
      return;
    }
    current.current = next;
    phase.current = 'entering';
    setToast(next);
  }, [dismiss]);
  useImperativeHandle(ref, () => ({ show }), [show]);

  // Monta antes da entrada e conserva a mensagem até terminar a saída.
  useEffect(() => {
    if (!toast) return;
    if (phase.current === 'exiting') {
      if (skipMotion) finishDismiss();
      return;
    }
    drag.setValue(0);
    opacity.setValue(skipMotion ? 1 : 0);
    phase.current = 'visible';
    if (!skipMotion) {
      motion.current = Animated.timing(opacity, {
        toValue: 1, duration: 180, easing: Easing.out(Easing.cubic), useNativeDriver: true,
      });
      motion.current.start();
    }
    restartTimer();
    return () => {
      clearTimeout(timer.current);
      motion.current?.stop();
    };
  }, [toast, drag, opacity, skipMotion, restartTimer, finishDismiss]);

  const restore = useCallback(() => {
    if (phase.current !== 'dragging') return;
    phase.current = 'visible';
    if (skipMotion) {
      drag.setValue(0);
      restartTimer();
      return;
    }
    const restoringToast = current.current;
    motion.current = Animated.spring(drag, {
      toValue: 0, speed: 28, bounciness: 0, useNativeDriver: true,
    });
    motion.current.start(({ finished }) => {
      if (finished && current.current === restoringToast && phase.current === 'visible') restartTimer();
    });
  }, [drag, restartTimer, skipMotion]);

  const responder = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => false,
    onMoveShouldSetPanResponder: (_, { dx, dy }) => phase.current === 'visible' && Math.abs(dx) > 6 && Math.abs(dx) > Math.abs(dy),
    onPanResponderGrant: () => {
      phase.current = 'dragging';
      clearTimeout(timer.current);
      motion.current?.stop();
      opacity.setValue(1);
    },
    onPanResponderMove: (_, { dx }) => {
      if (phase.current === 'dragging') drag.setValue(dx);
    },
    onPanResponderRelease: (_, gesture) => {
      const distance = Math.abs(gesture.dx);
      const speed = Math.abs(gesture.vx);
      if (distance >= 48 || (distance >= 12 && speed >= 0.7)) dismiss(gesture);
      else restore();
    },
    onPanResponderTerminate: restore,
    onPanResponderTerminationRequest: () => true,
  }), [dismiss, drag, opacity, restore]);

  if (!toast) return null;
  return (
    <Animated.View
      needsOffscreenAlphaCompositing
      {...responder.panHandlers}
      accessibilityRole="alert"
      accessibilityLabel={toast.message}
      accessibilityHint="Arraste para um dos lados para dispensar o aviso"
      accessibilityLiveRegion="polite"
      accessibilityActions={[{ name: 'dismiss', label: 'Dispensar aviso' }]}
      onAccessibilityAction={event => { if (event.nativeEvent.actionName === 'dismiss') dismiss(); }}
      onAccessibilityEscape={() => dismiss()}
      style={[styles.toast, {
        opacity,
        transform: [
          { translateX: drag },
          { translateY: opacity.interpolate({ inputRange: [0, 1], outputRange: [-15, 0] }) },
        ],
      }]}
    >
      <CheckIcon size={18} color="#34D399" strokeWidth={2.6} />
      <Text style={styles.text}>{toast.message}</Text>
    </Animated.View>
  );
});

const styles = StyleSheet.create({
  toast: {
    position: 'absolute', top: 10, left: 20, right: 20,
    backgroundColor: '#1C0D36', paddingVertical: 12, paddingHorizontal: 16,
    borderRadius: 12, flexDirection: 'row', alignItems: 'center', gap: 10,
    zIndex: 300, elevation: 24, shadowColor: '#1C0D36',
    shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.32, shadowRadius: 20,
  },
  text: {
    flex: 1, fontSize: 13, fontFamily: 'PlusJakartaSans-SemiBold',
    color: '#FFFFFF', includeFontPadding: false,
  },
});
