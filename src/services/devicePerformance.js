import { AppState, NativeModules, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = '@sismorcego:performance-observation:v1';
const FALLBACK = Object.freeze({ ready: true, tier: 'medium', source: 'unavailable', automaticReduceMotion: false });
let pending, observing = false, observed = false;
const device = () => Platform.OS === 'android' ? NativeModules.SismorcegoDevice : null;
export function initialDevicePerformance() {
  return device()?.getCapabilities ? { ...FALLBACK, ready: false, automaticReduceMotion: true } : FALLBACK;
}
export function classifyDevice(capabilities = {}, observation) {
  const positive = value => Number.isFinite(Number(value)) && Number(value) > 0 ? Number(value) : 0;
  const ram = positive(capabilities.totalMemoryMb);
  const available = positive(capabilities.availableMemoryMb);
  const cores = positive(capabilities.cpuCores);
  const frequency = positive(capabilities.cpuMaxMhz);
  const mhz = frequency >= 100 && frequency <= 10000 ? frequency : 0;
  const sdk = positive(capabilities.androidSdk);
  let tier = capabilities.lowRamDevice === true || (ram > 0 && ram < 3500) || (cores > 0 && cores <= 2) ||
    (sdk > 0 && sdk < 26) || (mhz > 0 && mhz < 1500 && cores <= 4) ? 'low'
    : ram >= 5500 && cores >= 6 && sdk >= 29 && (!mhz || mhz >= 2000) ? 'high' : 'medium';
  // Available RAM caps decorative work only under actual memory pressure.
  // A single temporary free-memory reading cannot turn a normal device "low".
  if (tier === 'high' && capabilities.lowMemory === true && available > 0 && available < 400 && available / ram < 0.08) tier = 'medium';
  if (observation?.constrained === true) tier = tier === 'high' ? 'medium' : 'low';
  return { tier, automaticReduceMotion: tier === 'low' };
}
const fingerprint = cap => [Math.round(cap.totalMemoryMb / 256), cap.cpuCores, cap.cpuMaxMhz || 0, cap.androidSdk].join(':');
export function loadDevicePerformance() {
  if (!device()?.getCapabilities) return Promise.resolve(FALLBACK);
  if (!pending) pending = (async () => {
    const capabilities = await device().getCapabilities();
    const id = fingerprint(capabilities);
    let history;
    try {
      const stored = JSON.parse(await AsyncStorage.getItem(KEY) || 'null');
      if (stored?.fingerprint === id) history = stored;
    } catch { /* Missing/unreadable measurements never block opening the app. */ }
    return { ready: true, source: 'native', capabilities, fingerprint: id, history, ...classifyDevice(capabilities, history) };
  })().catch(() => FALLBACK);
  return pending;
}
export function nextPerformanceObservation(profile, intervals) {
  const sorted = intervals.filter(value => Number.isFinite(value) && value >= 5 && value <= 250).sort((a, b) => a - b);
  if (sorted.length < 8) return null;
  const median = sorted[Math.floor(sorted.length / 2)], p90 = sorted[Math.floor((sorted.length - 1) * 0.9)];
  const slow = median > 30 && p90 > 45, healthy = median < 22 && p90 < 25;
  const previous = profile.history || {};
  const slowRuns = slow ? Math.min(3, (Number(previous.slowRuns) || 0) + 1) : healthy ? 0 : Number(previous.slowRuns) || 0;
  const healthyRuns = healthy ? Math.min(3, (Number(previous.healthyRuns) || 0) + 1) : slow ? 0 : Number(previous.healthyRuns) || 0;
  return { fingerprint: profile.fingerprint, slowRuns, healthyRuns,
    constrained: slowRuns >= 2 || (previous.constrained === true && healthyRuns < 3), median, p90 };
}
// Lightweight passive sample during startup; no synthetic CPU/GPU stress test.
// New observations affect a later launch, never the quality of an active screen.
export function observeStartupPerformance(profile) {
  if (profile.source !== 'native' || observing || observed || AppState.currentState !== 'active') return () => {};
  observing = true;
  let frame, last, warmup = 4, cancelled = false;
  const intervals = [];
  const stop = () => { cancelled = true; observing = false; cancelAnimationFrame(frame); subscription.remove(); };
  const subscription = AppState.addEventListener('change', state => { if (state !== 'active') stop(); });
  const tick = now => {
    if (cancelled) return;
    if (warmup > 0) warmup -= 1;
    else if (last !== undefined) intervals.push(now - last);
    last = now;
    if (intervals.length < 12) { frame = requestAnimationFrame(tick); return; }
    observed = true;
    const observation = nextPerformanceObservation(profile, intervals);
    stop();
    if (observation) AsyncStorage.setItem(KEY, JSON.stringify(observation)).catch(() => {});
  };
  frame = requestAnimationFrame(tick);
  return stop;
}
