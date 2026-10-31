import { Animated, View } from './AccessibleNative';
import React, { useLayoutEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet } from 'react-native';
import useReduceMotion from './useReduceMotion';
import { screenFadeTiming } from './screenFade';

// Fora do Shell, a tela já está disponível. Dentro dele, componentes pesados
// podem aguardar o término real da entrada, inclusive em visitas rápidas.
import { ScreenTransitionReadyContext } from './ScreenTransitionContext';
export { ScreenTransitionReadyContext } from './ScreenTransitionContext';

export default function AnimatedScreenTransition({
  screenKey,
  children,
  style,
  reduceMotion = false,
}) {
  const systemReduceMotion = useReduceMotion();
  const skipAnimation = reduceMotion || systemReduceMotion;
  const progress = useRef(new Animated.Value(skipAnimation ? 1 : 0)).current;
  const animRef = useRef(null);
  const transition = useMemo(() => ({ screenKey }), [screenKey]);
  const requestedTransitionRef = useRef(transition);
  requestedTransitionRef.current = transition;
  const [displayedTransition, setDisplayedTransition] = useState(transition);
  const displayedChildrenRef = useRef(children);
  const enteredTransitionRef = useRef(null);
  const [enteredTransition, setEnteredTransition] = useState(null);
  const showingRequestedScreen = displayedTransition === transition;
  const ready = showingRequestedScreen && enteredTransition === transition;

  // Retain the last committed screen until its fade-out finishes. Updates to
  // the current screen still render normally without restarting the fade.
  useLayoutEffect(() => {
    if (showingRequestedScreen) displayedChildrenRef.current = children;
  }, [children, showingRequestedScreen]);

  useLayoutEffect(() => {
    if (skipAnimation) {
      if (animRef.current) {
        animRef.current.stop();
        animRef.current = null;
      }
      progress.setValue(1);
      setDisplayedTransition(transition);
      enteredTransitionRef.current = transition;
      setEnteredTransition(transition);
      return;
    }

    if (showingRequestedScreen && enteredTransitionRef.current === transition) {
      return;
    }

    if (animRef.current) {
      animRef.current.stop();
      animRef.current = null;
    }

    if (showingRequestedScreen) progress.setValue(0);
    const animation = Animated.timing(progress, {
      toValue: showingRequestedScreen ? 1 : 0,
      ...screenFadeTiming(showingRequestedScreen),
    });
    animRef.current = animation;

    animation.start(({ finished }) => {
      if (finished && animRef.current === animation && requestedTransitionRef.current === transition) {
        animRef.current = null;
        if (showingRequestedScreen) {
          progress.setValue(1);
          enteredTransitionRef.current = transition;
          setEnteredTransition(transition);
        } else {
          progress.setValue(0);
          setDisplayedTransition(transition);
        }
      }
    });

    return () => {
      if (animRef.current === animation) {
        animRef.current = null;
        animation.stop();
      }
    };
  }, [showingRequestedScreen, skipAnimation, progress, transition]);

  return (
    <ScreenTransitionReadyContext.Provider value={ready}>
      <View style={[styles.container, style]}>
        <View testID="screen-transition-content" style={styles.content} pointerEvents={ready ? 'auto' : 'none'}>
          {showingRequestedScreen ? children : displayedChildrenRef.current}
        </View>
        {/* Fade an opaque cover, not the card hierarchy. Partial parent alpha
            lets Android elevation shadows show through their own card faces. */}
        {!skipAnimation && !ready && <Animated.View testID="screen-transition-fade" pointerEvents="none"
          accessible={false} importantForAccessibility="no-hide-descendants"
          style={[styles.fade, { opacity: progress.interpolate({ inputRange: [0, 1], outputRange: [1, 0] }) }]} />}
      </View>
    </ScreenTransitionReadyContext.Provider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  content: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  fade: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#FFFFFF',
    zIndex: 1,
    // Elevated card shadows must remain below the opaque fade cover on Android.
    elevation: 1000,
    shadowColor: 'transparent',
  },
});
