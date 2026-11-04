import React, { useState } from 'react';
import { StyleSheet, useWindowDimensions } from 'react-native';
import { Animated, View, Text, Pressable } from './AccessibleNative';
import LinearGradient from './AccessibleLinearGradient';
import useAccessibility from '../hooks/useAccessibility';
import useSyncButtonAnimation, { SYNC_DOT_WAVES } from './useSyncButtonAnimation';
import { RefreshSyncIcon } from './SismorcegoIcons';

export default function SyncNowButton({
  onSyncNow,
  syncing = false,
  disabled = false,
  style,
  reduceMotion = false,
}) {
  const { fontScale, highContrast } = useAccessibility();
  const { fontScale: systemFontScale } = useWindowDimensions();
  const [buttonWidth, setButtonWidth] = useState(300);
  const { skipAnimation, handlePress, isSyncingActive, btnScale, pulseScale,
    syncProgress, bounceBgAnim, iconRotate, iconScale, stageAnim, labelFadeAnim,
    stageLayoutAnim, shimmerAnim, waveAnim } = useSyncButtonAnimation({
    onSyncNow, syncing, disabled, reduceMotion,
  });
  const staticLabel = skipAnimation || (fontScale || 1) * (systemFontScale || 1) > 1;
  // Interpolations (All native driver compatible)
  const shimmerTranslateX = shimmerAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [-buttonWidth * 1.2, buttonWidth * 1.2],
  });

  const textOpacity = labelFadeAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 0],
  });

  const textTranslateY = stageAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -12],
  });

  const textScale = stageAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 0.9],
  });

  const dotsOpacity = labelFadeAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 1],
  });

  const dotsTranslateY = stageAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [12, 0],
  });

  const dotsScale = stageAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.75, 1],
  });

  // 3 dots translateY & opacity
  const [dotAnim0, dotAnim1, dotAnim2] = SYNC_DOT_WAVES.map(wave => waveAnim.interpolate(wave));
  const dot0Y = dotAnim0.interpolate({ inputRange: [0, 1], outputRange: [0, -4] });
  const dot0Op = dotAnim0.interpolate({ inputRange: [0, 1], outputRange: [0.35, 1] });

  const dot1Y = dotAnim1.interpolate({ inputRange: [0, 1], outputRange: [0, -4] });
  const dot1Op = dotAnim1.interpolate({ inputRange: [0, 1], outputRange: [0.35, 1] });

  const dot2Y = dotAnim2.interpolate({ inputRange: [0, 1], outputRange: [0, -4] });
  const dot2Op = dotAnim2.interpolate({ inputRange: [0, 1], outputRange: [0.35, 1] });

  // A centered flex row keeps the label center fixed as its width contracts.
  // Move only the icon to reproduce that geometry on the native animation driver.
  const stageWidth = 180;
  const iconTranslateX = stageLayoutAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, (stageWidth - 28) / 2],
  });

  return (
    <View style={[styles.wrapper, style]}>
      {/* 4px Outer Glow Halo Ring (box-shadow: 0 0 0 4px rgba(255, 255, 255, 0.12)) */}
      {!skipAnimation && (
        <Animated.View
          pointerEvents="none"
          style={[
            styles.haloRing,
            {
              opacity: syncProgress,
            },
          ]}
        />
      )}

      {/* Main Animated Button Container */}
      <Animated.View
        style={[
          styles.btnContainer,
          {
            transform: [{ scale: skipAnimation ? 1 : Animated.multiply(btnScale, pulseScale) }],
          },
        ]}
      >
        <Pressable
          onPress={handlePress}
          disabled={isSyncingActive || disabled}
          onLayout={(e) => {
            const w = e.nativeEvent.layout.width;
            if (w > 0) setButtonWidth(w);
          }}
          accessibilityRole="button"
          accessibilityState={{ disabled: isSyncingActive || disabled, busy: isSyncingActive }}
          accessibilityLabel={isSyncingActive ? 'Sincronizando registros' : 'Sincronizar agora'}
          style={[styles.pressable, highContrast && { borderWidth: 1.5, borderColor: '#FFD700', borderRadius: 15 }]}
        >
          {/* Base Background: rgba(255, 255, 255, 0.14) */}
          <View style={styles.baseBackground} />

          {/* Syncing Background: rgba(255, 255, 255, 0.22) */}
          {!skipAnimation && (
            <Animated.View
              style={[
                styles.syncBackground,
                {
                  opacity: syncProgress,
                },
              ]}
            />
          )}

          {/* Finish Bounce Background Highlight: rgba(255, 255, 255, 0.28) */}
          {!skipAnimation && (
            <Animated.View
              style={[
                styles.bounceBackground,
                {
                  opacity: bounceBgAnim,
                },
              ]}
            />
          )}

          {/* Base Border: 1.5px solid rgba(255, 255, 255, 0.48) */}
          <View style={styles.baseBorder} pointerEvents="none" />

          {/* Syncing Border: 1.5px solid rgba(255, 255, 255, 0.85) */}
          {!skipAnimation && (
            <Animated.View
              style={[
                styles.syncBorder,
                {
                  opacity: syncProgress,
                },
              ]}
              pointerEvents="none"
            />
          )}

          {/* Shimmer sweep effect */}
          {!skipAnimation && (
            <Animated.View
              pointerEvents="none"
              style={[
                styles.shimmerTrack,
                {
                  width: buttonWidth,
                  opacity: syncProgress,
                  transform: [{ translateX: shimmerTranslateX }],
                },
              ]}
            >
              <LinearGradient
                colors={['transparent', 'rgba(255, 255, 255, 0.22)', 'transparent']}
                start={{ x: 0, y: 0.2 }}
                end={{ x: 1, y: 0.8 }}
                style={StyleSheet.absoluteFill}
              />
            </Animated.View>
          )}

          {/* Content: Icon + Label Stage */}
          <View style={styles.contentRow} pointerEvents="none">
            {/* SVG Icon with 2.2s wind-up spin */}
            <Animated.View
              testID="sync-button-icon"
              style={[
                styles.iconWrap,
                !staticLabel && {
                  transform: [{ translateX: iconTranslateX }, { rotate: iconRotate }, { scale: iconScale }],
                },
              ]}
            >
              <RefreshSyncIcon size={21} color="#FFFFFF" strokeWidth={2.3} />
            </Animated.View>

            {/* Label Stage */}
            {staticLabel ? (
              <View style={styles.accessibleLabelStage}>
                <Text style={styles.labelText}>
                  {isSyncingActive ? 'Sincronizando...' : 'Sincronizar agora'}
                </Text>
              </View>
            ) : (
              <View testID="sync-button-label-stage" style={[styles.labelStage, { width: stageWidth }]}>
                {/* Text: "Sincronizar agora" */}
                <Animated.View
                  testID="sync-button-text"
                  style={[
                    styles.labelAbsolute,
                    {
                      opacity: textOpacity,
                      transform: [
                        { translateY: textTranslateY },
                        { scale: textScale },
                      ],
                    },
                  ]}
                >
                  <Text style={styles.labelText} numberOfLines={1}>
                    Sincronizar agora
                  </Text>
                </Animated.View>

                {/* Dots: " . . . " with smoothWave */}
                <Animated.View
                  testID="sync-button-dots"
                  style={[
                    styles.labelAbsolute,
                    styles.dotsRow,
                    {
                      opacity: dotsOpacity,
                      transform: [
                        { translateY: dotsTranslateY },
                        { scale: dotsScale },
                      ],
                    },
                  ]}
                  aria-hidden={true}
                >
                  <Animated.View
                    style={[
                      styles.dotItem,
                      {
                        opacity: dot0Op,
                        transform: [{ translateY: dot0Y }],
                      },
                    ]}
                  >
                    <Text style={styles.dotChar}>.</Text>
                  </Animated.View>
                  <Animated.View
                    style={[
                      styles.dotItem,
                      {
                        opacity: dot1Op,
                        transform: [{ translateY: dot1Y }],
                      },
                    ]}
                  >
                    <Text style={styles.dotChar}>.</Text>
                  </Animated.View>
                  <Animated.View
                    style={[
                      styles.dotItem,
                      {
                        opacity: dot2Op,
                        transform: [{ translateY: dot2Y }],
                      },
                    ]}
                  >
                    <Text style={styles.dotChar}>.</Text>
                  </Animated.View>
                </Animated.View>
              </View>
            )}
          </View>
        </Pressable>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    width: '100%',
    position: 'relative',
  },
  haloRing: {
    position: 'absolute',
    top: -4,
    left: -4,
    right: -4,
    bottom: -4,
    borderRadius: 19,
    borderWidth: 4,
    borderColor: 'rgba(255, 255, 255, 0.12)',
  },
  btnContainer: {
    width: '100%',
    minHeight: 50,
    borderRadius: 15,
    overflow: 'hidden',
  },
  pressable: {
    width: '100%',
    minHeight: 50,
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 18,
    paddingVertical: 13,
  },
  baseBackground: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255, 255, 255, 0.14)',
    borderRadius: 15,
  },
  syncBackground: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255, 255, 255, 0.22)',
    borderRadius: 15,
  },
  bounceBackground: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255, 255, 255, 0.28)',
    borderRadius: 15,
  },
  baseBorder: {
    ...StyleSheet.absoluteFillObject,
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.48)',
    borderRadius: 15,
  },
  syncBorder: {
    ...StyleSheet.absoluteFillObject,
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.85)',
    borderRadius: 15,
  },
  shimmerTrack: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
  },
  contentRow: {
    flexShrink: 1,
    maxWidth: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  iconWrap: {
    width: 21,
    height: 21,
    alignItems: 'center',
    justifyContent: 'center',
  },
  labelStage: {
    position: 'relative',
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  accessibleLabelStage: {
    flexShrink: 1,
    minWidth: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  labelAbsolute: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
    left: 0,
    right: 0,
  },
  labelText: {
    fontSize: 15.5,
    fontFamily: 'PlusJakartaSans-Bold',
    fontWeight: '600',
    color: '#FFFFFF',
    textAlign: 'center',
    includeFontPadding: false,
    letterSpacing: -0.2,
  },
  dotsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
  },
  dotItem: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  dotChar: {
    fontSize: 20,
    fontWeight: '800',
    color: '#FFFFFF',
    lineHeight: 20,
    marginTop: -6,
    includeFontPadding: false,
  },
});
