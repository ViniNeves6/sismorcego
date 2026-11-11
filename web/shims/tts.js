// react-native-tts → Web Speech API (Safari/Chrome).
const synth = typeof window !== 'undefined' ? window.speechSynthesis : null;
let language = 'pt-BR';
const listeners = {};
const emit = (event, payload) => (listeners[event] || []).forEach(fn => fn(payload));
const Tts = {
  getInitStatus: async () => (synth ? 'success' : Promise.reject(Object.assign(new Error('no_engine'), { code: 'no_engine' }))),
  setDefaultLanguage: async lang => { language = lang || language; },
  setDefaultRate: async () => {}, setDefaultPitch: async () => {}, setDucking: async () => {},
  setIgnoreSilentSwitch: async () => {}, voices: async () => (synth?.getVoices?.() || []).map(v => ({ id: v.voiceURI, language: v.lang, name: v.name })),
  engines: async () => [], requestInstallEngine: async () => {}, requestInstallData: async () => {},
  addEventListener: (event, fn) => { (listeners[event] ||= []).push(fn); return { remove: () => Tts.removeEventListener(event, fn) }; },
  removeEventListener: (event, fn) => { listeners[event] = (listeners[event] || []).filter(x => x !== fn); },
  removeAllListeners: event => { delete listeners[event]; },
  stop: async () => { synth?.cancel(); return true; },
  speak: (text) => {
    if (!synth) return Promise.resolve();
    const u = new SpeechSynthesisUtterance(String(text || ''));
    u.lang = language;
    const id = String(Date.now());
    u.onstart = () => emit('tts-start', { utteranceId: id });
    u.onend = () => emit('tts-finish', { utteranceId: id });
    u.onerror = () => emit('tts-error', { utteranceId: id });
    synth.speak(u);
    return Promise.resolve(id);
  },
};
export default Tts;
