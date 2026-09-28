// src/hooks/useNotifications.js
import { useState } from 'react';

// Preferência de notificações (estado local por enquanto).
// A tela mostra o feedback; aqui só guardamos o valor.
export default function useNotifications() {
  const [enabled, setEnabled] = useState(true);

  const toggleNotifications = (next) => {
    setEnabled((prev) => (typeof next === 'boolean' ? next : !prev));

    // integração futura com Firebase/OneSignal:
    // if (enabled) messaging().unsubscribeFromTopic('all');
    // else messaging().subscribeToTopic('all');
  };

  return {
    notificationsEnabled: enabled,
    toggleNotifications,
  };
}
