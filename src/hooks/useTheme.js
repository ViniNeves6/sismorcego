// src/hooks/useTheme.js
import { useColorScheme } from 'react-native';
import { getThemeColors } from '../styles/colors';

export const useTheme = () => {
  const colorScheme = useColorScheme(); // 'light' | 'dark' | null
  const theme = colorScheme || 'light'; // Fallback para light
  const colors = getThemeColors(theme);
  
  return { colors, theme };
};