// src/ui/Icon.js
// Ícones vetoriais Feather (uma família, traço único). Decorativo por padrão:
// escondido de leitores de tela. Controles com ícone devem dar o nome acessível
// ao botão, não ao ícone.
import React from 'react';
import Feather from 'react-native-vector-icons/Feather';
import { useTheme } from '../theme/ThemeProvider';

export default function Icon({ name, size = 'md', color, style }) {
  const { colors, iconSize } = useTheme();
  const px = typeof size === 'number' ? size : iconSize[size];

  return (
    <Feather
      name={name}
      size={px}
      color={color ?? colors.ink}
      style={style}
      accessible={false}
      importantForAccessibility="no"
      accessibilityElementsHidden
    />
  );
}
