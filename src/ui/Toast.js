// src/ui/Toast.js
// Feedback não bloqueante. Um toast por vez; anuncia para leitores de tela.
import React, { createContext, use, useCallback, useMemo, useRef, useState, useEffect } from 'react';
import { Animated, Easing, Pressable, StyleSheet, View, AccessibilityInfo } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../theme/ThemeProvider';
import useReduceMotion from './useReduceMotion';
import Text from './Text';
import Icon from './Icon';

const ToastContext = createContext({ show: () => {} });

const ICONS = { success: 'check-circle', danger: 'alert-circle', warning: 'alert-triangle', info: 'info' };
const COLOR_KEY = { success: 'success', danger: 'danger', warning: 'warning', info: 'primary' };

export function ToastProvider({ children }) {
  const { colors, radius, spacing, motion, shadow } = useTheme();
  const insets = useSafeAreaInsets();
  const reduceMotion = useReduceMotion();

  const [toast, setToast] = useState(null);
  const progress = useRef(new Animated.Value(0)).current;
  const timer = useRef(null);

  const hide = useCallback(() => {
    clearTimeout(timer.current);
    Animated.timing(progress, {
      toValue: 0,
      duration: reduceMotion ? 0 : motion.exit,
      easing: Easing.in(Easing.cubic),
      useNativeDriver: true,
    }).start(({ finished }) => finished && setToast(null));
  }, [progress, reduceMotion, motion.exit]);

  const show = useCallback(
    (message, { tone = 'info', duration = 4000 } = {}) => {
      clearTimeout(timer.current);
      setToast({ message, tone, id: Date.now() });
      AccessibilityInfo.announceForAccessibility(message);
      progress.setValue(0);
      Animated.timing(progress, {
        toValue: 1,
        duration: reduceMotion ? 0 : motion.enter,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start();
      timer.current = setTimeout(hide, duration);
    },
    [progress, hide, reduceMotion, motion.enter],
  );

  useEffect(() => () => clearTimeout(timer.current), []);

  const value = useMemo(() => ({ show }), [show]);
  const accent = toast ? colors[COLOR_KEY[toast.tone]] : colors.primary;

  return (
    <ToastContext value={value}>
      {children}
      {toast ? (
        <Animated.View
          pointerEvents="box-none"
          style={[
            styles.host,
            {
              top: insets.top + spacing.sm,
              paddingHorizontal: spacing.lg,
              opacity: progress,
              transform: [{ translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [-16, 0] }) }],
            },
          ]}
        >
          <Pressable
            onPress={hide}
            accessibilityRole="alert"
            accessibilityLabel={toast.message}
            style={[
              styles.toast,
              shadow.raised,
              {
                backgroundColor: colors.surface,
                borderColor: accent,
                borderRadius: radius.md,
                padding: spacing.md,
                gap: spacing.md,
              },
            ]}
          >
            <Icon name={ICONS[toast.tone]} size="md" color={accent} />
            <View style={styles.message}>
              <Text variant="label">{toast.message}</Text>
            </View>
          </Pressable>
        </Animated.View>
      ) : null}
    </ToastContext>
  );
}

export function useToast() {
  return use(ToastContext);
}

const styles = StyleSheet.create({
  host: { position: 'absolute', left: 0, right: 0 },
  toast: { flexDirection: 'row', alignItems: 'center', borderWidth: 1.5 },
  message: { flex: 1 },
});
