// src/theme/ThemeProvider.js
// Única fonte de tema. Junta: esquema do sistema (claro/escuro), alto contraste
// e escala de fonte do AccessibilityProvider. Componentes só chamam useTheme().
import React, { createContext, use, useMemo } from 'react';
import { useColorScheme } from 'react-native';
import useAccessibility from '../hooks/useAccessibility';
import { palettes } from './palettes';
import { spacing, radius, iconSize, touchTarget, typography, motion, shadow } from './tokens';

function buildTheme(colors, fontScale) {
  // Escala tipográfica já multiplicada pelo fontScale do app.
  const type = {};
  for (const [name, t] of Object.entries(typography)) {
    type[name] = {
      ...t,
      fontSize: Math.round(t.fontSize * fontScale),
      lineHeight: Math.round(t.lineHeight * fontScale),
    };
  }

  return {
    colors,
    isDark: colors.mode !== 'light',
    isHighContrast: colors.mode === 'highContrast',
    fontScale,
    type,
    spacing,
    radius,
    iconSize,
    touchTarget,
    motion,
    shadow,
  };
}

const ThemeContext = createContext(buildTheme(palettes.light, 1));

export function ThemeProvider({ children }) {
  const scheme = useColorScheme();
  const { highContrast, fontScale } = useAccessibility();

  const theme = useMemo(() => {
    const colors = highContrast ? palettes.highContrast : scheme === 'dark' ? palettes.dark : palettes.light;
    return buildTheme(colors, fontScale);
  }, [scheme, highContrast, fontScale]);

  return <ThemeContext value={theme}>{children}</ThemeContext>;
}

export function useTheme() {
  return use(ThemeContext);
}

// Tema do React Navigation derivado dos mesmos tokens.
export function makeNavigationTheme(theme) {
  const { colors } = theme;
  return {
    dark: theme.isDark,
    colors: {
      primary: colors.primary,
      background: colors.canvas,
      card: colors.surface,
      text: colors.ink,
      border: colors.line,
      notification: colors.danger,
    },
    fonts: {
      regular: { fontFamily: 'System', fontWeight: '400' },
      medium: { fontFamily: 'System', fontWeight: '500' },
      bold: { fontFamily: 'System', fontWeight: '700' },
      heavy: { fontFamily: 'System', fontWeight: '800' },
    },
  };
}
