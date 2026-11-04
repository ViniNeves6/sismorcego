import { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, Easing } from 'react-native';
import useReduceMotion from './useReduceMotion';

const LABEL_EASE = Easing.bezier(0.22, 1, 0.36, 1);
const SPRING_EASE = Easing.bezier(0.34, 1.56, 0.64, 1);

function keyframes(stops, easing) {
  const inputRange = [], outputRange = [];
  stops.slice(0, -1).forEach(([time, value], index) => {
    const [nextTime, nextValue] = stops[index + 1];
    for (let step = 0; step < 16; step += 1) {
      const fraction = step / 16;
      inputRange.push(time + (nextTime - time) * fraction);
      outputRange.push(value + (nextValue - value) * easing(fraction));
    }
  });
  inputRange.push(1);
  outputRange.push(stops.at(-1)[1]);
  return { inputRange, outputRange, extrapolate: 'clamp' };
}

const PRESS_SCALE = keyframes([[0, 1], [90 / 440, 0.95], [1, 1]], SPRING_EASE);
const FINISH_SCALE = keyframes([[0, 0.97], [0.55, 1.025], [1, 1]], SPRING_EASE);
const FINISH_GLOW = keyframes([[0, 0], [0.55, 1], [1, 0]], Easing.inOut(Easing.ease));
const SPIN_EASE = Easing.bezier(0.45, 0.05, 0.25, 1);
const spinRotation = keyframes([[0, 0], [0.12, -18], [0.55, 190], [1, 360]], SPIN_EASE);
const SPIN_ROTATION = { ...spinRotation, outputRange: spinRotation.outputRange.map(degrees => `${degrees}deg`) };
const SPIN_SCALE = keyframes([[0, 1], [0.12, 0.94], [0.55, 1.04], [1, 1]], SPIN_EASE);
const waveEase = Easing.inOut(Easing.ease);
export const SYNC_DOT_WAVES = [0, 180, 360].map(delay => {
  const inputRange = Array.from({ length: 65 }, (_, index) => index / 64);
  const outputRange = inputRange.map(time => {
    const phase = ((time - delay / 1100) % 1 + 1) % 1;
    return phase < 0.5 ? waveEase(phase * 2) : 1 - waveEase((phase - 0.5) * 2);
  });
  return { inputRange, outputRange };
});

// Encode the HTML's 90 ms lead-in in native frames, rather than a JS timer or
// an animation completion callback that could arrive after data processing.
function timing(value, toValue, duration, lead = 0, easing = LABEL_EASE) {
  const total = duration + lead;
  return Animated.timing(value, {
    toValue, duration: total,
    easing: lead ? time => easing(Math.max(0, (time * total - lead) / duration)) : easing,
    useNativeDriver: true, isInteraction: false,
  });
}

export default function useSyncButtonAnimation({ onSyncNow, syncing, disabled, reduceMotion }) {
  const systemReduceMotion = useReduceMotion();
  const skipAnimation = Boolean(reduceMotion || systemReduceMotion);
  const [isVisualSyncing, setIsVisualSyncing] = useState(false);
  const motion = useRef({
    press: new Animated.Value(0), finish: new Animated.Value(1),
    stage: new Animated.Value(0), labelFade: new Animated.Value(0),
    layout: new Animated.Value(0), background: new Animated.Value(0),
    spin: new Animated.Value(0), shimmer: new Animated.Value(0), wave: new Animated.Value(0),
  }).current;
  const mounted = useRef(true);
  const cycleRef = useRef(null);
  const activeAnimations = useRef(new Set());
  const latest = useRef({ syncing, skipAnimation });
  latest.current = { syncing, skipAnimation };

  const stopAll = useCallback(() => {
    const animations = [...activeAnimations.current];
    activeAnimations.current.clear();
    animations.forEach(animation => animation.stop());
  }, []);
  const play = useCallback((animation, onComplete) => {
    activeAnimations.current.add(animation);
    animation.start(result => {
      const active = activeAnimations.current.delete(animation);
      if (active && result?.finished && mounted.current) onComplete?.();
    });
  }, []);
  const reset = useCallback(() => {
    Object.entries(motion).forEach(([name, value]) => value.setValue(name === 'finish' ? 1 : 0));
  }, [motion]);
  const endCycle = useCallback(cycle => {
    if (!mounted.current || cycleRef.current !== cycle) return;
    cycleRef.current = null;
    stopAll();
    reset();
    setIsVisualSyncing(false);
  }, [reset, stopAll]);
  const transitionLabel = useCallback((toValue, lead = 0) => {
    play(Animated.parallel([
      timing(motion.stage, toValue, 360, lead),
      timing(motion.labelFade, toValue, 280, lead, Easing.ease),
      timing(motion.layout, toValue, 380, lead),
      timing(motion.background, toValue, 300, lead, Easing.ease),
    ]));
  }, [motion, play]);
  const finishCycle = useCallback(cycle => {
    if (cycleRef.current !== cycle) return;
    cycle.phase = 'finishing';
    transitionLabel(0);
    motion.finish.setValue(0);
    play(timing(motion.finish, 1, 450, 0, Easing.linear), () => endCycle(cycle));
  }, [endCycle, motion, play, transitionLabel]);
  const startVisual = useCallback((cycle, lead = 0) => {
    cycleRef.current = cycle;
    cycle.phase = 'busy';
    stopAll();
    setIsVisualSyncing(true);
    motion.press.setValue(0);
    motion.finish.setValue(1);
    motion.shimmer.setValue(0);
    motion.wave.setValue(0);
    transitionLabel(1, lead);
    if (lead) play(timing(motion.press, 1, 440, 0, Easing.linear));
    play(Animated.loop(timing(motion.shimmer, 1, 1600, 0, Easing.inOut(Easing.ease))));
    play(Animated.loop(timing(motion.wave, 1, 1100, 0, Easing.linear)));
    const spin = (spinLead = 0) => {
      motion.spin.setValue(0);
      play(timing(motion.spin, 1, 2200, spinLead, Easing.linear), () => {
        if (cycleRef.current !== cycle) return;
        if (latest.current.syncing || cycle.requestPending) spin();
        else finishCycle(cycle);
      });
    };
    spin(lead);
  }, [finishCycle, motion, play, stopAll, transitionLabel]);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      cycleRef.current = null;
      stopAll();
    };
  }, [stopAll]);

  useEffect(() => {
    let cycle = cycleRef.current;
    if (skipAnimation) {
      stopAll();
      reset();
      if (syncing || cycle?.requestPending) {
        cycle = cycle || { requestPending: false };
        cycle.phase = 'static';
        cycleRef.current = cycle;
        setIsVisualSyncing(true);
      } else if (cycle) endCycle(cycle);
      return;
    }
    if (syncing || cycle?.requestPending) {
      if (!cycle || cycle.phase === 'static' || cycle.phase === 'finishing') {
        startVisual(cycle || { requestPending: false });
      }
    } else if (cycle?.phase === 'static') endCycle(cycle);
  }, [syncing, skipAnimation, endCycle, reset, startVisual, stopAll]);

  const handlePress = useCallback(() => {
    if (cycleRef.current || latest.current.syncing || disabled) return;
    const cycle = { requestPending: true, phase: 'static' };
    cycleRef.current = cycle;
    setIsVisualSyncing(true);
    if (!latest.current.skipAnimation) startVisual(cycle, 90);
    const settle = () => {
      cycle.requestPending = false;
      if (latest.current.skipAnimation && !latest.current.syncing) endCycle(cycle);
    };
    // Queue the complete native choreography before starting network/storage
    // work, while preserving the existing immediate sync callback contract.
    try { Promise.resolve(onSyncNow?.()).then(settle, settle); }
    catch (_) { settle(); }
  }, [disabled, endCycle, onSyncNow, startVisual]);

  return {
    skipAnimation, handlePress, isSyncingActive: Boolean(isVisualSyncing || syncing),
    btnScale: motion.finish.interpolate(FINISH_SCALE),
    pulseScale: motion.press.interpolate(PRESS_SCALE),
    bounceBgAnim: motion.finish.interpolate(FINISH_GLOW),
    stageAnim: motion.stage, labelFadeAnim: motion.labelFade,
    stageLayoutAnim: motion.layout, syncProgress: motion.background,
    iconRotate: motion.spin.interpolate(SPIN_ROTATION), iconScale: motion.spin.interpolate(SPIN_SCALE),
    shimmerAnim: motion.shimmer, waveAnim: motion.wave,
  };
}
