/**
 * @format
 */

import React from 'react';
import ReactTestRenderer, { act } from 'react-test-renderer';
import Navigation from '../src/navigation';

let mockAuth: any = { user: null, role: null, loading: false };
jest.mock('../src/hooks/useAuth', () => ({ __esModule: true, default: () => mockAuth }));
jest.mock('../src/navigation/AuthStack', () => 'AuthStack');
// Route assertions run after startup; timing and ordering have their own suite.
jest.mock('../src/navigation/StartupSplash', () => ({ ready, onExited }: any) => {
  require('react').useEffect(() => { if (ready) onExited(); }, [ready, onExited]);
  return null;
});
jest.mock('../src/navigation/SismorcegoShell', () => 'SismorcegoShell');
jest.mock('../src/pages/Main/Painel', () => 'Painel');
jest.mock('../src/pages/Main/Notificacoes', () => 'Notificacoes');
jest.mock('@react-navigation/native', () => ({ NavigationContainer: ({ children }: any) => children }));
jest.mock('@react-navigation/native-stack', () => ({ createNativeStackNavigator: () => ({
  Navigator: ({ children }: any) => children,
  Screen: ({ component: Component, children }: any) => Component ? <Component /> : children({}),
}) }));

test('requires login instead of bypassing authentication in development', async () => {
  let tree: any;
  await act(async () => { tree = ReactTestRenderer.create(<Navigation />); });
  expect(tree.root.findAllByType('AuthStack')).toHaveLength(1);
  expect(tree.root.findAllByType('SismorcegoShell')).toHaveLength(0);
  await act(async () => tree.unmount());
});

test('both roles use the shell and legacy administrative screens are not mounted as alternate routes', async () => {
  let tree: any;
  mockAuth = { user: { uid: 'acs' }, role: 'acs', loading: false };
  await act(async () => { tree = ReactTestRenderer.create(<Navigation />); });
  expect(tree.root.findAllByType('SismorcegoShell')).toHaveLength(1);
  expect(tree.root.findAllByType('Painel')).toHaveLength(0);
  mockAuth = { user: { uid: 'coord' }, role: 'coordenador', loading: false };
  await act(async () => tree.update(<Navigation />));
  expect(tree.root.findAllByType('SismorcegoShell')).toHaveLength(1);
  expect(tree.root.findAllByType('Painel')).toHaveLength(0);
  expect(tree.root.findAllByType('Notificacoes')).toHaveLength(0);
  await act(async () => tree.unmount());
});
