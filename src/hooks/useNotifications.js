// src/hooks/useNotifications.js
import { useState } from 'react';
import { Alert } from 'react-native';

export default function useNotifications() {
  const [enabled, setEnabled] = useState(true);

  const toggleNotifications = () => {
    setEnabled((prev) => {
      const newState = !prev;

      // Mostra feedback no app
      if (newState) {
        Alert.alert('Notificações', 'As notificações foram ativadas ✅');
      } else {
        Alert.alert('Notificações', 'As notificações foram desativadas ❌');
      }

      return newState;
    });

    // 🔹 integração futura com Firebase/OneSignal:
    // if (enabled) messaging().unsubscribeFromTopic('all');
    // else messaging().subscribeToTopic('all');
  };

  return {
    notificationsEnabled: enabled,
    toggleNotifications,
  };
}
