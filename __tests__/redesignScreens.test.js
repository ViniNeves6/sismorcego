import React from 'react';
import ReactTestRenderer, { act } from 'react-test-renderer';
import { ScrollView, TextInput, Text as RNText, StyleSheet } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import MaisScreens from '../src/pages/Extras/MaisScreens';
import RegistrosScreen from '../src/pages/Main/RegistrosScreen';
import { AccessibilityProvider } from '../src/hooks/useAccessibility';
import { Text } from '../src/ui/AccessibleNative';
import { pickRegistroPhoto } from '../src/services/deviceCapture';
import { canAccessCoordinatorArea } from '../src/services/roleAccess';

jest.mock('../src/services/redesignData', () => ({}));
jest.mock('../src/services/deviceCapture', () => ({ pickRegistroPhoto: jest.fn() }));
jest.mock('react-native-svg', () => ({ __esModule: true, default: 'Svg', Path: 'Path', Circle: 'Circle', Rect: 'Rect', Line: 'Line', Polyline: 'Polyline' }));
jest.mock('react-native-linear-gradient', () => 'LinearGradient');

const defaults = () => ({
  activeSubscreen: 'sub-password', setActiveSubscreen: jest.fn(), accountProfile: { username: 'Ana', email: 'ana@real.org' },
  doubts: [], doubtsView: 'list', answeredDoubts: [], setDoubtsView: jest.fn(),
  onChangePassword: jest.fn().mockResolvedValue(), onResetPassword: jest.fn().mockResolvedValue(),
  onSaveAccountProfile: jest.fn().mockResolvedValue(), onCreateDoubt: jest.fn().mockResolvedValue(),
  onSaveAvatarPhoto: jest.fn().mockResolvedValue(),
  showToast: jest.fn(), accessibility: { reduceMotion: true, fontScale: 1 },
});
let tree;
const render = async props => { await act(async () => { tree = ReactTestRenderer.create(<MaisScreens {...props} />); }); };
const texts = () => tree.root.findAllByType(RNText).map(n => n.props.children).filter(x => typeof x === 'string');
const press = async label => {
  const button = tree.root.findAll(node => typeof node.props.onPress === 'function' && node.findAllByType(RNText).some(text => text.props.children === label))[0];
  if (!button) throw new Error(`Button missing: ${label}`);
  await act(async () => button.props.onPress());
};
afterEach(async () => { if (tree) await act(async () => tree.unmount()); tree = null; await AsyncStorage.clear(); });

test('password success depends on Firebase update; rejection retains form and stays on screen', async () => {
  const props = defaults();
  props.onChangePassword.mockRejectedValue(new Error('Refaça login para alterar a senha.'));
  await render(props);
  await act(async () => {
    tree.root.findAllByType(TextInput)[0].props.onChangeText('senha123');
    tree.root.findAllByType(TextInput)[1].props.onChangeText('senha123');
  });
  await press('Salvar nova senha');
  expect(props.onChangePassword).toHaveBeenCalledWith('senha123');
  expect(props.showToast).toHaveBeenCalledWith('Refaça login para alterar a senha.');
  expect(props.showToast).not.toHaveBeenCalledWith('Senha alterada com sucesso!');
  expect(props.setActiveSubscreen).not.toHaveBeenCalled();
  expect(tree.root.findAllByType(TextInput)[0].props.value).toBe('senha123');
});
test('account save waits for real update and reports failure instead of success', async () => {
  const props = { ...defaults(), activeSubscreen: 'sub-account' };
  props.onSaveAccountProfile.mockRejectedValue(new Error('Email já cadastrado.'));
  await render(props); await press('Salvar alterações');
  expect(props.showToast).toHaveBeenCalledWith('Email já cadastrado.');
  expect(props.showToast).not.toHaveBeenCalledWith('Perfil atualizado!');
});
test('avatar persists locally without submitting unsaved profile fields to Firebase', async () => {
  const props = { ...defaults(), activeSubscreen: 'sub-account' };
  pickRegistroPhoto.mockResolvedValue({ localUri: 'file:///avatar.jpg' });
  await render(props); await press('Galeria');
  expect(props.onSaveAvatarPhoto).toHaveBeenCalledWith('file:///avatar.jpg');
  expect(props.onSaveAccountProfile).not.toHaveBeenCalled();
});
test('doubt send uses real callback, preserves text on rejection, and displays actual answers', async () => {
  const props = { ...defaults(), activeSubscreen: 'sub-faq', doubtsView: 'compose' };
  props.onCreateDoubt.mockRejectedValue(new Error('Sem conexão.'));
  await render(props);
  await act(async () => tree.root.findByType(TextInput).props.onChangeText('Como consultar o registro enviado?'));
  await press('Enviar pergunta');
  expect(props.onCreateDoubt).toHaveBeenCalledWith('Como consultar o registro enviado?', null);
  expect(props.setDoubtsView).not.toHaveBeenCalled();
  expect(tree.root.findByType(TextInput).props.value).toBe('Como consultar o registro enviado?');
  await act(async () => tree.update(<MaisScreens {...props} doubtsView="faq" answeredDoubts={[{ id: 'q1', question: 'Pergunta real', answer: 'Resposta publicada pela equipe' }]} />));
  expect(texts()).toContain('Resposta publicada pela equipe');
});

test('only the question history scrolls as questions arrive; shortcuts and heading stay outside it', async () => {
  const props = { ...defaults(), activeSubscreen: 'sub-faq' };
  const questions = Array.from({ length: 20 }, (_, i) => ({
    id: `q${i}`, question: `Pergunta ${i}`, createdAt: '29/10/2026, 22:31:15',
  }));
  await render({ ...props, doubts: questions.slice(0, 1) });
  for (const count of [1, 2, 20, 1]) {
    await act(async () => tree.update(<MaisScreens {...props} doubts={questions.slice(0, count)} />));
    const scrolls = tree.root.findAllByType(ScrollView);
    expect(scrolls).toHaveLength(1);
    const historyTexts = scrolls[0].findAllByType(RNText).map(n => n.props.children);
    expect(scrolls[0].props.accessibilityLabel).toBe('Minhas perguntas');
    expect(historyTexts).toContain(`Pergunta ${count - 1}`);
    expect(historyTexts).not.toContain('Nova dúvida');
    expect(historyTexts).not.toContain('Perguntas frequentes');
    expect(historyTexts).not.toContain(`Minhas perguntas (${count})`);
    expect(texts()).toContain(`Minhas perguntas (${count})`);
  }
  await press('Nova dúvida');
  expect(props.setDoubtsView).toHaveBeenLastCalledWith('compose');
  await press('Perguntas frequentes');
  expect(props.setDoubtsView).toHaveBeenLastCalledWith('faq');
  await act(async () => tree.update(<MaisScreens {...props} doubts={[]} />));
  expect(tree.root.findAllByType(ScrollView)).toHaveLength(0);
  expect(texts()).toContain('Nenhuma dúvida registrada');
});

test('expanding and collapsing a long question keeps it in the same scrolling history', async () => {
  const question = 'Pergunta longa sobre o registro e seu acompanhamento. '.repeat(8);
  await render({ ...defaults(), activeSubscreen: 'sub-faq', doubts: [{ id: 'q1', question, createdAt: '29/10/2026' }] });
  const history = tree.root.findByType(ScrollView);
  const questionNode = () => history.findAllByType(RNText).find(node => node.props.children === question);
  expect(questionNode().props.numberOfLines).toBe(3);
  await press('… Ler mais');
  expect(tree.root.findByType(ScrollView)).toBe(history);
  expect(questionNode().props.numberOfLines).toBeUndefined();
  await press('Ler menos');
  expect(tree.root.findByType(ScrollView)).toBe(history);
  expect(questionNode().props.numberOfLines).toBe(3);
});
test('saved font scale and high contrast affect redesign text, not only the settings sample', async () => {
  await AsyncStorage.setItem('@sismorcego:accessibility', JSON.stringify({ fontScale: 1.3, highContrast: true }));
  await act(async () => { tree = ReactTestRenderer.create(<AccessibilityProvider><Text style={{ fontSize: 20, color: '#181126' }}>Registro real</Text></AccessibilityProvider>); });
  const text = tree.root.findByType(RNText);
  expect(StyleSheet.flatten(text.props.style)).toMatchObject({ fontSize: 26, color: '#FFFFFF' });
});
test('redesign search keeps the old accent-insensitive behavior for municipality and victim names', async () => {
  await act(async () => { tree = ReactTestRenderer.create(<RegistrosScreen records={[{ id: 'r1', title: 'Humano', city: 'Curuçá', details: { nome: 'João' }, status: 'failed', statusLabel: 'Falha no envio' }]} />); });
  for (const query of ['curuca', 'joao']) {
    await act(async () => tree.root.findByType(TextInput).props.onChangeText(query));
    expect(texts()).toContain('Município de Curuçá');
    expect(texts()).toContain('Falha no envio');
  }
});

test('records have no notification bell while pending records, filtering, sync and help remain usable', async () => {
  const onSyncNow = jest.fn();
  const onSelectRecord = jest.fn();
  const onOpenHowTo = jest.fn();
  await act(async () => {
    tree = ReactTestRenderer.create(<RegistrosScreen
      records={[
        { id: 'pending', title: 'Humano', city: 'Curuçá', status: 'pending', statusLabel: 'Aguardando envio' },
        { id: 'sent', title: 'Aves', city: 'Belém', status: 'synced', statusLabel: 'Enviado' },
      ]}
      pendingOperations={3} onSyncNow={onSyncNow} onSelectRecord={onSelectRecord} onOpenHowTo={onOpenHowTo}
    />);
  });
  expect(tree.root.findAll(node => String(node.props.accessibilityLabel || '').startsWith('Notificações:'))).toHaveLength(0);
  expect(texts()).toContain('3 alterações aguardando envio');
  await press('Sincronizar agora');
  expect(onSyncNow).toHaveBeenCalledTimes(1);
  await press('Pendentes');
  expect(texts()).toContain('Município de Curuçá');
  expect(texts()).not.toContain('Município de Belém');
  await press('Município de Curuçá');
  expect(onSelectRecord).toHaveBeenCalledWith(expect.objectContaining({ id: 'pending' }));
  await act(async () => tree.root.findAll(node => node.props.accessibilityLabel === 'Como usar o aplicativo')[0].props.onPress());
  expect(onOpenHowTo).toHaveBeenCalledTimes(1);
});

test('More omits administrative shortcuts for both roles and preserves ACS system preferences', async () => {
  const props = { ...defaults(), activeSubscreen: null };
  await render({ ...props, coordinator: canAccessCoordinatorArea('acs') });
  expect(texts()).not.toContain('Notificações (2)');
  expect(texts()).not.toContain('Painel dos registros de todos os agentes');
  await act(async () => tree.update(<MaisScreens {...props} coordinator={canAccessCoordinatorArea('coordenador')} />));
  expect(texts()).not.toContain('Notificações (2)');
  expect(texts()).not.toContain('Painel dos registros de todos os agentes');
  await act(async () => tree.update(<MaisScreens {...props} coordinator={false} />));
  expect(texts()).not.toContain('Notificações (2)');
  const onToggleNotifications = jest.fn();
  await act(async () => tree.update(<MaisScreens {...props} activeSubscreen="sub-settings"
    coordinator={false} notificationsEnabled onToggleNotifications={onToggleNotifications} />));
  expect(texts()).not.toContain('AVISOS');
  expect(texts()).not.toContain('Notificações');
  expect(texts()).not.toContain('Receber avisos do SisMorcego');
  expect(texts()).toEqual(expect.arrayContaining([
    'Alto contraste', 'Leitura em voz alta', 'Reduzir animações', 'Tamanho do texto',
  ]));
  expect(tree.root.findAll(node => typeof node.props.onToggle === 'function')).toHaveLength(3);
  expect(onToggleNotifications).not.toHaveBeenCalled();

  await act(async () => tree.update(<MaisScreens {...props} activeSubscreen="sub-settings"
    coordinator={canAccessCoordinatorArea('coordenador')} notificationsEnabled onToggleNotifications={onToggleNotifications} />));
  expect(texts()).toContain('AVISOS');
  expect(texts()).toContain('Alertas no aplicativo');
  expect(texts()).toContain('Disponíveis na central com o app aberto e conectado. Push com o app fechado ainda indisponível.');
  const switches = tree.root.findAll(node => typeof node.props.onToggle === 'function');
  expect(switches).toHaveLength(3);
  expect(onToggleNotifications).not.toHaveBeenCalled();
});
