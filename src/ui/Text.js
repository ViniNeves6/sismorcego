// src/ui/Text.js
import React from 'react';
import { StyleSheet } from 'react-native';
import { FontText as RNText } from './FontText';
import { useTheme } from '../theme/ThemeProvider';

// tone → chave de cor no tema
const TONES = {
  default: 'ink',
  muted: 'inkMuted',
  subtle: 'inkSubtle',
  primary: 'primary',
  onPrimary: 'onPrimary',
  onBrand: 'onBrand',
  success: 'success',
  warning: 'warning',
  danger: 'danger',
};

export default function Text({ variant = 'body', tone = 'default', style, children, ...rest }) {
  const { type, colors, fontScale } = useTheme();
  const custom = { ...StyleSheet.flatten(style) };
  if (typeof custom.fontSize === 'number') custom.fontSize *= fontScale;
  if (typeof custom.lineHeight === 'number') custom.lineHeight *= fontScale;

  return (
    <RNText
      accessibilityScaleApplied
      accessibilityColorsApplied
      // fontScale já vem no tema; limita também a escala do sistema.
      maxFontSizeMultiplier={1.4}
      {...rest}
      style={[type[variant], { color: colors[TONES[tone]] }, custom]}
    >
      {children}
    </RNText>
  );
}
