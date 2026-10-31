import AsyncStorage from '@react-native-async-storage/async-storage';
import { DeviceEventEmitter } from 'react-native';

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const PASSWORD_RE = /^(?=.*[A-Za-z])(?=.*\d).{6,}$/;
export function validateRegistration({ name, email, password, confirmPassword }) {
  const errors = {};
  if (!String(name || '').trim()) errors.name = 'Digite seu nome de usuário.';
  if (!EMAIL_RE.test(String(email || '').trim())) errors.email = 'Digite um e-mail válido.';
  if (!PASSWORD_RE.test(password || '')) errors.password = 'Use ao menos 6 caracteres, com letras e números.';
  if (password !== confirmPassword || !confirmPassword) errors.confirmPassword = 'As senhas não conferem.';
  return errors;
}
export const isSharedPhotoUrl = uri => typeof uri === 'string' && /^https:\/\//i.test(uri);
export async function saveLocalProfilePhoto(uid, uri) {
  if (!uid) throw new Error('Faça login para salvar a foto.');
  const key = `@sismorcego:${uid}:profilePhoto`;
  if (uri) await AsyncStorage.setItem(key, uri);
  else await AsyncStorage.removeItem(key);
  DeviceEventEmitter.emit('profilePhoto:changed', uri || null);
}
// Contrato para o futuro adaptador Storage. Nenhum upload é executado aqui.
export function profilePhotoUploadRequest(uid, localUri, contentType = 'image/jpeg') {
  if (!uid || !localUri || isSharedPhotoUrl(localUri)) return null;
  return { uid, localUri, contentType, objectPath: `profilePhotos/${uid}/avatar.jpg`, pendingBackend: true };
}
