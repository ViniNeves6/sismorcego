// src/ui/ListRow.js
// ListGroup agrupa linhas numa superfície única com divisores.
import React, { Children, Fragment } from 'react';
import { View, Pressable, StyleSheet } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';
import Text from './Text';
import Icon from './Icon';

export function ListGroup({ children, style }) {
  const { colors, radius } = useTheme();
  const rows = Children.toArray(children).filter(Boolean);

  return (
    <View
      style={[
        styles.group,
        { backgroundColor: colors.surface, borderColor: colors.line, borderRadius: radius.lg },
        style,
      ]}
    >
      {rows.map((row, i) => (
        <Fragment key={row.key ?? i}>
          {i > 0 ? <View style={[styles.divider, { backgroundColor: colors.line }]} /> : null}
          {row}
        </Fragment>
      ))}
    </View>
  );
}

export function ListRow({ icon, title, subtitle, onPress, trailing, tone = 'default' }) {
  const { colors, radius, spacing, touchTarget } = useTheme();
  const danger = tone === 'danger';
  const tileBg = danger ? colors.dangerSoft : colors.primarySoft;
  const tileFg = danger ? colors.danger : colors.onPrimarySoft;

  const content = (
    <View style={[styles.row, { minHeight: touchTarget + 8, paddingHorizontal: spacing.lg, gap: spacing.md }]}>
      {icon ? (
        <View style={[styles.tile, { backgroundColor: tileBg, borderRadius: radius.md }]}>
          <Icon name={icon} size="md" color={tileFg} />
        </View>
      ) : null}

      <View style={styles.text}>
        <Text variant="bodyStrong" tone={danger ? 'danger' : 'default'}>
          {title}
        </Text>
        {subtitle ? (
          <Text variant="caption" tone="muted" numberOfLines={2}>
            {subtitle}
          </Text>
        ) : null}
      </View>

      {trailing ?? (onPress ? <Icon name="chevron-right" size="md" color={colors.inkSubtle} /> : null)}
    </View>
  );

  if (!onPress) return content;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={subtitle ? `${title}. ${subtitle}` : title}
      android_ripple={{ color: colors.ripple }}
      style={({ pressed }) => pressed && { backgroundColor: colors.primarySoft }}
    >
      {content}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  group: { borderWidth: 1, overflow: 'hidden' },
  divider: { height: StyleSheet.hairlineWidth },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10 },
  tile: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  text: { flex: 1, gap: 2 },
});
