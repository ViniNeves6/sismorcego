import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { onAuthStateChanged, signInWithEmailAndPassword } from 'firebase/auth';
import useAuth, { AuthProvider } from '../src/hooks/useAuth';

jest.mock('../src/services/debugTestSession', () => ({
  LOCAL_TEST_MODE: true,
  LOCAL_TEST_USER: { uid: 'sismorcego-debug-local', displayName: 'Agente de Teste', email: 'teste@local.invalid' },
}));
jest.mock('../src/services/firebase', () => ({ auth: { currentUser: null }, db: {} }));
jest.mock('firebase/auth', () => ({
  onAuthStateChanged: jest.fn(), signInWithEmailAndPassword: jest.fn(),
  createUserWithEmailAndPassword: jest.fn(), sendPasswordResetEmail: jest.fn(),
  signOut: jest.fn(), updateProfile: jest.fn(), updateEmail: jest.fn(), updatePassword: jest.fn(),
}));
jest.mock('firebase/firestore', () => ({ doc: jest.fn(), getDoc: jest.fn(), setDoc: jest.fn() }));
jest.mock('@react-native-community/netinfo', () => ({ fetch: jest.fn(), addEventListener: jest.fn() }));
jest.mock('../src/utils/logger', () => ({ warn: jest.fn(), error: jest.fn() }));

let session;
function Probe() { session = useAuth(); return null; }

test('Debug opens local ACS session without touching Firebase Auth', async () => {
  let tree;
  await act(async () => { tree = TestRenderer.create(<AuthProvider><Probe /></AuthProvider>); });
  expect(session).toMatchObject({
    user: { uid: 'sismorcego-debug-local', displayName: 'Agente de Teste' },
    role: 'acs', loading: false,
  });
  expect(onAuthStateChanged).not.toHaveBeenCalled();
  await expect(session.signIn('any@example.invalid', 'no-password')).rejects.toThrow('Modo de testes');
  expect(signInWithEmailAndPassword).not.toHaveBeenCalled();
  await act(async () => tree.unmount());
});
