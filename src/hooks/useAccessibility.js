// src/hooks/useAccessibility.js
import React, {
  createContext,
  useContext,
  useMemo,
  useState,
  useEffect,
  useCallback,
} from 'react';
import Tts from 'react-native-tts';
import logger from '../utils/logger';

const AccessibilityContext = createContext(null);

export function AccessibilityProvider({ children }) {
  const [fontScale, setFontScale] = useState(1);
  const [highContrast, setHighContrast] = useState(false);
  const [textToSpeechEnabled, setTextToSpeechEnabled] = useState(false);

  useEffect(() => {
    // Configuração inicial do TTS
    try {
      Tts.setDefaultLanguage('pt-BR');
      Tts.setDucking(true);
    } catch (err) {
      if (__DEV__) logger.warn('useAccessibility: TTS init failed', err);
    }
  }, []);

  const increaseFont = () => setFontScale(prev => Math.min(prev + 0.1, 2));
  const decreaseFont = () => setFontScale(prev => Math.max(prev - 0.1, 0.8));
  const toggleContrast = () => setHighContrast(prev => !prev);
  const toggleTTS = () => setTextToSpeechEnabled(prev => !prev);

  // ✅ Função speak com verificação e try/catch
  const speak = useCallback(
    async (text) => {
      if (!textToSpeechEnabled || !text) return;
      try {
        await Tts.stop();
        await Tts.speak(String(text));
      } catch (err) {
        if (__DEV__) logger.warn('useAccessibility: TTS speak failed', err);
      }
    },
    [textToSpeechEnabled]
  );

  const value = useMemo(
    () => ({
      fontScale,
      increaseFont,
      decreaseFont,
      highContrast,
      toggleContrast,
      textToSpeechEnabled,
      toggleTTS,
      speak,
    }),
    [fontScale, highContrast, textToSpeechEnabled, speak]
  );

  return (
    <AccessibilityContext.Provider value={value}>
      {children}
    </AccessibilityContext.Provider>
  );
}

export default function useAccessibility() {
  const ctx = useContext(AccessibilityContext);

  // Fallback seguro caso o contexto não esteja montado
  if (!ctx) {
    return {
      fontScale: 1,
      increaseFont: () => {},
      decreaseFont: () => {},
      highContrast: false,
      toggleContrast: () => {},
      textToSpeechEnabled: false,
      toggleTTS: () => {},
      speak: () => {},
    };
  }

  return ctx;
}
