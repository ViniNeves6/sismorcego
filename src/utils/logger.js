// src/utils/logger.js

const isDev = typeof __DEV__ !== 'undefined' && __DEV__ === true;

const safeLog = (level, ...args) => {
  if (!isDev) return;

  try {
    console[level](...args);
  } catch {
    // evita crash se console falhar
  }
};

const logger = {
  log: (...args) => safeLog('log', ...args),
  warn: (...args) => safeLog('warn', ...args),
  error: (...args) => safeLog('error', ...args),
  info: (...args) => safeLog('info', ...args),
};

export default logger;