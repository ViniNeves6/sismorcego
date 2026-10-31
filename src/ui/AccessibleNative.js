// Primitivas do redesign conectadas às mesmas preferências do tema antigo.
// Mantém as medidas originais com escala 100% e contraste padrão.
import React, { forwardRef, useContext } from 'react';
import * as Native from 'react-native';
import Svg from 'react-native-svg';
import useAccessibility from '../hooks/useAccessibility';
import { FontText, FontTextInput } from './FontText';
import KeyboardScrollView from './KeyboardScrollView';
import { AccessibleSurfaceContext, accessibleStyle, contrastColor, foregroundColor, surfaceColor } from './accessibilityStyles';
export { accessibleStyle, contrastColor } from './accessibilityStyles';

function primitive(Component, isText = false) {
  return forwardRef(function AccessiblePrimitive({ style, contentContainerStyle, placeholderTextColor, children, ...props }, ref) {
    const settings = useAccessibility();
    const inherited = useContext(AccessibleSurfaceContext);
    const map = source => {
      let result = accessibleStyle(source, settings, isText, inherited);
      if ((Component === Native.Pressable || Component === FontTextInput) && settings.fontScale > 1) {
        const flat = Native.StyleSheet.flatten(result);
        if (typeof flat?.height === 'number') result = { ...flat, height: undefined, minHeight: Math.max(flat.height, flat.minHeight || 0) };
      }
      if (Component === Native.Pressable && settings.highContrast) {
        const flat = Native.StyleSheet.flatten(result);
        if (flat?.backgroundColor && flat.backgroundColor !== 'transparent') result = [result, { borderWidth: Math.max(1, flat.borderWidth || 0), borderColor: contrastColor(flat.borderColor || '#6824D6') }];
      }
      return result;
    };
    const mappedStyle = typeof style === 'function'
      ? state => map(style(state)) : map(style);
    const content = state => <AccessibleSurfaceContext.Provider value={surfaceColor(typeof mappedStyle === 'function' ? mappedStyle(state) : mappedStyle, inherited)}>
      {typeof children === 'function' ? children(state) : children}
    </AccessibleSurfaceContext.Provider>;
    return <Component {...props} ref={ref} style={mappedStyle} {...(isText ? { accessibilityColorsApplied: true } : {})}
      {...(Component === Native.Pressable && props.onPress ? { onPress: event => {
        if (settings.ttsEnabled && props.accessibilityLabel) settings.speak(props.accessibilityLabel);
        return props.onPress(event);
      } } : {})}
      {...(contentContainerStyle ? { contentContainerStyle: accessibleStyle(contentContainerStyle, settings) } : {})}
      {...(placeholderTextColor ? { placeholderTextColor: settings.highContrast ? foregroundColor(placeholderTextColor, inherited) : placeholderTextColor } : {})}>
      {isText ? children : Component === Native.Pressable ? content : children === undefined ? undefined : content()}
    </Component>;
  });
}
export const Text = primitive(FontText, true);
export const TextInput = primitive(FontTextInput, true);
export const View = primitive(Native.View);
export const ScrollView = primitive(KeyboardScrollView);
export const Pressable = primitive(Native.Pressable);
export const Animated = { ...Native.Animated,
  View: Native.Animated.createAnimatedComponent(View), ScrollView: Native.Animated.createAnimatedComponent(ScrollView),
};
function colorChildren(children, background) {
  return React.Children.map(children, child => {
    if (!React.isValidElement(child)) return child;
    const props = {};
    if (child.props.fill) props.fill = foregroundColor(child.props.fill, background);
    if (child.props.stroke) props.stroke = foregroundColor(child.props.stroke, background);
    if (child.props.stopColor) props.stopColor = foregroundColor(child.props.stopColor, background);
    if (child.props.children) props.children = colorChildren(child.props.children, background);
    return React.cloneElement(child, props);
  });
}
export function AccessibleSvg({ stroke, fill, children, ...props }) {
  const { highContrast } = useAccessibility();
  const background = useContext(AccessibleSurfaceContext);
  return <Svg {...props} stroke={highContrast && stroke ? foregroundColor(stroke, background) : stroke} fill={highContrast && fill ? foregroundColor(fill, background) : fill}>
    {highContrast ? colorChildren(children, background) : children}
  </Svg>;
}

