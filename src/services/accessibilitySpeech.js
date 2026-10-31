import Tts from 'react-native-tts';

function speechError(error) {
  if (error?.accessibilitySpeechError) return error;
  const code = String(error?.code || error?.message || '');
  const result = new Error(code.includes('no_engine')
    ? 'Não há um mecanismo de leitura por voz disponível neste aparelho. Confira as configurações de voz do celular.'
    : code.toLowerCase().includes('lang')
      ? 'A voz em português não está disponível. Confira o idioma nas configurações de voz do celular.'
      : 'Não foi possível iniciar a leitura por voz. Confira as configurações de voz do celular.');
  result.accessibilitySpeechError = true;
  return result;
}

export function createSpeechController({ canSpeak, onError }) {
  let initialization, generation = 0, disposed = false;
  const initialize = () => {
    if (!initialization) initialization = (async () => {
      await Tts.getInitStatus?.();
      await Tts.setDefaultLanguage('pt-BR');
      await Tts.setDucking(true);
    })().catch(error => { initialization = null; throw speechError(error); });
    return initialization;
  };
  const stop = () => {
    generation += 1;
    return Promise.resolve().then(() => Tts.stop()).catch(() => {});
  };
  return {
    initialize, stop,
    async speak(text) {
      const ticket = ++generation;
      const valid = () => !disposed && ticket === generation && canSpeak();
      if (!text || !valid()) return false;
      try {
        await initialize();
        if (!valid()) return false;
        await Tts.stop();
        if (!valid()) return false;
        await Tts.speak(String(text).slice(0, 3500));
        return true;
      } catch (error) { if (valid()) onError(speechError(error)); return false; }
    },
    dispose() { disposed = true; stop(); },
  };
}
