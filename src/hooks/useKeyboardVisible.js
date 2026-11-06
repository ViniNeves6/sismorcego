import useKeyboardState from './useKeyboardState';

export default function useKeyboardVisible() {
  const keyboard = useKeyboardState();
  return keyboard.visible || keyboard.transitioning;
}
