// src/ui/Screen.js
// Duas variantes explícitas em vez de um Screen com flags:
//   <Screen>        conteúdo que cabe na tela (ex.: listas com FlatList própria)
//   <ScrollScreen>  formulários e páginas longas (rola, cuida do teclado)
import React from 'react';
import { View, Platform, StyleSheet } from 'react-native';
import KeyboardScrollView from './KeyboardScrollView';
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
      <View
        style={styles.fill}
      >
        <KeyboardScrollView
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
        </KeyboardScrollView>
        {footer}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
});
