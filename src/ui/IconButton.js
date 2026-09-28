// src/ui/IconButton.js
// Botão só com ícone. `label` é obrigatório: é o nome acessível.
import React from 'react';
import { Pressable, StyleSheet } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';
import Icon from './Icon';

export default function IconButton({ icon, label, onPress, tone = 'default', disabled = false, style }) {
  const { colors, touchTarget, radius } = useTheme();
  const color =
    tone === 'onBrand' ? colors.onBrand : tone === 'primary' ? colors.primary : tone === 'danger' ? colors.danger : colors.ink;

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      hitSlop={4}
      android_ripple={{ color: colors.ripple, borderless: true, radius: touchTarget / 2 }}
      style={({ pressed }) => [
        styles.base,
        {
          width: touchTarget,
          height: touchTarget,
          borderRadius: radius.pill,
          backgroundColor: pressed ? colors.primarySoft : 'transparent',
          opacity: disabled ? 0.45 : 1,
        },
        style,
      ]}
    >
      <Icon name={icon} size="md" color={color} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: { alignItems: 'center', justifyContent: 'center' },
});
