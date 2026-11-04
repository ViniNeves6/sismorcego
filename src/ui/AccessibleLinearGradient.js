import React, { forwardRef, useContext } from 'react';
import NativeLinearGradient from 'react-native-linear-gradient';
import useAccessibility from '../hooks/useAccessibility';
import { AccessibleSurfaceContext, accessibleStyle, contrastColor, surfaceColor } from './accessibilityStyles';

export default forwardRef(function AccessibleLinearGradient({ colors, style, children, ...props }, ref) {
  const settings = useAccessibility();
  const inherited = useContext(AccessibleSurfaceContext);
  const mapped = settings.highContrast ? colors.map(color => contrastColor(color, true)) : colors;
  return <NativeLinearGradient {...props} ref={ref} colors={mapped} style={accessibleStyle(style, settings)}>
    <AccessibleSurfaceContext.Provider value={surfaceColor({ backgroundColor: mapped[0] }, inherited)}>{children}</AccessibleSurfaceContext.Provider>
  </NativeLinearGradient>;
});
