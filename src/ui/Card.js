// src/ui/Card.js
// Superfície com borda fina (sem sombra). Vira botão quando recebe onPress.
import React from 'react';
import { View, Pressable } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';

export default function Card({ children, onPress, accessibilityLabel, style }) {
  const { colors, radius, spacing } = useTheme();

  const base = {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.line,
    padding: spacing.lg,
  };

  if (!onPress) return <View style={[base, style]}>{children}</View>;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      android_ripple={{ color: colors.ripple }}
      style={({ pressed }) => [base, pressed && { backgroundColor: colors.primarySoft }, style]}
    >
      {children}
    </Pressable>
  );
}
