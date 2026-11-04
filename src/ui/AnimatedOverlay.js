import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Easing } from 'react-native';
import { Animated } from './AccessibleNative';
import useReduceMotion from './useReduceMotion';
import useFadeCompositing from './useFadeCompositing';

export default function AnimatedOverlay({ visible, children, style, reduceMotion }) {
  const systemReduceMotion = useReduceMotion();
  const skip = reduceMotion || systemReduceMotion;
  const [rendered, setRendered] = useState(visible);
  const progress = useRef(new Animated.Value(0)).current;
  const compositing = useFadeCompositing(progress, visible ? 1 : 0, skip);
  const lastVisibleChildren = useRef(children);
  useLayoutEffect(() => {
    if (visible) {
      lastVisibleChildren.current = children;
      setRendered(true);
    }
  }, [visible, children]);
  useEffect(() => {
    if (!rendered) return;
    if (skip) {
      progress.setValue(visible ? 1 : 0);
      if (!visible) setRendered(false);
      return;
    }
    let cancelled = false;
    const animation = Animated.timing(progress, { toValue: visible ? 1 : 0, duration: visible ? 220 : 180,
      easing: Easing.out(Easing.cubic), useNativeDriver: true });
    animation.start(({ finished }) => { if (finished && !cancelled && !visible) setRendered(false); });
    return () => { cancelled = true; animation.stop(); };
  }, [visible, rendered, skip, progress]);
  if (!rendered) return null;
  return <Animated.View {...compositing} style={[style, { opacity: progress }]}
    pointerEvents={visible ? 'auto' : 'none'} accessibilityViewIsModal
    accessibilityElementsHidden={!visible} importantForAccessibility={visible ? 'auto' : 'no-hide-descendants'}>
    {visible ? children : lastVisibleChildren.current}
  </Animated.View>;
}
