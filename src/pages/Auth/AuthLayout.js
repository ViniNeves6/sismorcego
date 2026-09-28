// src/pages/Auth/AuthLayout.js
// O momento de identidade do app: topo em violeta profundo com o morcego da
// marca sangrando pela borda, e o formulário numa folha que sobe por cima.
import React from 'react';
import { View, ScrollView, Image, StatusBar, KeyboardAvoidingView, Platform, StyleSheet } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text, IconButton } from '../../ui';
import { useTheme } from '../../theme/ThemeProvider';

const SHEET_OVERLAP = 28;

export default function AuthLayout({ title, subtitle, onBack, children }) {
  const { colors, spacing, radius, isHighContrast } = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <KeyboardAvoidingView
      style={[styles.fill, { backgroundColor: colors.canvas }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />

      <ScrollView
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        bounces={false}
        contentContainerStyle={styles.grow}
      >
        <LinearGradient
          colors={colors.brandGradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[
            styles.hero,
            {
              paddingTop: insets.top + spacing.md,
              paddingHorizontal: spacing.xl,
              // espaço extra para o morcego aparecer inteiro acima da folha
              paddingBottom: spacing.xxxl + spacing.lg + SHEET_OVERLAP,
            },
          ]}
        >
          {/* Marca: grande, cortada pela borda direita. Decorativa. */}
          <Image
            source={require('../../assets/images/Logomarca.png')}
            style={[styles.bat, { top: insets.top + spacing.xs, tintColor: colors.onBrand }]}
            resizeMode="contain"
            accessible={false}
            importantForAccessibility="no"
          />

          {onBack ? (
            <IconButton icon="arrow-left" label="Voltar" tone="onBrand" onPress={onBack} style={{ marginLeft: -spacing.md }} />
          ) : (
            <View style={{ height: spacing.xl }} />
          )}

          <View style={{ marginTop: spacing.xxl, gap: spacing.xs }}>
            <Text variant="display" tone="onBrand" accessibilityRole="header">
              Sismorcego
            </Text>
            <Text variant="body" tone="onBrand" style={styles.tagline}>
              Vigilância da raiva na Amazônia
            </Text>
          </View>
        </LinearGradient>

        <View
          style={[
            styles.sheet,
            {
              backgroundColor: colors.canvas,
              borderTopLeftRadius: radius.xl,
              borderTopRightRadius: radius.xl,
              marginTop: -SHEET_OVERLAP,
              padding: spacing.xl,
              paddingBottom: insets.bottom + spacing.xl,
              gap: spacing.lg,
            },
            isHighContrast && [styles.sheetHC, { borderColor: colors.line }],
          ]}
        >
          <View style={{ gap: spacing.xs }}>
            <Text variant="title" accessibilityRole="header">
              {title}
            </Text>
            {subtitle ? (
              <Text variant="body" tone="muted">
                {subtitle}
              </Text>
            ) : null}
          </View>

          {children}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  grow: { flexGrow: 1 },
  hero: { overflow: 'hidden' },
  sheet: { flex: 1 },
  sheetHC: { borderTopWidth: 2 },
  tagline: { opacity: 0.85 },
  bat: { position: 'absolute', right: -36, width: 260, height: 205, opacity: 0.24 },
});
