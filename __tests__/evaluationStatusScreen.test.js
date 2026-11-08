import React from 'react';
import Renderer, { act } from 'react-test-renderer';
import { Text, ActivityIndicator, TextInput, BackHandler } from 'react-native';
import EvaluationSetupScreen, { loginErrorMessage } from '../src/pages/Auth/EvaluationSetupScreen';
let mockStatus='checking', mockReason=null; const mockRetry=jest.fn(), mockSignInAcs=jest.fn(), mockSignIn=jest.fn(), mockSignOut=jest.fn();
jest.mock('../src/hooks/useAuth',()=>()=>({evaluation:{status:mockStatus,reason:mockReason},retrySession:mockRetry,
  signInAcs:mockSignInAcs,signIn:mockSignIn,signOut:mockSignOut}));
jest.mock('../src/hooks/useSpeakOnMount',()=>jest.fn());
jest.mock('../src/hooks/useAccessibility',()=>()=>({highContrast:false,settings:{fontScale:1}}));
jest.mock('../src/ui/MainScreenHeader',()=> 'MainScreenHeader');
jest.mock('../src/ui/AnimatedScreenTransition',()=> ({children})=>children);
let tree;
beforeEach(()=>{mockStatus='checking';mockReason=null;[mockRetry,mockSignInAcs,mockSignIn,mockSignOut].forEach(fn=>{fn.mockReset();fn.mockResolvedValue();});});
afterEach(async()=>{if(tree)await act(async()=>tree.unmount());tree=null;jest.restoreAllMocks();});
const render=async()=>{await act(async()=>{tree=Renderer.create(<EvaluationSetupScreen/>);});};
const labels=()=>tree.root.findAllByType(Text).map(n=>n.props.children).flat().filter(s=>typeof s==='string').join(' ');
const button=label=>tree.root.find(n=>n.props.accessibilityRole==='button'&&typeof n.props.onPress==='function'&&String(n.props.accessibilityLabel||'').startsWith(label));
const press=async label=>act(async()=>{await button(label).props.onPress();});
const type=async(index,value)=>act(async()=>tree.root.findAllByType(TextInput)[index].props.onChangeText(value));

test.each(['checking','expired','suspended','offline','blocked','unavailable','not-started'])('%s has only automatic evaluation status and no manual setup controls',async status=>{
  mockStatus=status;await render();
  expect(labels()).not.toMatch(/Configurar aparelho|Importar|Código|senha|e-mail|cadastro/i);
  expect(tree.root.findAllByType(TextInput)).toHaveLength(0);
  if(status==='checking')expect(tree.root.findAllByType(ActivityIndicator)).toHaveLength(1);
  else { expect(labels()).toContain('Tentar novamente'); expect(labels()).toContain('Trocar perfil'); }
});
test('a status screen can go back to the profile choice',async()=>{
  mockStatus='expired';await render();await press('Trocar perfil');expect(mockSignOut).toHaveBeenCalledTimes(1);
});
test('signed-out offers ACS and Coordenador; ACS enters directly without any field',async()=>{
  mockStatus='signed-out';await render();
  expect(labels()).toContain('Sou ACS');expect(labels()).toContain('Sou coordenador');
  expect(tree.root.findAllByType(TextInput)).toHaveLength(0);
  await press('Sou ACS');expect(mockSignInAcs).toHaveBeenCalledTimes(1);expect(mockSignIn).not.toHaveBeenCalled();
});
test('ACS failure is shown on the choice screen',async()=>{
  mockStatus='signed-out';mockSignInAcs.mockRejectedValue(Object.assign(new Error(),{code:'network/offline'}));
  await render();await press('Sou ACS');expect(labels()).toContain('Sem conexão com a internet');
});
test('coordinator needs e-mail and password, validates them and reports a wrong password',async()=>{
  mockStatus='signed-out';await render();await press('Sou coordenador');
  expect(tree.root.findAllByType(TextInput)).toHaveLength(2);
  await press('Entrar');expect(mockSignIn).not.toHaveBeenCalled();
  expect(labels()).toContain('Digite um e-mail válido.');expect(labels()).toContain('Digite a senha.');
  mockSignIn.mockRejectedValueOnce(Object.assign(new Error(),{code:'auth/invalid-credential'}));
  await type(0,' coord@example.invalid ');await type(1,'secret');await press('Entrar');
  expect(mockSignIn).toHaveBeenCalledWith('coord@example.invalid','secret');
  expect(labels()).toContain('E-mail ou senha incorretos.');
});
test('coordinator form returns to the choice with the button and with Android back',async()=>{
  const handlers=[];jest.spyOn(BackHandler,'addEventListener').mockImplementation((_,fn)=>{handlers.push(fn);return {remove:()=>handlers.splice(handlers.indexOf(fn),1)};});
  mockStatus='signed-out';await render();await press('Sou coordenador');
  await press('Voltar');expect(labels()).toContain('Sou ACS');
  await press('Sou coordenador');expect(handlers.length).toBeGreaterThan(0);
  let handled;await act(async()=>{handled=handlers.at(-1)();});expect(handled).toBe(true);expect(labels()).toContain('Sou ACS');
});
test('a rejected non-coordinator account explains why after returning to login',async()=>{
  mockStatus='signed-out';mockReason='evaluation/not-coordinator';await render();
  expect(labels()).toContain('Esta conta não tem acesso de coordenador.');
  expect(loginErrorMessage('auth/operation-not-allowed')).toContain('ACS');
});
