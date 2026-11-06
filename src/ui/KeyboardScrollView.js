import React, { forwardRef, useCallback, useEffect, useRef } from 'react';
import { Keyboard, ScrollView, TextInput } from 'react-native';
import useReduceMotion from './useReduceMotion';
import useKeyboardState from '../hooks/useKeyboardState';

const measure = node => new Promise(resolve => {
  if (!node?.measureInWindow) { resolve(null); return; }
  node.measureInWindow((x, y, width, height) => resolve(width > 0 && height > 0 ? { x, y, width, height } : null));
});

export default forwardRef(function KeyboardScrollView({ onFocus, onBlur, onLayout, onScroll, onScrollBeginDrag, onContentSizeChange, ...props }, forwardedRef) {
  const scrollRef = useRef(null);
  const focusedRef = useRef(null);
  const offsetRef = useRef(0);
  const manual = useRef(false);
  const keyboardTop = useRef(Keyboard.metrics?.()?.screenY ?? null);
  const job = useRef({ version: 0, first: null, second: null });
  const reduceMotion = useReduceMotion();
  const keyboard = useKeyboardState();
  const nativeTransition = useRef(false);
  nativeTransition.current = keyboard.native && keyboard.transitioning;
  const skipMotion = useRef(reduceMotion);
  skipMotion.current = reduceMotion;

  const cancel = useCallback(() => {
    job.current.version += 1;
    if (job.current.first !== null) cancelAnimationFrame(job.current.first);
    if (job.current.second !== null) cancelAnimationFrame(job.current.second);
    job.current.first = job.current.second = null;
  }, []);

  const reveal = useCallback(() => {
    cancel();
    if (nativeTransition.current || keyboardTop.current === null || !focusedRef.current || manual.current) return;
    const version = job.current.version;
    // Measure after the keyboard avoidance and native scroll viewport have resized.
    job.current.first = requestAnimationFrame(() => {
      job.current.second = requestAnimationFrame(async () => {
        const focused = focusedRef.current;
        if (!focused || TextInput.State.currentlyFocusedInput() !== focused) return;
        const viewportNode = scrollRef.current?.getNativeScrollRef?.() || scrollRef.current;
        const [field, viewport] = await Promise.all([measure(focused), measure(viewportNode)]);
        if (version !== job.current.version || !field || !viewport || keyboardTop.current === null ||
          manual.current || TextInput.State.currentlyFocusedInput() !== focused) return;
        const bottom = Math.min(viewport.y + viewport.height, keyboardTop.current) - 16;
        const top = viewport.y + 12;
        const delta = field.height > bottom - top ? field.y - top
          : field.y < top ? field.y - top : Math.max(0, field.y + field.height - bottom);
        if (Math.abs(delta) > 1) scrollRef.current?.scrollTo({ y: Math.max(0, offsetRef.current + delta), animated: !skipMotion.current });
      });
    });
  }, [cancel]);

  useEffect(() => {
    const show = Keyboard.addListener('keyboardDidShow', event => {
      keyboardTop.current = event.endCoordinates.screenY;
      reveal();
    });
    const hide = Keyboard.addListener('keyboardDidHide', () => { keyboardTop.current = null; cancel(); });
    return () => { show.remove(); hide.remove(); cancel(); };
  }, [cancel, reveal]);
  useEffect(() => {
    if (!keyboard.native) return;
    if (!keyboard.visible) { keyboardTop.current = null; cancel(); return; }
    keyboardTop.current = keyboard.keyboardTop;
    if (!keyboard.transitioning) reveal();
  }, [keyboard, cancel, reveal]);

  return <ScrollView {...props}
    ref={node => {
      scrollRef.current = node;
      if (typeof forwardedRef === 'function') forwardedRef(node);
      else if (forwardedRef) forwardedRef.current = node;
    }}
    scrollEventThrottle={props.scrollEventThrottle ?? 16}
    onFocus={event => {
      manual.current = false;
      focusedRef.current = TextInput.State.currentlyFocusedInput();
      onFocus?.(event);
      reveal();
    }}
    onBlur={event => { focusedRef.current = null; cancel(); onBlur?.(event); }}
    onLayout={event => { onLayout?.(event); reveal(); }}
    onScroll={event => { offsetRef.current = event.nativeEvent.contentOffset.y; onScroll?.(event); }}
    onScrollBeginDrag={event => { manual.current = true; cancel(); onScrollBeginDrag?.(event); }}
    onContentSizeChange={(width, height) => { onContentSizeChange?.(width, height); reveal(); }}
  />;
});
