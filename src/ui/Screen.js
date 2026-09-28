// src/ui/Screen.js
// Duas variantes explícitas em vez de um Screen com flags:
//   <Screen>        conteúdo que cabe na tela (ex.: listas com FlatList própria)
//   <ScrollScreen>  formulários e páginas longas (rola, cuida do teclado)
import React from 'react';
import { ScrollView, KeyboardAvoidingView, Platform, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../theme/ThemeProvider';

const DEFAULT_EDGES = ['top', 'left', 'right'];

export function Screen({ children, edges = DEFAULT_EDGES, style }) {
  const { colors } = useTheme();
  return (
    <SafeAreaView edges={edges} style={[styles.fill, { backgroundColor: colors.canvas }, style]}>
      {children}
    </SafeAreaView>
  );
}

export function ScrollScreen({
  children,
  header,
  footer,
  edges = DEFAULT_EDGES,
  contentContainerStyle,
  style,
  ...scrollProps
}) {
  const { colors, spacing } = useTheme();

  return (
    <SafeAreaView edges={edges} style={[styles.fill, { backgroundColor: colors.canvas }, style]}>
      {header}
      <KeyboardAvoidingView
        style={styles.fill}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[
            { padding: spacing.lg, paddingBottom: spacing.xxl, gap: spacing.lg },
            contentContainerStyle,
          ]}
          {...scrollProps}
        >
          {children}
        </ScrollView>
        {footer}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
});
