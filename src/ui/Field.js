// src/ui/Field.js
// Estrutura comum de campos de formulário: rótulo, controle, erro ou dica.
import React from 'react';
import { View, StyleSheet } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';
import Text from './Text';
import Icon from './Icon';

export default function Field({ label, hint, error, children, style }) {
  const { colors, spacing } = useTheme();

  return (
    <View style={[{ gap: spacing.xs }, style]}>
      {label ? <Text variant="label">{label}</Text> : null}
      {children}
      {error ? (
        <View style={[styles.message, { gap: spacing.xs }]} accessibilityLiveRegion="polite">
          <Icon name="alert-circle" size="sm" color={colors.danger} />
          <Text variant="caption" tone="danger" style={styles.messageText}>
            {error}
          </Text>
        </View>
      ) : hint ? (
        <Text variant="caption" tone="muted">
          {hint}
        </Text>
      ) : null}
    </View>
  );
}

// Caixa visual do controle (compartilhada por TextField e Select).
export function useFieldBox({ error, focused = false, editable = true }) {
  const { colors, radius, spacing, touchTarget } = useTheme();
  return {
    minHeight: touchTarget + 4,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: error ? colors.danger : focused ? colors.primary : colors.inputBorder,
    backgroundColor: editable ? colors.surface : colors.surfaceMuted,
    paddingHorizontal: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  };
}

const styles = StyleSheet.create({
  message: { flexDirection: 'row', alignItems: 'center' },
  messageText: { flex: 1 },
});
