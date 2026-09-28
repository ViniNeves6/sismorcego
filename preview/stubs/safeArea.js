import React, { createContext, useContext } from 'react';
import { View } from 'react-native-web';

// Simula um iPhone: barra de status de 47px e área de gesto de 24px.
const INSETS = { top: 47, bottom: 24, left: 0, right: 0 };
const FRAME = { x: 0, y: 0, width: 390, height: 844 };

export const initialWindowMetrics = { insets: INSETS, frame: FRAME };
export const SafeAreaInsetsContext = createContext(INSETS);
export const SafeAreaFrameContext = createContext(FRAME);

export const SafeAreaProvider = ({ children, style }) => (
  <SafeAreaFrameContext.Provider value={FRAME}>
    <SafeAreaInsetsContext.Provider value={INSETS}>
      <View style={[{ flex: 1 }, style]}>{children}</View>
    </SafeAreaInsetsContext.Provider>
  </SafeAreaFrameContext.Provider>
);
export const SafeAreaConsumer = SafeAreaInsetsContext.Consumer;
export const useSafeAreaInsets = () => useContext(SafeAreaInsetsContext);
export const useSafeAreaFrame = () => useContext(SafeAreaFrameContext);

export function SafeAreaView({ edges = ['top', 'right', 'bottom', 'left'], style, ...rest }) {
  const pad = {};
  if (edges.includes('top')) pad.paddingTop = INSETS.top;
  if (edges.includes('bottom')) pad.paddingBottom = INSETS.bottom;
  return <View {...rest} style={[style, pad]} />;
}
