// src/styles/colors.js

const lightColors = {
  primary: '#6A00FF',   // Roxo principal
  secondary: '#00B0FF', // Azul de destaque
  success: '#4CAF50',   // Verde para sucesso
  warning: '#FF9800',   // Laranja para avisos
  error: '#F44336',     // Vermelho para erros
  background: '#FFFFFF',
  surface: '#F5F5F7',
  text: '#000000',
  textSecondary: '#555555',
  border: '#E0E0E0',
  card: '#F5F5F5',
  placeholder: '#9E9E9E',
};

const darkColors = {
  primary: '#8F5BEE',
  secondary: '#00B0FF',
  success: '#66BB6A',
  warning: '#FFA726',
  error: '#EF5350',
  background: '#121212',
  surface: '#1E1E1E',
  text: '#FFFFFF',
  textSecondary: '#AAAAAA',
  border: '#333333',
  card: '#1E1E1E',
  placeholder: '#757575',
};

// Função para retornar o tema
export const getThemeColors = (mode = 'light') => {
  return mode === 'dark' ? darkColors : lightColors;
};

// Se quiser usar diretamente
export const colors = {
  light: lightColors,
  dark: darkColors,
};

export default getThemeColors;