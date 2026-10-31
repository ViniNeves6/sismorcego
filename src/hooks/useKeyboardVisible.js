import { useEffect, useState } from 'react';
import { AppState, Keyboard, Platform } from 'react-native';

export default function useKeyboardVisible() {
  const [visible, setVisible] = useState(() => Keyboard.isVisible());

  useEffect(() => {
    const subscriptions = [
      Keyboard.addListener('keyboardDidShow', () => setVisible(true)),
      Keyboard.addListener('keyboardDidHide', () => setVisible(false)),
    ];
    if (Platform.OS === 'ios') subscriptions.push(
      Keyboard.addListener('keyboardWillShow', () => setVisible(true)),
    );
    // The app can return from the background after the keyboard has closed.
    const appState = AppState.addEventListener('change', state => {
      if (state === 'active') setVisible(Keyboard.isVisible());
    });
    setVisible(Keyboard.isVisible());
    return () => { subscriptions.forEach(subscription => subscription.remove()); appState.remove(); };
  }, []);

  return visible;
}
