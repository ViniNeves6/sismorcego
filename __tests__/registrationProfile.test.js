import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { Animated, BackHandler } from 'react-native';
import Cadastro from '../src/pages/Auth/Cadastro';
import { pickRegistroPhoto } from '../src/services/deviceCapture';
import useAuth from '../src/hooks/useAuth';
import { profilePhotoUploadRequest, validateRegistration } from '../src/services/accountProfile';

jest.mock('../src/hooks/useAuth', () => jest.fn());
jest.mock('../src/ui/useReduceMotion', () => () => mockReduceMotion);
jest.mock('../src/services/deviceCapture', () => ({ pickRegistroPhoto: jest.fn() }));
jest.mock('../src/ui', () => ({ Avatar: 'Avatar', Button: 'Button', Text: 'Text', TextField: 'TextField', useToast: () => ({ show: jest.fn() }) }));
jest.mock('../src/pages/Auth/AuthLayout', () => ({ children }) => children);
jest.mock('../src/theme/ThemeProvider', () => ({ useTheme: () => ({ spacing: { lg: 16, sm: 8 } }) }));

let tree;
let mockReduceMotion = true;
const navigation = { goBack: jest.fn(), navigate: jest.fn() };
const signUp = jest.fn().mockResolvedValue();
const change = async (label, value) => act(async () => tree.root.findAllByType('TextField').find(field => field.props.label === label).props.onChangeText(value));
const press = async title => act(async () => tree.root.findAllByType('Button').find(button => button.props.title === title).props.onPress());
const enterCredentials = async () => {
  await change('E-mail', 'ana@example.test');
  await change('Senha', 'senha123'); await change('Confirmar senha', 'senha123');
};
const enterProfile = async () => { await enterCredentials(); await press('Continuar'); };
beforeEach(async () => {
  jest.clearAllMocks(); mockReduceMotion = true; useAuth.mockReturnValue({ signUp });
  await act(async () => { tree = TestRenderer.create(<Cadastro navigation={navigation} />); });
});
afterEach(async () => { await act(async () => tree.unmount()); jest.restoreAllMocks(); });

test('registration rejects missing name, invalid email/password and mismatched confirmation', async () => {
  expect(tree.root.findAllByType('TextField').map(field => field.props.label)).toEqual(['E-mail', 'Senha', 'Confirmar senha']);
  await press('Continuar');
  expect(tree.root.findAllByType('Avatar')).toHaveLength(0);
  expect(signUp).not.toHaveBeenCalled();
  await enterProfile(); await press('Criar conta');
  expect(signUp).not.toHaveBeenCalled();
  expect(tree.root.findAllByType('TextField').find(field => field.props.label === 'Nome de usuário').props.error).toBeTruthy();
  expect(Object.keys(validateRegistration({ name: 'Ana', email: 'bad', password: '123', confirmPassword: 'other' }))).toEqual(['email', 'password', 'confirmPassword']);
});

test('photo is optional; name drives the initials avatar and is passed with email and valid password', async () => {
  await enterProfile();
  await change('Nome de usuário', 'Ana Lima');
  expect(tree.root.findAllByType('TextField').map(field => field.props.label)).toEqual(['Nome de usuário']);
  expect(tree.root.findByType('Avatar').props).toMatchObject({ name: 'Ana Lima', uri: null, size: 144 });
  await press('Criar conta');
  expect(signUp).toHaveBeenCalledWith('ana@example.test', 'senha123', { name: 'Ana Lima', photoUri: null });
});

test.each(['Câmera', 'Galeria'])('%s reuses capture infrastructure and passes a local photo without any Storage upload', async title => {
  await enterProfile();
  pickRegistroPhoto.mockResolvedValue({ localUri: 'file:///profile.jpg' });
  await press(title);
  expect(pickRegistroPhoto).toHaveBeenCalledWith(title === 'Câmera' ? 'camera' : 'gallery');
  expect(tree.root.findByType('Avatar').props.uri).toBe('file:///profile.jpg');
  expect(profilePhotoUploadRequest('uid', 'file:///profile.jpg')).toMatchObject({ objectPath: 'profilePhotos/uid/avatar.jpg', pendingBackend: true });
  await press('Remover foto');
  expect(tree.root.findByType('Avatar').props.uri).toBeNull();
});

test('returning to credentials retains email, passwords, required name and the optional photograph', async () => {
  await enterProfile(); await change('Nome de usuário', 'Ana Lima');
  pickRegistroPhoto.mockResolvedValue({ localUri: 'file:///profile.jpg' }); await press('Galeria');
  await press('Voltar');
  expect(tree.root.findAllByType('TextField').map(field => field.props.value)).toEqual(['ana@example.test', 'senha123', 'senha123']);
  await press('Continuar');
  expect(tree.root.findByType('Avatar').props).toMatchObject({ name: 'Ana Lima', uri: 'file:///profile.jpg' });
  expect(navigation.goBack).not.toHaveBeenCalled();
});

test('forward and Android back retain the outgoing step until exit completes, then animate the next step', async () => {
  mockReduceMotion = false;
  const animations = [];
  jest.spyOn(Animated, 'timing').mockImplementation((value, config) => {
    let complete;
    const animation = { config, start: callback => { complete = callback; animations.push(animation); },
      stop: jest.fn(), finish: () => { value.setValue(config.toValue); complete?.({ finished: true }); } };
    return animation;
  });
  const back = jest.spyOn(BackHandler, 'addEventListener');
  await enterCredentials(); await press('Continuar');
  expect(tree.root.findAllByType('Avatar')).toHaveLength(0);
  expect(animations.at(-1).config.toValue).toBe(0);
  await act(async () => animations.at(-1).finish());
  expect(tree.root.findByType('Avatar').props.size).toBe(144);
  expect(animations.at(-1).config.toValue).toBe(1);
  await act(async () => animations.at(-1).finish());
  const onBack = back.mock.calls.at(-1)[1];
  await act(async () => expect(onBack()).toBe(true));
  expect(tree.root.findAllByType('Avatar')).toHaveLength(1);
  expect(animations.at(-1).config.toValue).toBe(0);
  await act(async () => animations.at(-1).finish());
  expect(tree.root.findAllByType('Avatar')).toHaveLength(0);
  expect(animations.at(-1).config.toValue).toBe(1);
  await act(async () => animations.at(-1).finish());
  expect(tree.root.findAllByType('TextField')[0].props.value).toBe('ana@example.test');
  expect(navigation.goBack).not.toHaveBeenCalled();
});
