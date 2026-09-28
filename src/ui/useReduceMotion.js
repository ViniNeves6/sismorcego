// src/ui/useReduceMotion.js
import { useEffect, useState } from 'react';
import { AccessibilityInfo } from 'react-native';

// Respeita "reduzir movimento" do sistema: animações passam a duração 0.
export default function useReduceMotion() {
  const [reduce, setReduce] = useState(false);

  useEffect(() => {
    let active = true;
    AccessibilityInfo.isReduceMotionEnabled().then((v) => active && setReduce(v));
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduce);
    return () => {
      active = false;
      sub.remove();
    };
  }, []);

  return reduce;
}
