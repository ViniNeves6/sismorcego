import { useEffect, useRef, useState } from 'react';
import { Easing } from 'react-native';
import { Animated } from '../../ui/AccessibleNative';
import useReduceMotion from '../../ui/useReduceMotion';

export const TREND_LAYOUT = {
  svgWidth: 320, svgHeight: 112, padX: 20, padTop: 17, padBottom: 17, baseline: 104,
};
const geometry = data => {
  const { svgHeight, padTop, padBottom } = TREND_LAYOUT;
  return data.values.map(value => svgHeight - padBottom - value / data.max * (svgHeight - padTop - padBottom));
};
const interpolate = (from, to, progress) => to.map((value, i) => from[i] + (value - from[i]) * progress);
const keyFor = data => JSON.stringify([data.periodTitle, data.buckets.map(bucket => bucket.key), data.values]);

export default function useAnimatedTrend(target, reduceMotion = false) {
  const systemReduceMotion = useReduceMotion();
  const skipMotion = reduceMotion || systemReduceMotion;
  const [data, setData] = useState(target);
  const [frame, setFrame] = useState(() => ({ ys: geometry(target), values: target.values }));
  const progress = useRef(new Animated.Value(1)).current;
  const morph = useRef(new Animated.Value(1)).current;
  const targetRef = useRef(target);
  targetRef.current = target;
  const shownKey = useRef(keyFor(target));
  const currentFrame = useRef(frame);
  const hasTransitioned = useRef(false);
  const targetKey = keyFor(target);

  useEffect(() => {
    const next = targetRef.current;
    const finalFrame = { ys: geometry(next), values: next.values };
    const update = value => { currentFrame.current = value; setFrame(value); };
    if (skipMotion) {
      shownKey.current = targetKey;
      setData(next);
      update(finalFrame);
      progress.setValue(1);
      return;
    }
    // A primeira exibição usa a entrada da tela; animações seguintes são locais ao gráfico.
    if (!hasTransitioned.current && shownKey.current === targetKey) return;
    hasTransitioned.current = true;
    let cancelled = false;
    let exitAnimation, entryAnimation, curveAnimation, listener;
    const enter = () => {
      if (cancelled) return;
      const from = currentFrame.current;
      shownKey.current = targetKey;
      setData(next);
      morph.setValue(0);
      listener = morph.addListener(({ value }) => {
        if (!cancelled) update({ ys: interpolate(from.ys, finalFrame.ys, value), values: interpolate(from.values, finalFrame.values, value) });
      });
      // Mesmo movimento cúbico de 720 ms do HTML, incluindo os contadores.
      curveAnimation = Animated.timing(morph, {
        toValue: 1, duration: 720, easing: Easing.out(Easing.cubic), useNativeDriver: false,
      });
      entryAnimation = Animated.timing(progress, {
        toValue: 1, duration: 740, easing: Easing.linear, useNativeDriver: true,
      });
      curveAnimation.start(({ finished }) => { if (finished && !cancelled) update(finalFrame); });
      entryAnimation.start();
    };
    if (shownKey.current === targetKey) enter();
    else {
      // Resumo e datas anteriores ficam montados até sua saída terminar.
      exitAnimation = Animated.timing(progress, {
        toValue: 0, duration: 120, easing: Easing.in(Easing.cubic), useNativeDriver: true,
      });
      exitAnimation.start(({ finished }) => { if (finished) enter(); });
    }
    return () => {
      cancelled = true;
      exitAnimation?.stop(); entryAnimation?.stop(); curveAnimation?.stop();
      if (listener != null) morph.removeListener(listener);
    };
  }, [targetKey, skipMotion, progress, morph]);

  return { data, ...frame, progress };
}
