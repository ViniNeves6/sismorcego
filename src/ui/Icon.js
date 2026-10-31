// src/ui/Icon.js
// Ícones vetoriais. Feather é a família padrão (traço único); MaterialCommunityIcons
// só entra pra casos sem equivalente no Feather (ex.: ícones de animal). Decorativo
// por padrão: escondido de leitores de tela. Controles com ícone devem dar o nome
// acessível ao botão, não ao ícone.
import React from 'react';
import Feather from 'react-native-vector-icons/Feather';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { useTheme } from '../theme/ThemeProvider';

const FAMILIES = { Feather, MaterialCommunityIcons };

export default function Icon({ name, family = 'Feather', size = 'md', color, style }) {
  const { colors, iconSize } = useTheme();
  const px = typeof size === 'number' ? size : iconSize[size];
  const IconComponent = FAMILIES[family] || Feather;

  return (
    <IconComponent
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
