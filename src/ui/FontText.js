import React, { createContext, forwardRef, useContext } from 'react';
import { StyleSheet, Text as NativeText, TextInput as NativeTextInput } from 'react-native';
import useAccessibility from '../hooks/useAccessibility';
import { AccessibleSurfaceContext, accessibleStyle } from './accessibilityStyles';

export const fontFamilies = {
  regular: 'PlusJakartaSans-Regular',
  medium: 'PlusJakartaSans-Medium',
  semibold: 'PlusJakartaSans-SemiBold',
  bold: 'PlusJakartaSans-Bold',
  extraBold: 'PlusJakartaSans-ExtraBold',
};

const FontContext = createContext(fontFamilies.regular);
const NestedTextContext = createContext(false);
const appFonts = new Set(Object.values(fontFamilies));

function fontForWeight(weight) {
  const numeric = weight === 'bold' ? 700 : Number(weight) || 400;
  if (numeric >= 800) return fontFamilies.extraBold;
  if (numeric >= 700) return fontFamilies.bold;
  if (numeric >= 600) return fontFamilies.semibold;
  if (numeric >= 500) return fontFamilies.medium;
  return fontFamilies.regular;
}

export function fontStyle(style, inheritedFamily = fontFamilies.regular) {
  const flat = StyleSheet.flatten(style) || {};
  // Fontes próprias de ícones ou outros componentes mantêm sua família.
  if (flat.fontFamily && !appFonts.has(flat.fontFamily)) return { ...flat };
  const fontFamily = flat.fontFamily || (flat.fontWeight != null ? fontForWeight(flat.fontWeight) : inheritedFamily);
  // O peso já está no arquivo TTF: evita negrito artificial e fallback do Android.
  return { ...flat, fontFamily, fontWeight: 'normal' };
}

export const FontText = forwardRef(function FontText({ style, children, accessibilityScaleApplied = false, accessibilityColorsApplied = false, ...props }, ref) {
  const inheritedFamily = useContext(FontContext);
  const nested = useContext(NestedTextContext);
  const surface = useContext(AccessibleSurfaceContext);
  const settings = useAccessibility();
  const scale = Number(settings.fontScale) || 1;
  const resolved = fontStyle(accessibilityColorsApplied ? style : accessibleStyle(style, settings, true, surface), inheritedFamily);
  if (!accessibilityScaleApplied) {
    if (typeof resolved.fontSize === 'number') resolved.fontSize *= scale;
    else if (!nested) resolved.fontSize = 14 * scale;
    if (typeof resolved.lineHeight === 'number') resolved.lineHeight *= scale;
  }
  return <FontContext.Provider value={resolved.fontFamily}>
    <NestedTextContext.Provider value={true}>
      <NativeText {...props} ref={ref} style={resolved}>{children}</NativeText>
    </NestedTextContext.Provider>
  </FontContext.Provider>;
});

export const FontTextInput = forwardRef(function FontTextInput({ style, accessibilityScaleApplied = false, accessibilityColorsApplied = false, ...props }, ref) {
  const surface = useContext(AccessibleSurfaceContext);
  const settings = useAccessibility();
  const scale = Number(settings.fontScale) || 1;
  const resolved = fontStyle(accessibilityColorsApplied ? style : accessibleStyle(style, settings, true, surface));
  if (!accessibilityScaleApplied) {
    resolved.fontSize = (resolved.fontSize || 14) * scale;
    if (typeof resolved.lineHeight === 'number') resolved.lineHeight *= scale;
  }
  return <NativeTextInput {...props} ref={ref} style={resolved} onFocus={event => {
    const label = props.accessibilityLabel || props.placeholder;
    if (label && settings.ttsEnabled) settings.speak(label);
    props.onFocus?.(event);
  }} />;
});
