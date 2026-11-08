// react-native-maps na web: Leaflet + OpenStreetMap (gratuito, sem chave).
import React, { createContext, forwardRef, useContext, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { View } from 'react-native-web';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

const MapContext = createContext(null);
const zoomFor = region => Math.max(3, Math.min(18, Math.round(Math.log2(360 / Math.max(region?.latitudeDelta || 0.05, 0.0005)))));
const applyRegion = (map, region, animate = false) => {
  if (!map || !Number.isFinite(region?.latitude) || !Number.isFinite(region?.longitude)) return;
  map.setView([region.latitude, region.longitude], zoomFor(region), { animate });
};

const MapView = forwardRef(function MapView({ style, region, initialRegion, onMapReady, children,
  scrollEnabled = true, zoomEnabled = true, rotateEnabled, pitchEnabled, ...rest }, ref) {
  const host = useRef(null);
  const [map, setMap] = useState(null);
  useEffect(() => {
    const instance = L.map(host.current, { zoomControl: false, attributionControl: true,
      dragging: scrollEnabled, scrollWheelZoom: zoomEnabled, touchZoom: zoomEnabled, doubleClickZoom: zoomEnabled });
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19, attribution: '&copy; OpenStreetMap',
    }).addTo(instance);
    applyRegion(instance, region || initialRegion);
    setMap(instance);
    const resize = new ResizeObserver(() => instance.invalidateSize());
    resize.observe(host.current);
    onMapReady?.();
    return () => { resize.disconnect(); instance.remove(); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (region) applyRegion(map, region); },
    [map, region?.latitude, region?.longitude, region?.latitudeDelta]); // eslint-disable-line react-hooks/exhaustive-deps
  useImperativeHandle(ref, () => ({
    animateToRegion: target => applyRegion(map, target, true),
    fitToCoordinates: coords => { if (map && coords?.length) map.fitBounds(coords.map(c => [c.latitude, c.longitude]), { padding: [24, 24] }); },
  }), [map]);
  return (
    <View style={[{ overflow: 'hidden' }, style]} {...rest}>
      <div ref={host} style={{ position: 'absolute', inset: 0, zIndex: 0 }} />
      {map ? <MapContext.Provider value={map}>{children}</MapContext.Provider> : null}
    </View>
  );
});

export function Marker({ coordinate, pinColor = '#6824D6', title }) {
  const map = useContext(MapContext);
  useEffect(() => {
    if (!map || !Number.isFinite(coordinate?.latitude)) return undefined;
    const marker = L.circleMarker([coordinate.latitude, coordinate.longitude], {
      radius: 8, color: '#FFFFFF', weight: 3, fillColor: pinColor, fillOpacity: 1,
    }).addTo(map);
    if (title) marker.bindTooltip(title);
    return () => marker.remove();
  }, [map, coordinate?.latitude, coordinate?.longitude, pinColor, title]);
  return null;
}

// Mapa de calor simplificado: círculos translúcidos somam intensidade onde há mais registros.
export function Heatmap({ points = [], radius = 40, opacity = 0.7 }) {
  const map = useContext(MapContext);
  useEffect(() => {
    if (!map) return undefined;
    const layer = L.layerGroup(points.filter(p => Number.isFinite(p?.latitude)).map(p => L.circleMarker([p.latitude, p.longitude], {
      radius: radius / 2, stroke: false, fillColor: '#E4572E', fillOpacity: Math.min(0.9, (opacity / 3) * (p.weight || 1)),
    }))).addTo(map);
    return () => layer.remove();
  }, [map, points, radius, opacity]);
  return null;
}
export const PROVIDER_GOOGLE = 'google';
export const PROVIDER_DEFAULT = null;
export default MapView;
