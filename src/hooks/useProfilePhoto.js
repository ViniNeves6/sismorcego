// src/hooks/useProfilePhoto.js
// Foto de perfil é local (AsyncStorage). A tela de Conta emite
// 'profilePhoto:changed' quando ela muda; quem usa este hook acompanha.
import { useEffect, useState } from 'react';
import { DeviceEventEmitter } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function useProfilePhoto() {
  const [photo, setPhoto] = useState(null);

  useEffect(() => {
    let active = true;
    AsyncStorage.getItem('profilePhoto').then((saved) => {
      if (active && saved) setPhoto(saved);
    });
    const sub = DeviceEventEmitter.addListener('profilePhoto:changed', (next) => setPhoto(next || null));
    return () => {
      active = false;
      sub.remove();
    };
  }, []);

  return photo;
}
