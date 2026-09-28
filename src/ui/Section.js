// src/ui/Section.js
// Agrupa campos/conteúdo sob um título. Hierarquia por tipografia e espaço,
// não por caixas dentro de caixas.
import React from 'react';
import { View } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';
import Text from './Text';

export default function Section({ title, description, children, onLayout, style }) {
  const { spacing } = useTheme();

  return (
    <View onLayout={onLayout} style={[{ gap: spacing.md }, style]}>
      {title ? (
        <View style={{ gap: spacing.xs }}>
          <Text variant="heading" accessibilityRole="header">
            {title}
          </Text>
          {description ? (
            <Text variant="caption" tone="muted">
              {description}
            </Text>
          ) : null}
        </View>
      ) : null}
      {children}
    </View>
  );
}
