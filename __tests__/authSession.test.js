import React from 'react';
import ReactTestRenderer, { act } from 'react-test-renderer';
import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import { onAuthStateChanged, signInWithEmailAndPassword, signOut, updatePassword, createUserWithEmailAndPassword, updateProfile } from 'firebase/auth';
import { getDoc } from 'firebase/firestore';
import { auth } from '../src/services/firebase';
import useAuth, { AuthProvider } from '../src/hooks/useAuth';

// Estes testes exercitam a autenticacao real da versao Release.
// O acesso local sem login da versao Debug possui teste separado.
jest.mock('../src/services/debugTestSession', () => ({ LOCAL_TEST_MODE: false, LOCAL_TEST_USER: null }));
jest.mock('../src/services/firebase', () => ({ auth: { currentUser: null }, db: {} }));
jest.mock('firebase/auth', () => ({
  onAuthStateChanged: jest.fn(() => jest.fn()), signInWithEmailAndPassword: jest.fn(), createUserWithEmailAndPassword: jest.fn(),
  sendPasswordResetEmail: jest.fn(), signOut: jest.fn().mockResolvedValue(), updateProfile: jest.fn().mockResolvedValue(),
  updateEmail: jest.fn().mockResolvedValue(), updatePassword: jest.fn().mockResolvedValue(),
}));
jest.mock('firebase/firestore', () => ({ doc: jest.fn(), getDoc: jest.fn(), setDoc: jest.fn() }));
jest.mock('@react-native-community/netinfo', () => ({ fetch: jest.fn(), addEventListener: jest.fn(() => () => {}) }));
jest.mock('../src/utils/logger', () => ({ warn: jest.fn(), error: jest.fn() }));
let session, tree;
function Probe() { session = useAuth(); return null; }
beforeEach(async () => {
  jest.clearAllMocks(); await AsyncStorage.clear();
  auth.currentUser = null;
  NetInfo.fetch.mockResolvedValue({ isConnected: true, isInternetReachable: true });
  getDoc.mockResolvedValue({ exists: () => true, data: () => ({ role: 'acs' }) });
  await act(async () => { tree = ReactTestRenderer.create(<AuthProvider><Probe /></AuthProvider>); });
});
afterEach(async () => { await act(async () => tree.unmount()); });

test('development builds still subscribe to real authentication and call real sign-in/sign-out', async () => {
  expect(onAuthStateChanged).toHaveBeenCalledTimes(1);
  const user = { uid: 'owner' };
  signInWithEmailAndPassword.mockResolvedValue({ user });
  expect(await session.signIn('ana@real.org', 'senha123')).toBe(user);
  expect(signInWithEmailAndPassword).toHaveBeenCalledWith(auth, 'ana@real.org', 'senha123');
  await session.signOut();
  expect(signOut).toHaveBeenCalledWith(auth);
});
test('persisted authenticated session opens offline and preserves the cached coordinator role', async () => {
  NetInfo.fetch.mockResolvedValue({ isConnected: false });
  await AsyncStorage.setItem('@sismorcego:coordinator:role', 'coordenador');
  const user = { uid: 'coordinator', email: 'coord@real.org' };
  auth.currentUser = user;
  await act(async () => onAuthStateChanged.mock.calls[0][1](user));
  expect(session).toMatchObject({ user, role: 'coordenador', loading: false });
  expect(getDoc).not.toHaveBeenCalled();
});
test('password update propagates the actual recent-login error', async () => {
  auth.currentUser = { uid: 'owner' };
  updatePassword.mockRejectedValueOnce({ code: 'auth/requires-recent-login' });
  await expect(session.updateUser({ senha: 'nova123' })).rejects.toThrow('Refaça login');
  expect(updatePassword).toHaveBeenCalledWith(auth.currentUser, 'nova123');
});

test('registration stores displayName in Auth, keeps the optional photo local and grants only ACS', async () => {
  const user = { uid: 'registered', email: 'ana@example.test' };
  auth.currentUser = user;
  createUserWithEmailAndPassword.mockResolvedValue({ user });
  getDoc.mockResolvedValue({ exists: () => false });
  updateProfile.mockImplementationOnce(async (target, patch) => Object.assign(target, patch));
  await act(async () => session.signUp('ana@example.test', 'senha123', { name: 'Ana Lima', photoUri: 'file:///profile.jpg', role: 'coordenador' }));
  expect(updateProfile).toHaveBeenCalledWith(user, { displayName: 'Ana Lima' });
  expect(session.user.displayName).toBe('Ana Lima');
  expect(session.role).toBe('acs');
  expect(await AsyncStorage.getItem('@sismorcego:registered:profilePhoto')).toBe('file:///profile.jpg');
  expect(await AsyncStorage.getItem('@sismorcego:registered:reporter')).toBe('Ana Lima');
});

test('renaming the account updates the reporter without changing its local photo or accepting a file URL in Auth', async () => {
  auth.currentUser = { uid: 'owner', displayName: 'Ana', email: 'ana@example.test' };
  await AsyncStorage.setItem('@sismorcego:owner:profilePhoto', 'file:///photo.jpg');
  updateProfile.mockImplementationOnce(async (target, patch) => Object.assign(target, patch));
  await act(async () => session.updateUser({ nome: 'Ana Lima' }));
  expect(session.user.displayName).toBe('Ana Lima');
  expect(await AsyncStorage.getItem('@sismorcego:owner:reporter')).toBe('Ana Lima');
  expect(await AsyncStorage.getItem('@sismorcego:owner:profilePhoto')).toBe('file:///photo.jpg');
  await expect(session.updateUser({ foto: 'file:///photo.jpg' })).rejects.toThrow('Storage');
});

test('a failure after Auth creates the account preserves a recoverable session instead of requiring duplicate signup',async()=>{
  const user={uid:'partial',email:'partial@example.invalid'};
  auth.currentUser=user;createUserWithEmailAndPassword.mockResolvedValue({user});
  updateProfile.mockRejectedValueOnce(new Error('network'));
  await act(async()=>{await expect(session.signUp(user.email,'senha123',{name:'Pessoa fictícia'})).rejects.toMatchObject({code:'auth/profile-incomplete'});});
  expect(session.user.uid).toBe('partial');expect(session.role).toBe('acs');expect(session.loading).toBe(false);
});
