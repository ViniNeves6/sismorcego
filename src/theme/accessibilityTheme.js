export const COLORS = {
black: '#000000',
yellow: '#FFD700',
white: '#FFFFFF',
gray: '#CCCCCC',
bgDark: '#0B0B0B',
bgLight: '#FFFFFF',
border: '#2A2A2A',
};


export const makeNavigationTheme = (highContrast) => ({
dark: highContrast,
colors: {
primary: highContrast ? COLORS.yellow : '#6200ee',
background: highContrast ? COLORS.bgDark : COLORS.bgLight,
card: highContrast ? COLORS.black : '#f8f8f8',
text: highContrast ? COLORS.yellow : '#111111',
border: highContrast ? COLORS.yellow : '#e0e0e0',
notification: highContrast ? COLORS.yellow : '#ff80ab',
},
});