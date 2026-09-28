// Camada sobre react-native-web para a prévia: tema controlável, Alert, etc.
import React from 'react';
import { createPortal } from 'react-dom';
import * as RNW from 'react-native-web';

export * from 'react-native-web';

// A prévia segue os caminhos do iOS do app (seletor de data em folha etc.).
export const Platform = { ...RNW.Platform, OS: 'ios', select: (o) => (o.ios !== undefined ? o.ios : o.default) };

// ---- Esquema de cor controlado pela barra da prévia ----
const schemeListeners = new Set();
window.__scheme = new URLSearchParams(location.search).get('scheme') || 'light';
window.__setScheme = (s) => {
  window.__scheme = s;
  schemeListeners.forEach((fn) => fn(s));
};
export function useColorScheme() {
  const [s, setS] = React.useState(window.__scheme);
  React.useEffect(() => {
    schemeListeners.add(setS);
    return () => schemeListeners.delete(setS);
  }, []);
  return s;
}

// ---- Barra de status simulada: a cor segue o barStyle pedido pelo app ----
export function StatusBar({ barStyle }) {
  React.useEffect(() => {
    const el = document.querySelector('.status');
    if (el) el.style.color = barStyle === 'light-content' ? '#ffffff' : '#111111';
  }, [barStyle]);
  return null;
}

// ---- Modal: o do RNW vai para o <body>; aqui fica dentro da moldura do celular ----
export function Modal({ visible, children }) {
  if (!visible) return null;
  const host = document.querySelector('.phone');
  if (!host) return null;
  return createPortal(
    <RNW.View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 1000, backgroundColor: 'transparent' }}>
      {children}
    </RNW.View>,
    host
  );
}

// ---- Alert.alert: RNW não implementa; usa confirm() do navegador ----
export const Alert = {
  alert(title, message, buttons = []) {
    if (buttons.length <= 1) {
      window.alert([title, message].filter(Boolean).join('\n\n'));
      buttons[0]?.onPress?.();
      return;
    }
    const action = buttons.find((b) => b.style !== 'cancel');
    if (window.confirm([title, message].filter(Boolean).join('\n\n'))) action?.onPress?.();
    else buttons.find((b) => b.style === 'cancel')?.onPress?.();
  },
};

// ---- DeviceEventEmitter simples ----
const bus = {};
export const DeviceEventEmitter = {
  addListener(evt, fn) {
    (bus[evt] ||= new Set()).add(fn);
    return { remove: () => bus[evt].delete(fn) };
  },
  emit(evt, ...args) {
    bus[evt]?.forEach((fn) => fn(...args));
  },
};

export const PermissionsAndroid = { PERMISSIONS: {}, RESULTS: { GRANTED: 'granted' }, request: async () => 'granted' };
export const UIManager = RNW.UIManager || {};
export const LayoutAnimation = {
  configureNext() {},
  Presets: { easeInEaseOut: {} },
};

// Fotos "salvas no aparelho" (file://) viram uma imagem de exemplo.
const SAMPLE_PHOTO =
  'data:image/svg+xml;utf8,' +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="640" height="480"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#7c5a3a"/><stop offset="1" stop-color="#2f4a2b"/></linearGradient></defs><rect width="640" height="480" fill="url(#g)"/><text x="320" y="250" font-family="sans-serif" font-size="28" fill="#ffffffcc" text-anchor="middle">Foto de exemplo</text></svg>'
  );
export function Image({ source, ...rest }) {
  const src = source && typeof source === 'object' && String(source.uri || '').startsWith('file://') ? { uri: SAMPLE_PHOTO } : source;
  return <RNW.Image source={src} {...rest} />;
}
