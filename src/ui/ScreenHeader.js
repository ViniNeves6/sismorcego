// src/ui/ScreenHeader.js
import React from 'react';
import { View, StyleSheet } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';
import Text from './Text';
import IconButton from './IconButton';

export default function ScreenHeader({ title, subtitle, onBack, trailing }) {
  const { spacing } = useTheme();

  return (
    <View
      style={[
        styles.row,
        { paddingHorizontal: spacing.lg, paddingTop: spacing.sm, paddingBottom: spacing.md, gap: spacing.sm },
      ]}
    >
      {onBack ? (
        <IconButton icon="arrow-left" label="Voltar" onPress={onBack} style={{ marginLeft: -spacing.sm }} />
      ) : null}

      <View style={styles.titles}>
        <Text variant="title" accessibilityRole="header">
          {title}
        </Text>
        {subtitle ? (
          <Text variant="caption" tone="muted">
            {subtitle}
          </Text>
        ) : null}
      </View>

      {trailing}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  titles: { flex: 1, gap: 2 },
});
