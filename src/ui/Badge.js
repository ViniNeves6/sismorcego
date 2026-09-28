// src/ui/Badge.js
// Estado sempre tem texto (e ícone opcional): cor nunca é o único indicador.
import React from 'react';
import { View, StyleSheet } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';
import Text from './Text';
import Icon from './Icon';

const TONES = {
  neutral: { bg: 'surfaceMuted', fg: 'inkMuted' },
  primary: { bg: 'primarySoft', fg: 'onPrimarySoft' },
  success: { bg: 'successSoft', fg: 'success' },
  warning: { bg: 'warningSoft', fg: 'warning' },
  danger: { bg: 'dangerSoft', fg: 'danger' },
};

export default function Badge({ label, tone = 'neutral', icon, style }) {
  const { colors, radius, spacing, type, isHighContrast } = useTheme();
  const t = TONES[tone];
  const fg = colors[t.fg];

  return (
    <View
      accessible
      accessibilityLabel={label}
      style={[
        styles.base,
        {
          backgroundColor: colors[t.bg],
          borderRadius: radius.pill,
          paddingHorizontal: spacing.md,
          paddingVertical: spacing.xs,
          gap: spacing.xs,
        },
        isHighContrast && [styles.outlined, { borderColor: fg }],
        style,
      ]}
    >
      {icon ? <Icon name={icon} size="sm" color={fg} /> : null}
      <Text variant="label" style={{ color: fg, fontSize: type.caption.fontSize, lineHeight: type.caption.lineHeight }}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  base: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start' },
  outlined: { borderWidth: 1 },
});
