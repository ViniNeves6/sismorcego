import { createContext } from 'react';
import { StyleSheet } from 'react-native';

export const ACCESSIBLE_CANVAS = '#08080C';
export const AccessibleSurfaceContext = createContext(ACCESSIBLE_CANVAS);
export function colorParts(color) {
  if (typeof color !== 'string') return null;
  const named = { white: '#FFFFFF', black: '#000000', transparent: '#00000000' };
  color = named[color] || color;
  if (/^#[\da-f]{3,4}$/i.test(color)) color = '#' + color.slice(1).split('').map(c => c + c).join('');
  if (/^#[\da-f]{6}([\da-f]{2})?$/i.test(color)) return [1, 3, 5].map(i => parseInt(color.slice(i, i + 2), 16)).concat(color.length === 9 ? parseInt(color.slice(7, 9), 16) / 255 : 1);
  const match = color.match(/^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)(?:\s*,\s*([\d.]+))?\s*\)$/i);
  return match ? [Number(match[1]), Number(match[2]), Number(match[3]), match[4] === undefined ? 1 : Number(match[4])] : null;
}
const luminance = color => {
  const rgb = colorParts(color) || [0, 0, 0];
  const values = rgb.slice(0, 3).map(v => v / 255).map(v => v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
  return values[0] * 0.2126 + values[1] * 0.7152 + values[2] * 0.0722;
};
export function contrastRatio(a, b) {
  const first = luminance(a), second = luminance(b);
  return (Math.max(first, second) + 0.05) / (Math.min(first, second) + 0.05);
}
export function contrastColor(color, background = false) {
  const parts = colorParts(color);
  if (!parts || parts[3] === 0) return color;
  const [r, g, b, alpha] = parts;
  if (background) {
    if (alpha < 1) return `rgba(0, 0, 0, ${alpha})`;
    if (r === 255 && g === 215 && b === 0) return '#FFD700';
    return r + g + b > 740 || r + g + b < 60 ? ACCESSIBLE_CANVAS : '#18181F';
  }
  if (Math.max(r, g, b) < 100) return '#FFFFFF';
  if (r > 180 && g > 130 && b < 100) return '#FFD700';
  if (b > r * 1.15 && b > g * 1.15) return '#FFD700';
  if (g > r * 1.4 && g > b * 0.9) return '#6EF0B0';
  if (r > g * 1.4 && r > b * 1.2) return '#FF9DA9';
  return '#FFFFFF';
}
export function foregroundColor(color, background = ACCESSIBLE_CANVAS) {
  const preferred = contrastColor(color || '#181126');
  if (!colorParts(preferred)) return preferred;
  if (contrastRatio(preferred, background) >= 4.5) return preferred;
  return contrastRatio('#000000', background) > contrastRatio('#FFFFFF', background) ? '#000000' : '#FFFFFF';
}
export function surfaceColor(style, inherited = ACCESSIBLE_CANVAS) {
  const color = StyleSheet.flatten(style)?.backgroundColor;
  const parts = colorParts(color);
  if (!parts || parts[3] === 0) return inherited;
  if (parts[3] === 1) return color;
  const base = colorParts(inherited) || [8, 8, 12];
  return '#' + parts.slice(0, 3).map((v, i) => Math.round(v * parts[3] + base[i] * (1 - parts[3])).toString(16).padStart(2, '0')).join('');
}
export function accessibleStyle(style, settings, text = false, inheritedSurface) {
  if (!settings.highContrast) return style;
  const flat = { ...StyleSheet.flatten(style) };
  if (flat.backgroundColor) flat.backgroundColor = contrastColor(flat.backgroundColor, true);
  ['borderColor', 'borderTopColor', 'borderBottomColor', 'borderLeftColor', 'borderRightColor'].forEach(key => {
    if (flat[key]) flat[key] = contrastColor(flat[key]);
  });
  if (text) flat.color = foregroundColor(flat.color, surfaceColor(flat, inheritedSurface));
  return flat;
}
