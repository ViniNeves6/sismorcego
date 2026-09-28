// src/ui/FooterBar.js
// Barra de ação fixa no rodapé da tela (ex.: "Salvar registro").
import React from 'react';
import { View, StyleSheet } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';

export default function FooterBar({ children }) {
  const { colors, spacing } = useTheme();

  return (
    <View
      style={[
        styles.bar,
        { backgroundColor: colors.surface, borderTopColor: colors.line, padding: spacing.lg, gap: spacing.sm },
      ]}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { borderTopWidth: 1 },
});
