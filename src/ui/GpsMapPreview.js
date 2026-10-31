import { Animated, Pressable, Text, View, AccessibleSvg as Svg } from './AccessibleNative';
import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Easing, Linking, StyleSheet } from 'react-native';
import { Path } from 'react-native-svg';
import MapView, { Marker } from 'react-native-maps';
import { isValidGpsCoordinates } from '../services/gpsCoordinates';
import useReduceMotion from './useReduceMotion';

const MAP_HEIGHT = 166;

export default function GpsMapPreview({
  visible,
  lat,
  lng,
  reduceMotion = false,
}) {
  const systemReduceMotion = useReduceMotion();
  const skipMotion = reduceMotion || systemReduceMotion;
  const show = visible && isValidGpsCoordinates(lat, lng);
  const anim = useRef(new Animated.Value(0)).current;
  const [layoutReady, setLayoutReady] = useState(false);
  const [mapReady, setMapReady] = useState(false);
  const [cachedCoords, setCachedCoords] = useState(() =>
    show
      ? { lat, lng }
      : null,
  );

  useLayoutEffect(() => {
    if (show) {
      setCachedCoords(previous => previous?.lat === lat && previous?.lng === lng ? previous : { lat, lng });
    }
  }, [show, lat, lng]);

  const rendered = Boolean(cachedCoords);

  useEffect(() => {
    if (!rendered) return;
    const finishExit = () => {
      setCachedCoords(null);
      setLayoutReady(false);
      setMapReady(false);
    };
    if (skipMotion) {
      anim.setValue(show ? 1 : 0);
      if (!show) finishExit();
      return;
    }
    const animation = Animated.timing(anim, {
      toValue: show ? 1 : 0,
      duration: show ? 180 : 120,
      easing: Easing.bezier(0.22, 0.82, 0.25, 1),
      useNativeDriver: false,
    });
    animation.start(({ finished }) => { if (finished && !show) finishExit(); });
    return () => animation.stop();
  }, [show, rendered, skipMotion, anim]);

  const activeLat = cachedCoords?.lat;
  const activeLng = cachedCoords?.lng;

  const handleOpenExternal = () => {
    if (!Number.isFinite(activeLat) || !Number.isFinite(activeLng)) return;
    const url = `https://www.openstreetmap.org/?mlat=${activeLat.toFixed(
      6,
    )}&mlon=${activeLng.toFixed(6)}#map=16/${activeLat.toFixed(
      6,
    )}/${activeLng.toFixed(6)}`;
    Linking.openURL(url).catch(() => Alert.alert('Mapa', 'Não foi possível abrir o mapa no aparelho.'));
  };

  const maxHeight = anim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 240],
  });
  const marginTop = anim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 12],
  });
  const translateY = anim.interpolate({
    inputRange: [0, 1],
    outputRange: [-9, 0],
  });

  if (!cachedCoords) return null;
  return (
    <Animated.View
      pointerEvents={show ? 'auto' : 'none'}
      accessibilityElementsHidden={!show}
      importantForAccessibility={show ? 'auto' : 'no-hide-descendants'}
      style={[
        styles.revealContainer,
        {
          maxHeight,
          opacity: anim,
          marginTop,
          transform: [{ translateY }],
        },
      ]}
    >
      <View style={styles.mapBox}>
        <View
          style={styles.mapCanvas}
          onLayout={({ nativeEvent: { layout } }) => setLayoutReady(layout.width > 0 && layout.height > 0)}
        >
          {/* Indicador fora do MapView: loadingEnabled causa NPE no Android em 1.26.1. */}
          {layoutReady && (
            <MapView
              style={StyleSheet.absoluteFill}
              region={{ latitude: activeLat, longitude: activeLng, latitudeDelta: 0.01, longitudeDelta: 0.01 }}
              scrollEnabled={false} zoomEnabled={false} rotateEnabled={false}
              pitchEnabled={false} toolbarEnabled={false}
              loadingEnabled={false}
              onMapReady={() => setMapReady(true)}
            >
              <Marker coordinate={{ latitude: activeLat, longitude: activeLng }} />
            </MapView>
          )}
          {!mapReady && <ActivityIndicator style={styles.mapLoading} color="#6824D6" accessibilityLabel="Carregando mapa" pointerEvents="none" />}
        </View>

        <Pressable
          onPress={handleOpenExternal}
          style={({ pressed }) => [
            styles.externalLinkBtn,
            pressed && { opacity: 0.75 },
          ]}
        >
          <Text style={styles.externalLinkText}>Abrir mapa completo</Text>
          <Svg
            width={13}
            height={13}
            viewBox="0 0 24 24"
            fill="none"
            stroke="#5316B8"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <Path d="M7 17 17 7M8 7h9v9" />
          </Svg>
        </Pressable>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  revealContainer: {
    overflow: 'hidden',
  },
  mapBox: {
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: '#DFD2FA',
    backgroundColor: '#FFFFFF',
    paddingTop: 10,
    paddingHorizontal: 10,
    paddingBottom: 12,
  },
  mapCanvas: {
    width: '100%',
    height: MAP_HEIGHT,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#EFE9FE',
    backgroundColor: '#EAE7F3',
    position: 'relative',
    overflow: 'hidden',
  },
  mapLoading: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  externalLinkBtn: {
    marginTop: 9,
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  externalLinkText: {
    fontSize: 11,
    fontFamily: 'PlusJakartaSans-ExtraBold',
    color: '#5316B8',
    includeFontPadding: false,
  },
});
