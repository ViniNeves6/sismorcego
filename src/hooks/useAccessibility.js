import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AccessibilityInfo, AppState } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createSpeechController } from '../services/accessibilitySpeech';
import logger from '../utils/logger';
import useDevicePerformance from './useDevicePerformance';

const KEY = '@sismorcego:accessibility';
const defaults = { fontScale: 1, highContrast: false, ttsEnabled: false, reduceMotion: false };
const Context = createContext(null);
export function normalizeAccessibilitySettings(value) {
  const scale = Number(value?.fontScale);
  return { fontScale: Number.isFinite(scale) && scale > 0 ? Math.round(Math.max(0.8, Math.min(2, scale)) * 100) / 100 : 1,
    highContrast: value?.highContrast === true, ttsEnabled: value?.ttsEnabled === true, reduceMotion: value?.reduceMotion === true };
}

export function AccessibilityProvider({ children }) {
  const performance = useDevicePerformance();
  const [settings, setSettings] = useState(defaults);
  const [systemReduceMotion, setSystemReduceMotion] = useState(false);
  const [ttsError, setTtsError] = useState(null);
  const [ttsInitializing, setTtsInitializing] = useState(false);
  const settingsRef = useRef(defaults);
  const alive = useRef(true), appActive = useRef(AppState.currentState !== 'background' && AppState.currentState !== 'inactive'), writes = useRef(Promise.resolve()), version = useRef(0), persisted = useRef(defaults);
  const hydration = useRef(null);
  if (!hydration.current) {
    let resolve;
    const promise = new Promise(done => { resolve = done; });
    hydration.current = { promise, resolve };
  }
  const controller = useRef(null);
  const voiceRequest = useRef(0);
  if (!controller.current) controller.current = createSpeechController({
    canSpeak: () => alive.current && settingsRef.current.ttsEnabled && appActive.current,
    onError: error => { if (alive.current) setTtsError(error.message); },
  });
  const regions = useRef(new Map()), regionSerial = useRef(0), announcementTimer = useRef(null), lastAnnouncement = useRef(null);
  const scheduleAnnouncement = useCallback(() => {
    clearTimeout(announcementTimer.current);
    if (!alive.current) return;
    announcementTimer.current = setTimeout(() => {
      if (!alive.current || !settingsRef.current.ttsEnabled || !appActive.current) return;
      const top = Array.from(regions.current.values()).sort((a, b) => b.priority - a.priority || b.serial - a.serial)[0];
      if (!top || (lastAnnouncement.current?.id === top.id && lastAnnouncement.current?.text === top.text)) return;
      lastAnnouncement.current = top;
      controller.current.speak(top.text);
    }, 80);
  }, []);
  const registerSpeech = useCallback((id, text, priority = 0) => {
    regions.current.set(id, { id, text, priority, serial: ++regionSerial.current });
    scheduleAnnouncement();
    return () => {
      regions.current.delete(id);
      if (lastAnnouncement.current?.id === id) { lastAnnouncement.current = null; controller.current.stop(); }
      scheduleAnnouncement();
    };
  }, [scheduleAnnouncement]);
  useEffect(() => {
    alive.current = true;
    let active = true;
    AsyncStorage.getItem(KEY).then(raw => {
      if (!active) return;
      const next = normalizeAccessibilitySettings(raw ? JSON.parse(raw) : defaults);
      settingsRef.current = next; persisted.current = next; setSettings(next);
    }).catch(error => logger.warn('Falha ao carregar acessibilidade', error)).finally(() => hydration.current.resolve());
    AccessibilityInfo.isReduceMotionEnabled().then(value => active && setSystemReduceMotion(Boolean(value))).catch(() => {});
    const listener = AccessibilityInfo.addEventListener('reduceMotionChanged', value => setSystemReduceMotion(Boolean(value)));
    const appListener = AppState.addEventListener('change', state => {
      appActive.current = state === 'active';
      if (!appActive.current) { clearTimeout(announcementTimer.current); controller.current.stop(); lastAnnouncement.current = null; }
      else scheduleAnnouncement();
    });
    return () => {
      active = false; alive.current = false; listener?.remove(); appListener?.remove();
      clearTimeout(announcementTimer.current); controller.current.stop();
    };
  }, [scheduleAnnouncement]);
  useEffect(() => {
    lastAnnouncement.current = null;
    if (settings.ttsEnabled) scheduleAnnouncement();
    else { clearTimeout(announcementTimer.current); controller.current.stop(); }
  }, [settings.ttsEnabled, scheduleAnnouncement]);
  const updateSettings = useCallback(async patch => {
    await hydration.current.promise;
    if (!alive.current) return;
    const changes = typeof patch === 'function' ? patch(settingsRef.current) : patch;
    const voiceTicket = typeof changes.ttsEnabled === 'boolean' ? ++voiceRequest.current : voiceRequest.current;
    if (changes.ttsEnabled === true) {
      setTtsInitializing(true);
      try { await controller.current.initialize(); if (alive.current && voiceTicket === voiceRequest.current) setTtsError(null); }
      catch (error) {
        if (!alive.current || voiceTicket !== voiceRequest.current) return;
        setTtsError(error.message); throw error;
      }
      finally { if (alive.current && voiceTicket === voiceRequest.current) setTtsInitializing(false); }
      if (!alive.current || voiceTicket !== voiceRequest.current) return;
    }
    if (changes.ttsEnabled === false) { setTtsInitializing(false); setTtsError(null); }
    const next = normalizeAccessibilitySettings({ ...settingsRef.current, ...changes });
    const request = ++version.current;
    settingsRef.current = next; setSettings(next);
    if (!next.ttsEnabled) { clearTimeout(announcementTimer.current); controller.current.stop(); }
    const write = writes.current.catch(() => {}).then(async () => {
      await AsyncStorage.setItem(KEY, JSON.stringify(next)); persisted.current = next;
    });
    writes.current = write;
    try { await write; }
    catch (error) {
      if (request === version.current && alive.current) {
        settingsRef.current = persisted.current; setSettings(persisted.current);
        if (!persisted.current.ttsEnabled) controller.current.stop();
      }
      throw new Error('Não foi possível salvar a configuração. Tente novamente.');
    }
  }, []);
  const speak = useCallback(text => { clearTimeout(announcementTimer.current); return controller.current.speak(text); }, []);
  const effectiveMotion = settings.reduceMotion || systemReduceMotion || performance.automaticReduceMotion;
  const value = useMemo(() => ({
    ...settings, provided: true, reduceMotion: effectiveMotion, systemReduceMotion, performance,
    settings: { ...settings, reduceMotion: effectiveMotion, preferredReduceMotion: settings.reduceMotion, systemReduceMotion,
      performanceTier: performance.tier, canAdjustMotion: performance.tier !== 'low' },
    updateSettings, speak, registerSpeech, ttsError, ttsInitializing,
    textToSpeechEnabled: settings.ttsEnabled,
    increaseFont: () => updateSettings(previous => ({ fontScale: previous.fontScale + 0.1 })),
    decreaseFont: () => updateSettings(previous => ({ fontScale: previous.fontScale - 0.1 })),
    toggleContrast: enabled => updateSettings(previous => ({ highContrast: typeof enabled === 'boolean' ? enabled : !previous.highContrast })),
    toggleTTS: enabled => updateSettings(previous => ({ ttsEnabled: typeof enabled === 'boolean' ? enabled : !previous.ttsEnabled })),
  }), [settings, effectiveMotion, systemReduceMotion, performance, updateSettings, speak, registerSpeech, ttsError, ttsInitializing]);
  return <Context.Provider value={value}>{children}</Context.Provider>;
}
const fallback = { ...defaults, settings: defaults, provided: false, updateSettings: async () => {}, speak: async () => false, registerSpeech: () => () => {} };
export default function useAccessibility() { return useContext(Context) || fallback; }
