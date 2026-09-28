/**
 * Testes de renderização do design system e das telas de autenticação.
 */
import React from 'react';
import ReactTestRenderer, { act } from 'react-test-renderer';
import { Text as RNText } from 'react-native';

jest.mock('react-native-safe-area-context', () => {
  const { View } = require('react-native');
  return {
    SafeAreaProvider: ({ children }) => children,
    SafeAreaView: View,
    useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
  };
});
jest.mock('react-native-vector-icons/Feather', () => 'Feather');
jest.mock('react-native-linear-gradient', () => 'LinearGradient');
jest.mock('react-native-tts', () => ({
  setDefaultLanguage: jest.fn(),
  setDucking: jest.fn(),
  stop: jest.fn(),
  speak: jest.fn(),
}));
jest.mock('../src/hooks/useAuth', () => ({
  __esModule: true,
  default: () => ({
    signIn: jest.fn(),
    signUp: jest.fn(),
    resetPassword: jest.fn(),
  }),
}));

import { AccessibilityProvider } from '../src/hooks/useAccessibility';
import { ThemeProvider, useTheme } from '../src/theme/ThemeProvider';
import { palettes } from '../src/theme/palettes';
import { Button, TextField, Select, Badge, EmptyState, ListGroup, ListRow, ToastProvider } from '../src/ui';
import Login from '../src/pages/Auth/Login';
import Cadastro from '../src/pages/Auth/Cadastro';
import EsqueciSenha from '../src/pages/Auth/EsqueciSenha';

const wrap = (ui) => (
  <AccessibilityProvider>
    <ThemeProvider>
      <ToastProvider>{ui}</ToastProvider>
    </ThemeProvider>
  </AccessibilityProvider>
);

const render = async (ui) => {
  let tree;
  await act(async () => {
    tree = ReactTestRenderer.create(wrap(ui));
  });
  return tree;
};

const texts = (tree) =>
  tree.root.findAllByType(RNText).map((n) => [].concat(n.props.children).join(''));

describe('tema', () => {
  test('usa a paleta clara por padrão e expõe tokens', async () => {
    let captured;
    const Probe = () => {
      captured = useTheme();
      return null;
    };
    await render(<Probe />);
    expect(captured.colors).toEqual(palettes.light);
    expect(captured.spacing.lg).toBe(16);
    expect(captured.type.body.fontSize).toBe(16);
  });
});

describe('componentes', () => {
  test('Button expõe papel, nome e estado desabilitado', async () => {
    const onPress = jest.fn();
    const tree = await render(<Button title="Salvar" onPress={onPress} disabled />);
    const btn = tree.root.findByProps({ accessibilityRole: 'button' });
    expect(btn.props.accessibilityLabel).toBe('Salvar');
    expect(btn.props.accessibilityState.disabled).toBe(true);
  });

  test('Button em loading fica ocupado e sem ação', async () => {
    const tree = await render(<Button title="Entrar" onPress={() => {}} loading />);
    const btn = tree.root.findByProps({ accessibilityRole: 'button' });
    expect(btn.props.accessibilityState).toEqual({ disabled: true, busy: true });
  });

  test('TextField mostra rótulo e erro com ícone', async () => {
    const tree = await render(<TextField label="E-mail" value="" onChangeText={() => {}} error="Digite seu e-mail." />);
    expect(texts(tree)).toEqual(expect.arrayContaining(['E-mail', 'Digite seu e-mail.']));
    expect(tree.root.findAllByType('Feather').some((i) => i.props.name === 'alert-circle')).toBe(true);
  });

  test('TextField de senha alterna mostrar/ocultar', async () => {
    const tree = await render(<TextField label="Senha" value="abc123" onChangeText={() => {}} secureTextEntry />);
    const input = () => tree.root.findByProps({ accessibilityLabel: 'Senha' });
    expect(input().props.secureTextEntry).toBe(true);
    const toggle = tree.root.findByProps({ accessibilityLabel: 'Mostrar senha' });
    await act(async () => toggle.props.onPress());
    expect(input().props.secureTextEntry).toBe(false);
    expect(tree.root.findByProps({ accessibilityLabel: 'Ocultar senha' })).toBeTruthy();
  });

  test('Select mostra o rótulo da opção escolhida', async () => {
    const tree = await render(
      <Select
        label="Sexo"
        value="F"
        onChange={() => {}}
        options={[
          { value: 'M', label: 'Masculino' },
          { value: 'F', label: 'Feminino' },
        ]}
      />,
    );
    expect(texts(tree)).toContain('Feminino');
  });

  test('Badge, EmptyState e ListRow renderizam conteúdo', async () => {
    const onAction = jest.fn();
    const tree = await render(
      <>
        <Badge label="Pendente" tone="warning" icon="clock" />
        <EmptyState icon="search" title="Nenhum registro" description="Ajuste os filtros." actionLabel="Limpar filtros" onAction={onAction} />
        <ListGroup>
          <ListRow icon="settings" title="Configurações" onPress={() => {}} />
          <ListRow icon="log-out" title="Sair" tone="danger" onPress={() => {}} />
        </ListGroup>
      </>,
    );
    expect(texts(tree)).toEqual(expect.arrayContaining(['Pendente', 'Nenhum registro', 'Configurações', 'Sair']));
  });
});

describe('telas de autenticação', () => {
  const navigation = { navigate: jest.fn(), goBack: jest.fn() };

  test('Login renderiza campos e ações', async () => {
    const tree = await render(<Login navigation={navigation} />);
    expect(texts(tree)).toEqual(expect.arrayContaining(['Sismorcego', 'Entrar', 'E-mail', 'Senha', 'Criar conta']));
  });

  test('Login valida campos vazios inline, sem chamar o Firebase', async () => {
    const tree = await render(<Login navigation={navigation} />);
    const submit = tree.root.findAllByProps({ accessibilityRole: 'button', accessibilityLabel: 'Entrar' })[0];
    await act(async () => submit.props.onPress());
    expect(texts(tree)).toEqual(expect.arrayContaining(['Digite seu e-mail.', 'Digite sua senha.']));
  });

  test('Cadastro valida senhas divergentes', async () => {
    const tree = await render(<Cadastro navigation={navigation} />);
    const set = (label, v) =>
      act(async () => tree.root.findByProps({ accessibilityLabel: label }).props.onChangeText(v));
    await set('E-mail', 'a@b.com');
    await set('Senha', 'abc123');
    await set('Confirmar senha', 'abc124');
    const submit = tree.root.findAllByProps({ accessibilityRole: 'button', accessibilityLabel: 'Criar conta' })[0];
    await act(async () => submit.props.onPress());
    expect(texts(tree)).toContain('As senhas não conferem.');
  });

  test('EsqueciSenha renderiza', async () => {
    const tree = await render(<EsqueciSenha navigation={navigation} />);
    expect(texts(tree)).toEqual(expect.arrayContaining(['Redefinir senha', 'Enviar link']));
  });
});
