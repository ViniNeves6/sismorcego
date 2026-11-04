// src/ui/SwitchRow.js
// Linha de configuração com interruptor. A linha inteira alterna (alvo grande);
// o Switch é só o indicador visual, sem foco próprio para leitores de tela.
import React from 'react';
import { Pressable, Switch, View, StyleSheet } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';
import Text from './Text';
import Icon from './Icon';

export default function SwitchRow({ icon, title, subtitle, value, onValueChange }) {
  const { colors, radius, spacing, touchTarget } = useTheme();

  return (
    <Pressable
      onPress={() => onValueChange(!value)}
      accessibilityRole="switch"
      accessibilityLabel={title}
      accessibilityHint={subtitle}
      accessibilityState={{ checked: value }}
      android_ripple={{ color: colors.ripple }}
      style={({ pressed }) => [
        styles.row,
        { minHeight: touchTarget + 8, paddingHorizontal: spacing.lg, gap: spacing.md },
        pressed && { backgroundColor: colors.primarySoft },
      ]}
    >
      {icon ? (
        <View style={[styles.tile, { backgroundColor: colors.primarySoft, borderRadius: radius.md }]}>
          <Icon name={icon} size="md" color={colors.onPrimarySoft} />
        </View>
      ) : null}

      <View style={styles.text}>
        <Text variant="bodyStrong">{title}</Text>
        {subtitle ? (
          <Text variant="caption" tone="muted">
            {subtitle}
          </Text>
        ) : null}
      </View>

      <View pointerEvents="none" importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
        <Switch
          value={value}
          trackColor={{ false: colors.inputBorder, true: colors.primary }}
          thumbColor={colors.surface}
          ios_backgroundColor={colors.inputBorder}
        />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10 },
  tile: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  text: { flex: 1, gap: 2 },
});
