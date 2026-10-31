import React, { memo, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet } from 'react-native';
import MapView, { Heatmap, Marker } from 'react-native-maps';
import { Text, View } from '../../ui/AccessibleNative';
import { ScreenTransitionReadyContext } from '../../ui/AnimatedScreenTransition';

function DeferredPanelMap({ points, region }) {
  const screenReady = useContext(ScreenTransitionReadyContext);
  const mapRef = useRef(null);
  const [mounted, setMounted] = useState(false);
  const [mapReady, setMapReady] = useState(false);
  const heatmapPoints = useMemo(() => points.map(({ latitude, longitude, weight }) => ({ latitude, longitude, weight })), [points]);

  useEffect(() => {
    // Cancel pending initialization when leaving, but retain an existing native
    // map until its screen has finished fading out and actually unmounts.
    if (!screenReady || mounted) return;
    let cancelled = false;
    let secondFrame, idleTask, fallbackTask;
    const mount = () => { if (!cancelled) setMounted(true); };
    // Mesmo com movimento reduzido, deixar a primeira pintura da tela ocorrer
    // antes de criar a View nativa do Google Maps. Idle não é outra thread.
    const firstFrame = requestAnimationFrame(() => {
      if (cancelled) return;
      secondFrame = requestAnimationFrame(() => {
        if (cancelled) return;
        if (typeof requestIdleCallback === 'function') idleTask = requestIdleCallback(mount, { timeout: 750 });
        else fallbackTask = setTimeout(mount, 0);
      });
    });
    return () => {
      cancelled = true;
      cancelAnimationFrame(firstFrame);
      if (secondFrame != null) cancelAnimationFrame(secondFrame);
      if (idleTask != null && typeof cancelIdleCallback === 'function') cancelIdleCallback(idleTask);
      if (fallbackTask != null) clearTimeout(fallbackTask);
    };
  }, [screenReady, mounted]);

  useEffect(() => {
    // Mudanças de filtro durante a inicialização usam sempre a região atual,
    // sem enviar comandos a um mapa que ainda não está pronto.
    if (mapReady) mapRef.current?.animateToRegion?.(region, 0);
  }, [region, mapReady]);

  return <>
    {mounted && <MapView
      ref={mapRef}
      style={StyleSheet.absoluteFillObject}
      initialRegion={region}
      toolbarEnabled={false}
      loadingEnabled={false}
      onMapReady={() => setMapReady(true)}
    >
      <Heatmap points={heatmapPoints} radius={40} opacity={0.8} />
      {points.map((point, index) => <Marker
        key={`pt-${point.id || index}`}
        coordinate={{ latitude: point.latitude, longitude: point.longitude }}
        title={point.title}
        description={point.city}
      />)}
    </MapView>}
    {(!mounted || !mapReady) && <View style={styles.placeholder} pointerEvents="none">
      <Text style={styles.message} accessibilityLiveRegion="polite">Carregando mapa…</Text>
    </View>}
  </>;
}

export default memo(DeferredPanelMap);

const styles = StyleSheet.create({
  placeholder: { ...StyleSheet.absoluteFillObject, backgroundColor: '#F8F6FD', alignItems: 'center', justifyContent: 'center', padding: 20 },
  message: { fontSize: 12, fontWeight: '700', color: '#796E92', textAlign: 'center' },
});
