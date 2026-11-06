import React from 'react';
import { Platform, requireNativeComponent, StyleSheet, UIManager, View } from 'react-native';

const NativeDock = Platform.OS === 'android' && UIManager.getViewManagerConfig?.('SismorcegoKeyboardDock')
  ? requireNativeComponent('SismorcegoKeyboardDock') : null;
// Keep the tree, refs and layout mounted. Android additionally suppresses
// drawing on the UI thread until the real IME transition/geometry has settled.
export default function KeyboardDock({ hidden, children, style, ...props }) {
  const Component = NativeDock || View;
  return <Component {...props} style={NativeDock ? style : [style, hidden && styles.hidden]}
    pointerEvents={hidden ? 'none' : 'box-none'} accessibilityElementsHidden={hidden}
    importantForAccessibility={hidden ? 'no-hide-descendants' : 'auto'}>
    {children}
  </Component>;
}
const styles = StyleSheet.create({ hidden: { opacity: 0 } });
