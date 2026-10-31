import { Animated, View } from './AccessibleNative';
import React, { useEffect, useRef, useState } from 'react';
import { Easing, StyleSheet } from 'react-native';
import useReduceMotion from './useReduceMotion';

export default function AnimatedField({
  visible,
  children,
  reduceMotion = false,
  parentGap = 0,
  onLayout,
}) {
  const systemReduceMotion = useReduceMotion();
  const skipAnimation = reduceMotion || systemReduceMotion;
  const progress = useRef(new Animated.Value(visible ? 1 : 0)).current;
  const [rendered, setRendered] = useState(visible);
  const [contentHeight, setContentHeight] = useState(0);
  const lastChildren = useRef(children);

  // Mantém a resposta visível durante a saída, mesmo após limpar o campo oculto.
  useEffect(() => {
    if (visible) lastChildren.current = children;
  }, [visible, children]);

  useEffect(() => {
    if (visible && !rendered) {
      setRendered(true);
      return;
    }
    if (!rendered) return;

    if (skipAnimation) {
      progress.setValue(visible ? 1 : 0);
      if (!visible) setRendered(false);
      return;
    }
    if (visible && !contentHeight) return;

    const animation = Animated.timing(progress, {
      toValue: visible ? 1 : 0,
      duration: visible ? 260 : 220,
      easing: Easing.bezier(0.22, 0.82, 0.25, 1),
      useNativeDriver: false,
    });
    animation.start(({ finished }) => {
      if (finished && !visible) setRendered(false);
    });
    return () => animation.stop();
  }, [visible, rendered, contentHeight, skipAnimation, progress]);

  if (skipAnimation) {
    return visible ? <View onLayout={onLayout}>{children}</View> : null;
  }
  if (!rendered) return null;

  return (
    <Animated.View
      onLayout={onLayout}
      pointerEvents={visible ? 'auto' : 'none'}
      accessibilityElementsHidden={!visible}
      importantForAccessibility={visible ? 'auto' : 'no-hide-descendants'}
      style={[
        styles.container,
        {
          height: progress.interpolate({
            inputRange: [0, 1],
            outputRange: [0, contentHeight],
          }),
          opacity: progress,
          // Compensa o gap do grupo para que o espaço também entre e saia suavemente.
          marginTop: progress.interpolate({
            inputRange: [0, 1],
            outputRange: [-parentGap, 0],
          }),
          transform: [
            {
              translateY: progress.interpolate({
                inputRange: [0, 1],
                outputRange: [-6, 0],
              }),
            },
          ],
        },
      ]}
    >
      <View
        collapsable={false}
        style={styles.content}
        onLayout={(event) => setContentHeight(event.nativeEvent.layout.height)}
      >
        {visible ? children : lastChildren.current}
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    overflow: 'hidden',
  },
  content: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
  },
});
