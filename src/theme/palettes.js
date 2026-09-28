// src/theme/palettes.js
// Três paletas com os MESMOS nomes semânticos. Componentes nunca usam hex.
//
// Contraste (WCAG): texto ≥ 4.5:1 e bordas de controle ≥ 3:1 em todas.

export const light = {
  mode: 'light',
  // Superfícies
  canvas: '#F6F4FA',
  surface: '#FFFFFF',
  surfaceMuted: '#EFEBF6',
  line: '#E2DCEE',
  inputBorder: '#8A80A6',
  // Texto
  ink: '#1C1730',
  inkMuted: '#5B5472',
  inkSubtle: '#655E7D',
  // Marca
  primary: '#6D28D9',
  primaryPressed: '#5B21B6',
  onPrimary: '#FFFFFF',
  primarySoft: '#EDE7FB',
  onPrimarySoft: '#4C1D95',
  brandDeep: '#2E1065',
  brandGradient: ['#2E1065', '#5B21B6'],
  onBrand: '#FFFFFF',
  // Semânticas
  success: '#116932',
  successSoft: '#DCF5E3',
  warning: '#9A4708',
  warningSoft: '#FDEBD3',
  danger: '#B42318',
  dangerSoft: '#FDE4E1',
  // Sobreposições
  scrim: 'rgba(28, 23, 48, 0.55)',
  ripple: 'rgba(109, 40, 217, 0.12)',
  statusBar: 'dark-content',
};

export const dark = {
  mode: 'dark',
  canvas: '#0F0C1A',
  surface: '#191527',
  surfaceMuted: '#231E36',
  line: '#2F2946',
  inputBorder: '#7A7095',
  ink: '#F2EFFA',
  inkMuted: '#B5ADCB',
  inkSubtle: '#A198BA',
  primary: '#A78BFA',
  primaryPressed: '#8B6CF0',
  onPrimary: '#1B0B45',
  primarySoft: '#2B2050',
  onPrimarySoft: '#D9CCFE',
  brandDeep: '#1E0F4A',
  brandGradient: ['#1E0F4A', '#3B1C8C'],
  onBrand: '#FFFFFF',
  success: '#4ADE80',
  successSoft: '#12301E',
  warning: '#FBBF24',
  warningSoft: '#3A2B0A',
  danger: '#F87171',
  dangerSoft: '#3D1616',
  scrim: 'rgba(0, 0, 0, 0.65)',
  ripple: 'rgba(167, 139, 250, 0.18)',
  statusBar: 'light-content',
};

// Alto contraste: preto + amarelo (preserva a identidade do modo atual).
// Estados nunca dependem só de cor: sempre há borda, ícone ou texto.
export const highContrast = {
  mode: 'highContrast',
  canvas: '#000000',
  surface: '#000000',
  surfaceMuted: '#141414',
  line: '#FFD700',
  inputBorder: '#FFD700',
  ink: '#FFFFFF',
  inkMuted: '#F2E8A6',
  inkSubtle: '#E0D48A',
  primary: '#FFD700',
  primaryPressed: '#FFC400',
  onPrimary: '#000000',
  primarySoft: '#1A1A1A',
  onPrimarySoft: '#FFD700',
  brandDeep: '#000000',
  brandGradient: ['#000000', '#000000'],
  onBrand: '#FFD700',
  success: '#5DFF8A',
  successSoft: '#1A1A1A',
  warning: '#FFB347',
  warningSoft: '#1A1A1A',
  danger: '#FF6B6B',
  dangerSoft: '#1A1A1A',
  scrim: 'rgba(0, 0, 0, 0.85)',
  ripple: 'rgba(255, 215, 0, 0.25)',
  statusBar: 'light-content',
};

export const palettes = { light, dark, highContrast };
