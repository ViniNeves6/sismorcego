import { useSyncExternalStore } from 'react';
import { getKeyboardSnapshot, subscribeKeyboard } from '../services/keyboardState';
export default function useKeyboardState() {
  return useSyncExternalStore(subscribeKeyboard, getKeyboardSnapshot, getKeyboardSnapshot);
}
