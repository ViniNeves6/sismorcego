// react-native → react-native-web, mais o que ele não implementa no navegador.
import * as RNW from 'react-native-web';

export * from 'react-native-web';

// Alert.alert no navegador: alert()/confirm() nativos do Safari.
export const Alert = {
  alert(title, message, buttons = []) {
    const text = [title, message].filter(Boolean).join('\n\n');
    if (buttons.length <= 1) { window.alert(text); buttons[0]?.onPress?.(); return; }
    const action = buttons.find(b => b.style !== 'cancel') || buttons[buttons.length - 1];
    if (window.confirm(text)) action?.onPress?.();
    else buttons.find(b => b.style === 'cancel')?.onPress?.();
  },
};

export const PermissionsAndroid = {
  PERMISSIONS: {}, RESULTS: { GRANTED: 'granted', DENIED: 'denied' },
  request: async () => 'granted', requestMultiple: async () => ({}), check: async () => true,
};
export const requireNativeComponent = () => RNW.View;
export const TurboModuleRegistry = { get: () => null, getEnforcing: () => null };

// TextInput.State: usado para descobrir o campo focado (rolagem com teclado).
const isField = el => el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable);
const TextInputState = {
  currentlyFocusedInput: () => (isField(document.activeElement) ? document.activeElement : null),
  currentlyFocusedField: () => (isField(document.activeElement) ? document.activeElement : null),
  focusTextInput: el => el?.focus?.(),
  blurTextInput: el => el?.blur?.(),
  isTextInput: el => isField(el),
};
RNW.TextInput.State = { ...(RNW.TextInput.State || {}), ...TextInputState };
export const TextInput = RNW.TextInput;

// Não há botão "voltar" de hardware no navegador.
export const BackHandler = {
  addEventListener: () => ({ remove() {} }),
  removeEventListener() {},
  exitApp() {},
};
