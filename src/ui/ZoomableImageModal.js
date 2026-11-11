// Visualização em tela cheia com zoom: pinça (2 dedos), arrastar quando
// ampliada e dois toques para ampliar/voltar. Usada nas imagens informativas.
// Só PanResponder + Animated do React Native: funciona no Android, no iOS e na web.
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { BackHandler, Easing, Image, Modal, PanResponder, StatusBar, StyleSheet, useWindowDimensions } from 'react-native';
import { Animated, Pressable, Text, View } from './AccessibleNative';
import { CloseIcon } from './SismorcegoIcons';
import useReduceMotion from './useReduceMotion';
import useSpeakOnMount from '../hooks/useSpeakOnMount';

export const MAX_SCALE = 5;
export const DOUBLE_TAP_SCALE = 2.5;
export const DOUBLE_TAP_MS = 280;
const TAP_SLOP = 12;

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const distance = ([a, b]) => Math.hypot(a.pageX - b.pageX, a.pageY - b.pageY);
const midpoint = ([a, b]) => ({ x: (a.pageX + b.pageX) / 2, y: (a.pageY + b.pageY) / 2 });

// Tamanho exibido da imagem inteira ("contain") dentro da área disponível.
export function fittedSize(area, aspectRatio) {
  if (!area.width || !area.height || !aspectRatio) return { width: area.width || 0, height: area.height || 0 };
  const width = Math.min(area.width, area.height * aspectRatio);
  return { width, height: width / aspectRatio };
}
// Deslocamento máximo para a imagem ampliada nunca sair da tela.
export function clampOffset(offset, scale, fitted, area) {
  const maxX = Math.max(0, (fitted.width * scale - area.width) / 2);
  const maxY = Math.max(0, (fitted.height * scale - area.height) / 2);
  return { x: clamp(offset.x, -maxX, maxX) + 0, y: clamp(offset.y, -maxY, maxY) + 0 };
}
// Ampliar mantendo sob o dedo o ponto tocado (coordenadas relativas ao centro).
export function zoomAround(point, fromScale, toScale, offset) {
  const ratio = toScale / fromScale;
  return { x: point.x - (point.x - offset.x) * ratio, y: point.y - (point.y - offset.y) * ratio };
}

// Lógica do gesto, independente do React: recebe toques (pageX/pageY) e
// devolve o novo enquadramento via apply({ scale, x, y }, animate).
export function createZoomController({ getView, getArea, apply, now = () => Date.now() }) {
  const g = { mode: null, startDistance: 0, startScale: 1, startMid: null, startOffset: { x: 0, y: 0 }, lastTap: 0, moved: false };
  const begin = touches => {
    const view = getView();
    g.startScale = view.scale; g.startOffset = { x: view.x, y: view.y };
    if (touches.length >= 2) { g.mode = 'pinch'; g.startDistance = distance(touches); g.startMid = midpoint(touches); }
  };
  return {
    grant(touches) { g.moved = false; g.mode = touches.length >= 2 ? 'pinch' : 'pan'; begin(touches); },
    move(touches, dx = 0, dy = 0) {
      if (touches.length >= 2) {
        // Um segundo dedo pode chegar depois do primeiro: recomeça a pinça daí.
        if (g.mode !== 'pinch') begin(touches);
        g.moved = true;
        const area = getArea();
        const nextScale = clamp(g.startScale * (distance(touches) / Math.max(1, g.startDistance)), 1, MAX_SCALE);
        const point = { x: g.startMid.x - area.width / 2, y: g.startMid.y - area.height / 2 };
        const offset = zoomAround(point, g.startScale, nextScale, g.startOffset);
        const mid = midpoint(touches);
        apply({ scale: nextScale, x: offset.x + (mid.x - g.startMid.x), y: offset.y + (mid.y - g.startMid.y) });
        return;
      }
      if (Math.abs(dx) > TAP_SLOP || Math.abs(dy) > TAP_SLOP) g.moved = true;
      const view = getView();
      if (g.mode === 'pan' && view.scale > 1) apply({ scale: view.scale, x: g.startOffset.x + dx, y: g.startOffset.y + dy });
    },
    release(point) {
      const wasTap = !g.moved && g.mode === 'pan';
      g.mode = null;
      if (getView().scale < 1.02) apply({ scale: 1, x: 0, y: 0 }, true);
      // Arrastar ou pinçar entre dois toques não pode virar um "toque duplo".
      if (!wasTap) { g.lastTap = 0; return; }
      const time = now();
      if (time - g.lastTap >= DOUBLE_TAP_MS) { g.lastTap = time; return; }
      g.lastTap = 0;
      if (getView().scale > 1) { apply({ scale: 1, x: 0, y: 0 }, true); return; }
      const area = getArea();
      const tapped = { x: (point?.x ?? area.width / 2) - area.width / 2, y: (point?.y ?? area.height / 2) - area.height / 2 };
      apply({ scale: DOUBLE_TAP_SCALE, ...zoomAround(tapped, 1, DOUBLE_TAP_SCALE, { x: 0, y: 0 }) }, true);
    },
  };
}

export default function ZoomableImageModal({ visible, source, title, aspectRatio, onClose }) {
  const reduceMotion = useReduceMotion();
  const window = useWindowDimensions();
  const [rendered, setRendered] = useState(visible);
  const [shown, setShown] = useState({ source, title, aspectRatio });
  const [area, setArea] = useState({ width: window.width, height: window.height });
  const fade = useRef(new Animated.Value(0)).current;
  const scaleValue = useRef(new Animated.Value(1)).current;
  const xValue = useRef(new Animated.Value(0)).current;
  const yValue = useRef(new Animated.Value(0)).current;
  const view = useRef({ scale: 1, x: 0, y: 0 });
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useSpeakOnMount(`${title || 'Imagem'} ampliada. Use dois dedos para aproximar e o botão Fechar para voltar`, { active: Boolean(visible), priority: 50 });

  const fitted = fittedSize(area, shown.aspectRatio);
  const fittedRef = useRef(fitted); fittedRef.current = fitted;
  const areaRef = useRef(area); areaRef.current = area;

  const apply = (next, animate = false) => {
    const scale = clamp(next.scale, 1, MAX_SCALE);
    const offset = clampOffset({ x: next.x, y: next.y }, scale, fittedRef.current, areaRef.current);
    view.current = { scale, ...offset };
    if (animate && !reduceMotion) {
      Animated.parallel([
        Animated.timing(scaleValue, { toValue: scale, duration: 220, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
        Animated.timing(xValue, { toValue: offset.x, duration: 220, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
        Animated.timing(yValue, { toValue: offset.y, duration: 220, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      ]).start();
    } else { scaleValue.setValue(scale); xValue.setValue(offset.x); yValue.setValue(offset.y); }
  };

  // Entrada/saída com fade; o conteúdo fica montado até a saída terminar.
  useEffect(() => {
    if (visible) {
      setShown({ source, title, aspectRatio });
      view.current = { scale: 1, x: 0, y: 0 };
      scaleValue.setValue(1); xValue.setValue(0); yValue.setValue(0);
      setRendered(true);
    }
    if (reduceMotion) { fade.setValue(visible ? 1 : 0); if (!visible) setRendered(false); return undefined; }
    const animation = Animated.timing(fade, { toValue: visible ? 1 : 0, duration: visible ? 200 : 170,
      easing: Easing.out(Easing.quad), useNativeDriver: true });
    animation.start(({ finished }) => { if (finished && !visible) setRendered(false); });
    return () => animation.stop();
  }, [visible]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!rendered) return undefined;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => { if (visible) closeRef.current?.(); return true; });
    return () => sub.remove();
  }, [rendered, visible]);

  const applyRef = useRef(apply); applyRef.current = apply;
  const responder = useMemo(() => {
    const controller = createZoomController({
      getView: () => view.current, getArea: () => areaRef.current,
      apply: (next, animate) => applyRef.current(next, animate),
    });
    const touchesOf = event => event.nativeEvent.touches || [];
    return PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: event => controller.grant(touchesOf(event)),
      onPanResponderMove: (event, state) => controller.move(touchesOf(event), state.dx, state.dy),
      onPanResponderRelease: event => controller.release({ x: event.nativeEvent.pageX, y: event.nativeEvent.pageY }),
      onPanResponderTerminate: event => controller.release({ x: event.nativeEvent.pageX, y: event.nativeEvent.pageY }),
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (!rendered) return null;
  return <Modal transparent visible animationType="none" statusBarTranslucent onRequestClose={() => closeRef.current?.()}>
    <StatusBar barStyle="light-content" />
    <Animated.View testID="zoom-viewer" style={[styles.root, { opacity: fade }]}>
      <View testID="zoom-area" style={StyleSheet.absoluteFill} {...responder.panHandlers}
        onLayout={event => {
          const { width, height } = event.nativeEvent.layout;
          if (width && height) setArea(old => (old.width === width && old.height === height ? old : { width, height }));
        }}
        accessible accessibilityRole="image" accessibilityLabel={`${shown.title || 'Imagem'}. Toque duas vezes para ampliar`}>
        <View style={styles.center} pointerEvents="none">
          <Animated.View testID="zoom-image" style={{ width: fitted.width, height: fitted.height,
            transform: [{ translateX: xValue }, { translateY: yValue }, { scale: scaleValue }] }}>
            <Image source={shown.source} style={StyleSheet.absoluteFill} resizeMode="contain" />
          </Animated.View>
        </View>
      </View>
      <View style={styles.topBar} pointerEvents="box-none">
        {shown.title ? <Text style={styles.title} numberOfLines={1}>{shown.title}</Text> : <View style={styles.flex} />}
        <Pressable accessibilityRole="button" accessibilityLabel="Fechar imagem ampliada" hitSlop={10}
          onPress={() => closeRef.current?.()} style={({ pressed }) => [styles.close, pressed && styles.pressed]}>
          <CloseIcon size={18} color="#FFFFFF" strokeWidth={2.6} />
        </Pressable>
      </View>
      <View style={styles.hint} pointerEvents="none">
        <Text style={styles.hintText}>Use dois dedos ou toque duas vezes para ampliar</Text>
      </View>
    </Animated.View>
  </Modal>;
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: 'rgba(10, 6, 20, 0.96)' },
  center: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
  flex: { flex: 1 },
  topBar: { position: 'absolute', top: 0, left: 0, right: 0, paddingTop: 44, paddingHorizontal: 16, paddingBottom: 12,
    flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: 'rgba(10, 6, 20, 0.55)' },
  title: { flex: 1, color: '#FFFFFF', fontFamily: 'PlusJakartaSans-Bold', fontSize: 16 },
  close: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.16)' },
  pressed: { opacity: 0.7 },
  hint: { position: 'absolute', left: 16, right: 16, bottom: 28, alignItems: 'center' },
  hintText: { color: 'rgba(255,255,255,0.85)', fontFamily: 'PlusJakartaSans-SemiBold', fontSize: 13,
    backgroundColor: 'rgba(0,0,0,0.45)', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, overflow: 'hidden' },
});
