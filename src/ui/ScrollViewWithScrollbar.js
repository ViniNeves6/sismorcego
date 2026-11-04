import { Animated, Pressable, View } from './AccessibleNative';
import React, { forwardRef, useRef, useState } from 'react';
import { StyleSheet } from 'react-native';
import useReduceMotion from './useReduceMotion';

const ARROW_HEIGHT = 12;

export default forwardRef(function ScrollViewWithScrollbar(
  {
    children,
    style,
    showScrollbar = true,
    variant = 'form',
    reduceMotion = false,
    onLayout,
    onContentSizeChange,
    onScroll,
    ...props
  },
  forwardedRef,
) {
  const skipMotion = useReduceMotion() || reduceMotion;
  const scrollRef = useRef(null);
  const scrollOffset = useRef(0);
  const scrollY = useRef(new Animated.Value(0)).current;
  const drag = useRef(null);
  const [viewportHeight, setViewportHeight] = useState(0);
  const [contentHeight, setContentHeight] = useState(0);

  const inset = variant === 'inset';
  const maxScroll = Math.max(0, contentHeight - viewportHeight);
  const trackHeight = Math.max(0, viewportHeight - (inset ? 18 : ARROW_HEIGHT * 2));
  const thumbHeight = Math.min(
    trackHeight,
    Math.max(32, (viewportHeight / Math.max(contentHeight, 1)) * trackHeight),
  );
  const thumbTravel = Math.max(0, trackHeight - thumbHeight);
  const canScroll = maxScroll > 1 && thumbTravel > 0;
  const hasScrollbar = showScrollbar && trackHeight > 0 && (inset || canScroll);

  const scrollTo = (offset, animated = false) => {
    scrollRef.current?.scrollTo({
      y: Math.max(0, Math.min(maxScroll, offset)),
      animated,
    });
  };

  const scrollPage = (direction) => {
    scrollTo(
      scrollOffset.current + direction * viewportHeight * 0.75,
      !skipMotion,
    );
  };

  const moveThumb = (pageY) => {
    if (!drag.current || !thumbTravel) return;
    const top = pageY - drag.current.trackTop - drag.current.grabOffset;
    scrollTo((top / thumbTravel) * maxScroll);
  };

  return (
    <View style={[styles.container, style]}>
      <Animated.ScrollView
        {...props}
        ref={(node) => {
          scrollRef.current = node;
          if (typeof forwardedRef === 'function') forwardedRef(node);
          else if (forwardedRef) forwardedRef.current = node;
        }}
        style={[styles.scroll, inset && styles.fillViewport]}
        showsVerticalScrollIndicator={false}
        scrollEventThrottle={16}
        onLayout={(event) => {
          setViewportHeight(event.nativeEvent.layout.height);
          onLayout?.(event);
        }}
        onContentSizeChange={(width, height) => {
          setContentHeight(height);
          onContentSizeChange?.(width, height);
        }}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { y: scrollY } } }],
          {
            useNativeDriver: true,
            listener: (event) => {
              scrollOffset.current = event.nativeEvent.contentOffset.y;
              onScroll?.(event);
            },
          },
        )}
      >
        {children}
      </Animated.ScrollView>

      {hasScrollbar && (
        <View style={[styles.scrollbar, inset && styles.insetScrollbar]}>
          {!inset && <Pressable
            accessibilityRole="button"
            accessibilityLabel="Rolar para cima"
            hitSlop={6}
            style={styles.arrowButton}
            onPress={() => scrollPage(-1)}
          >
            <View style={styles.arrowUp} />
          </Pressable>}
          <View
            style={[styles.track, inset && styles.insetTrack]}
            accessible={canScroll}
            pointerEvents={canScroll ? 'auto' : 'none'}
            accessibilityRole={canScroll ? 'adjustable' : undefined}
            accessibilityLabel={canScroll ? (props.accessibilityLabel ? `Rolagem: ${props.accessibilityLabel}` : 'Rolagem do formulário') : undefined}
            accessibilityActions={canScroll ? [
              { name: 'increment', label: 'Rolar para baixo' },
              { name: 'decrement', label: 'Rolar para cima' },
            ] : []}
            onAccessibilityAction={(event) => {
              scrollPage(event.nativeEvent.actionName === 'increment' ? 1 : -1);
            }}
            onStartShouldSetResponder={() => canScroll}
            onResponderTerminationRequest={() => false}
            onResponderGrant={(event) => {
              const { locationY, pageY } = event.nativeEvent;
              const thumbTop =
                (Math.max(0, Math.min(maxScroll, scrollOffset.current)) /
                  Math.max(1, maxScroll)) * thumbTravel;
              drag.current = {
                trackTop: pageY - locationY,
                grabOffset:
                  locationY >= thumbTop && locationY <= thumbTop + thumbHeight
                    ? locationY - thumbTop
                    : thumbHeight / 2,
              };
              moveThumb(pageY);
            }}
            onResponderMove={(event) => moveThumb(event.nativeEvent.pageY)}
            onResponderRelease={() => { drag.current = null; }}
            onResponderTerminate={() => { drag.current = null; }}
          >
            <Animated.View
              pointerEvents="none"
              style={[
                styles.thumb,
                inset && styles.insetThumb,
                {
                  height: thumbHeight,
                  transform: [{
                    translateY: scrollY.interpolate({
                      inputRange: [0, Math.max(1, maxScroll)],
                      outputRange: [0, thumbTravel],
                      extrapolate: 'clamp',
                    }),
                  }],
                },
              ]}
            />
          </View>
          {!inset && <Pressable
            accessibilityRole="button"
            accessibilityLabel="Rolar para baixo"
            hitSlop={6}
            style={styles.arrowButton}
            onPress={() => scrollPage(1)}
          >
            <View style={[styles.arrowUp, styles.arrowDown]} />
          </Pressable>}
        </View>
      )}
    </View>
  );
});

const styles = StyleSheet.create({
  container: { flexShrink: 1, minHeight: 0 },
  scroll: { flexGrow: 0 },
  fillViewport: { flexGrow: 1, flexShrink: 1, flexBasis: 0, minHeight: 0 },
  scrollbar: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    right: 2,
    width: 8,
    alignItems: 'center',
  },
  insetScrollbar: { top: 9, bottom: 9, right: 5, width: 6 },
  insetTrack: { width: 6, backgroundColor: '#E9DFFA' },
  insetThumb: { backgroundColor: '#C3A5F2' },
  arrowButton: {
    height: ARROW_HEIGHT,
    width: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  arrowUp: {
    width: 0,
    height: 0,
    borderLeftWidth: 3,
    borderRightWidth: 3,
    borderBottomWidth: 4,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderBottomColor: '#7B39E8',
  },
  arrowDown: { transform: [{ rotate: '180deg' }] },
  track: {
    flex: 1,
    width: 7,
    backgroundColor: '#F6F3FF',
    borderRadius: 999,
  },
  thumb: {
    position: 'absolute',
    left: 0,
    right: 0,
    borderRadius: 999,
    backgroundColor: '#7B39E8',
  },
});
