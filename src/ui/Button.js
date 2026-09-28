// src/ui/Button.js
import React from 'react';
import { Pressable, ActivityIndicator, View, StyleSheet } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';
import Text from './Text';
import Icon from './Icon';

// Variantes explícitas; cada uma resolve suas cores a partir do tema.
function resolveVariant(variant, colors, pressed) {
  switch (variant) {
    case 'secondary':
      return {
        bg: pressed ? colors.primarySoft : colors.surface,
        fg: colors.primary,
        border: colors.primary,
      };
    case 'ghost':
      return {
        bg: pressed ? colors.primarySoft : 'transparent',
        fg: colors.primary,
        border: 'transparent',
      };
    case 'danger':
      return {
        bg: pressed ? colors.dangerSoft : colors.surface,
        fg: colors.danger,
        border: colors.danger,
      };
    case 'primary':
    default:
      return {
        bg: pressed ? colors.primaryPressed : colors.primary,
        fg: colors.onPrimary,
        border: colors.primary,
      };
  }
}

export default function Button({
  title,
  onPress,
  variant = 'primary',
  icon,
  loading = false,
  disabled = false,
  accessibilityHint,
  style,
}) {
  const { colors, radius, spacing, touchTarget } = useTheme();
  const inactive = disabled || loading;

  return (
    <Pressable
      onPress={onPress}
      disabled={inactive}
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: inactive, busy: loading }}
      android_ripple={{ color: colors.ripple }}
      style={({ pressed }) => {
        const v = resolveVariant(variant, colors, pressed);
        return [
          styles.base,
          {
            minHeight: touchTarget + 4,
            borderRadius: radius.md,
            paddingHorizontal: spacing.xl,
            backgroundColor: v.bg,
            borderColor: v.border,
            opacity: disabled ? 0.45 : 1,
          },
          style,
        ];
      }}
    >
      {({ pressed }) => {
        const { fg } = resolveVariant(variant, colors, pressed);
        return (
          <View style={[styles.content, { gap: spacing.sm }]}>
            {loading ? (
              <ActivityIndicator color={fg} />
            ) : (
              <>
                {icon ? <Icon name={icon} size="md" color={fg} /> : null}
                <Text variant="button" style={{ color: fg }}>
                  {title}
                </Text>
              </>
            )}
          </View>
        );
      }}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    overflow: 'hidden',
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
