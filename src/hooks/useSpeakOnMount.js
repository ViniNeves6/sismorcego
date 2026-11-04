// src/hooks/useSpeakOnMount.js
import { useContext, useEffect, useRef } from "react";
import useAccessibility from "./useAccessibility";
import { ScreenTransitionReadyContext } from '../ui/ScreenTransitionContext';

// Leitura em voz alta ao abrir a tela (quando "leitura por voz" está ativa).
export default function useSpeakOnMount(text, { active = true, priority = 0 } = {}) {
  const { registerSpeech } = useAccessibility();
  const ready = useContext(ScreenTransitionReadyContext);
  const id = useRef(Symbol('speech-region'));
  useEffect(() => {
    if (active && ready && text) return registerSpeech?.(id.current, String(text), priority);
  }, [registerSpeech, text, active, priority, ready]);
}
