// src/ui/useReduceMotion.js
import { useEffect, useState } from 'react';
import { AccessibilityInfo } from 'react-native';
import useAccessibility from '../hooks/useAccessibility';

// Respeita "reduzir movimento" do sistema: animações passam a duração 0.
export default function useReduceMotion() {
  const { reduceMotion: preferredReduceMotion, provided } = useAccessibility();
  const [reduce, setReduce] = useState(false);

  useEffect(() => {
    if (provided) return;
    let active = true;
    AccessibilityInfo.isReduceMotionEnabled().then((v) => active && setReduce(v)).catch(() => {});
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduce);
    return () => {
      active = false;
      sub.remove();
    };
  }, [provided]);

  return reduce || preferredReduceMotion;
}
