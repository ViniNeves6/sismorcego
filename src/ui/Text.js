// src/ui/Text.js
import React from 'react';
import { Text as RNText } from 'react-native';
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
  const { type, colors } = useTheme();

  return (
    <RNText
      // fontScale já vem no tema; limita também a escala do sistema.
      maxFontSizeMultiplier={1.4}
      {...rest}
      style={[type[variant], { color: colors[TONES[tone]] }, style]}
    >
      {children}
    </RNText>
  );
}
