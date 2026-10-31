import { useCallback } from 'react';

// Keep native scrolling available to the guide without rerendering the form.
export default function useSpotlightScroll(state, existingRef) {
  const ref = useCallback(node => {
    if (existingRef) existingRef.current = node;
    if (state) {
      if (node && state.node !== node) state.offset = 0;
      state.node = node;
    }
  }, [state, existingRef]);
  const onScroll = useCallback(event => {
    if (state) state.offset = event.nativeEvent.contentOffset.y;
  }, [state]);
  const onContentSizeChange = useCallback((width, height) => {
    if (state) state.contentHeight = height;
  }, [state]);
  return { ref, onScroll, onContentSizeChange, scrollEventThrottle: 16 };
}
