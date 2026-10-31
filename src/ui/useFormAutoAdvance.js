import { useCallback, useLayoutEffect, useRef } from 'react';
import useReduceMotion from './useReduceMotion';

const measure = node => new Promise(resolve => {
  if (!node?.measureInWindow) return resolve(null);
  node.measureInWindow((x, y, width, height) => resolve(width > 0 && height > 0 ? { x, y, width, height } : null));
});

export default function useFormAutoAdvance({
  sessionKey, fieldKeys, scrollRef, blocked = false, bottomClearance = 110, reduceMotion = false,
}) {
  const systemReduceMotion = useReduceMotion();
  const skipMotion = reduceMotion || systemReduceMotion;
  const latest = useRef(null);
  latest.current = { sessionKey, fieldKeys, blocked, bottomClearance, skipMotion };
  const state = useRef({ manual: false, scrollY: 0, contentHeight: 0 });
  const fields = useRef(new Map());
  const fieldCallbacks = useRef(new Map());
  const pending = useRef({ version: 0, timer: null, firstFrame: null, secondFrame: null });

  const cancelAdvance = useCallback(() => {
    const job = pending.current;
    job.version += 1;
    clearTimeout(job.timer);
    if (job.firstFrame !== null) cancelAnimationFrame(job.firstFrame);
    if (job.secondFrame !== null) cancelAnimationFrame(job.secondFrame);
    job.timer = job.firstFrame = job.secondFrame = null;
  }, []);

  // A new visit restores assistance; changes to answers never reset a manual drag.
  useLayoutEffect(() => {
    state.current = { manual: false, scrollY: 0, contentHeight: 0 };
    cancelAdvance();
    return cancelAdvance;
  }, [sessionKey, cancelAdvance]);

  const fieldRef = useCallback(key => {
    if (!fieldCallbacks.current.has(key)) {
      fieldCallbacks.current.set(key, node => {
        if (node) fields.current.set(key, node);
        else fields.current.delete(key);
      });
    }
    return fieldCallbacks.current.get(key);
  }, []);

  const onManualScroll = useCallback(() => {
    state.current.manual = true;
    cancelAdvance();
  }, [cancelAdvance]);

  const requestAdvance = useCallback(fieldKey => {
    cancelAdvance();
    const session = latest.current.sessionKey;
    if (!session || state.current.manual) return;
    const version = pending.current.version;
    const eligible = () => pending.current.version === version &&
      latest.current.sessionKey === session && !state.current.manual && !latest.current.blocked;
    const advance = async () => {
      if (!eligible()) return;
      const keys = latest.current.fieldKeys;
      const index = keys.indexOf(fieldKey);
      if (index < 0) return;
      const nextKey = keys[index + 1] || '__submit';
      const [target, viewport] = await Promise.all([
        measure(fields.current.get(nextKey)), measure(scrollRef.current),
      ]);
      if (!eligible() || !target || !viewport) return;
      const { scrollY, contentHeight } = state.current;
      const remaining = Math.max(0, contentHeight - viewport.height - scrollY);
      const safeBottom = viewport.y + viewport.height - latest.current.bottomClearance;
      const missing = target.y + target.height + 12 - safeBottom;
      // Advance gently, revealing the next label/input fully above the dock.
      // Keep its label below the header and never scroll backwards.
      const delta = Math.min(remaining, Math.max(0, target.y - viewport.y - 16), Math.max(70, missing));
      if (delta > 2) scrollRef.current?.scrollTo({ y: scrollY + delta, animated: !latest.current.skipMotion });
    };
    // The selector exits in 220 ms and dependent fields animate in for 260 ms.
    // Measure after these transitions and two native layout frames.
    pending.current.timer = setTimeout(() => {
      pending.current.firstFrame = requestAnimationFrame(() => {
        pending.current.secondFrame = requestAnimationFrame(advance);
      });
    }, latest.current.skipMotion ? 0 : 280);
  }, [cancelAdvance, scrollRef]);

  return {
    fieldRef,
    requestAdvance,
    cancelAdvance,
    scrollHandlers: {
      onScrollBeginDrag: onManualScroll,
      onScroll: event => { state.current.scrollY = event.nativeEvent.contentOffset.y; },
      onContentSizeChange: (_, height) => { state.current.contentHeight = height; },
      scrollEventThrottle: 16,
    },
  };
}
