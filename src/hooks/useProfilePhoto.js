// src/hooks/useProfilePhoto.js
// Foto de perfil é local (AsyncStorage). A tela de Conta emite
// 'profilePhoto:changed' quando ela muda; quem usa este hook acompanha.
import { useEffect, useState } from 'react';
import { DeviceEventEmitter } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import useAuth from './useAuth';

export default function useProfilePhoto() {
  const { user } = useAuth();
  const [photo, setPhoto] = useState(null);

  useEffect(() => {
    let active = true;
    setPhoto(user?.photoURL || null);
    if (user?.uid) AsyncStorage.getItem(`@sismorcego:${user.uid}:profilePhoto`).then(saved => {
      if (active && saved) setPhoto(saved);
    }).catch(() => {});
    const sub = DeviceEventEmitter.addListener('profilePhoto:changed', (next) => setPhoto(next || null));
    return () => {
      active = false;
      sub.remove();
    };
  }, [user?.uid, user?.photoURL]);

  return photo;
}
