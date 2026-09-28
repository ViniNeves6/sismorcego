// src/ui/EmptyState.js
// Tela vazia é um convite à ação: diz o que aconteceu e o que fazer.
import React from 'react';
import { View, StyleSheet } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';
import Text from './Text';
import Icon from './Icon';
import Button from './Button';

export default function EmptyState({ icon, title, description, actionLabel, onAction }) {
  const { colors, spacing, radius } = useTheme();

  return (
    <View style={[styles.wrap, { padding: spacing.xxl, gap: spacing.md }]}>
      <View style={[styles.disc, { backgroundColor: colors.primarySoft, borderRadius: radius.pill }]}>
        <Icon name={icon} size="lg" color={colors.onPrimarySoft} />
      </View>
      <Text variant="heading" style={styles.center}>
        {title}
      </Text>
      {description ? (
        <Text variant="body" tone="muted" style={styles.center}>
          {description}
        </Text>
      ) : null}
      {actionLabel ? (
        <Button title={actionLabel} onPress={onAction} variant="secondary" style={styles.action} />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', justifyContent: 'center' },
  disc: { width: 64, height: 64, alignItems: 'center', justifyContent: 'center' },
  center: { textAlign: 'center' },
  action: { alignSelf: 'stretch', marginTop: 8 },
});
