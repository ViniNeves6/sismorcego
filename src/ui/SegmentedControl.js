// src/ui/SegmentedControl.js
// Filtro exclusivo com poucas opções. options: [{ value, label }]
import React from 'react';
import { View, Pressable, StyleSheet } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';
import Text from './Text';

export default function SegmentedControl({ options, value, onChange, label, style }) {
  const { colors, radius, spacing, touchTarget } = useTheme();

  return (
    <View
      accessibilityRole="radiogroup"
      accessibilityLabel={label}
      style={[
        styles.track,
        { backgroundColor: colors.surfaceMuted, borderRadius: radius.md, padding: spacing.xs, gap: spacing.xs },
        style,
      ]}
    >
      {options.map((opt) => {
        const selected = opt.value === value;
        return (
          <Pressable
            key={opt.value}
            onPress={() => onChange(opt.value)}
            accessibilityRole="radio"
            accessibilityLabel={opt.label}
            accessibilityState={{ selected }}
            android_ripple={{ color: colors.ripple }}
            style={[
              styles.segment,
              {
                minHeight: touchTarget - 4,
                borderRadius: radius.sm,
              },
              selected && { backgroundColor: colors.surface, borderColor: colors.primary },
            ]}
          >
            <Text variant="label" style={{ color: selected ? colors.primary : colors.inkMuted }}>
              {opt.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  track: { flexDirection: 'row' },
  segment: { flex: 1, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: 'transparent' },
});
