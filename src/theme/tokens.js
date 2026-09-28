// src/theme/tokens.js
// Tokens independentes de tema (espaçamento, forma, tipografia, movimento).
// Cores ficam em palettes.js.

// Ritmo de 4pt
export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  xxxl: 48,
};

export const radius = {
  sm: 8,
  md: 12, // controles: botão, campo
  lg: 16, // cartões e grupos
  xl: 28, // folha da tela de entrada
  pill: 999,
};

export const iconSize = {
  sm: 18,
  md: 22,
  lg: 28,
};

// Alvo mínimo de toque (iOS 44pt / Android 48dp)
export const touchTarget = 48;

// Tipografia: fonte do sistema, escala fixa.
// lineHeight ≥ 1.4 × fontSize no corpo para leitura confortável.
export const typography = {
  display: { fontSize: 30, lineHeight: 36, fontWeight: '700', letterSpacing: -0.5 },
  title: { fontSize: 22, lineHeight: 28, fontWeight: '700', letterSpacing: -0.3 },
  heading: { fontSize: 17, lineHeight: 24, fontWeight: '600' },
  body: { fontSize: 16, lineHeight: 24, fontWeight: '400' },
  bodyStrong: { fontSize: 16, lineHeight: 24, fontWeight: '600' },
  label: { fontSize: 14, lineHeight: 20, fontWeight: '600' },
  caption: { fontSize: 13, lineHeight: 18, fontWeight: '400' },
  button: { fontSize: 16, lineHeight: 20, fontWeight: '600' },
};

// Durações (ms). Saída é mais rápida que entrada.
export const motion = {
  press: 100,
  enter: 240,
  exit: 160,
};

// Sombra só onde há elevação real (toast, folha). Cartões usam borda.
export const shadow = {
  raised: {
    shadowColor: '#1C1730',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.16,
    shadowRadius: 20,
    elevation: 8,
  },
};
