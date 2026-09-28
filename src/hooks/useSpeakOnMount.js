// src/hooks/useSpeakOnMount.js
import { useEffect } from "react";
import useAccessibility from "./useAccessibility";

// Leitura em voz alta ao abrir a tela (quando "leitura por voz" está ativa).
export default function useSpeakOnMount(text) {
  const { textToSpeechEnabled, speak } = useAccessibility();

  useEffect(() => {
    if (textToSpeechEnabled) speak(text);
  }, [textToSpeechEnabled, speak, text]);
}
