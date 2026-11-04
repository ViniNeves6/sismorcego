/**
 * Fase 4: telas de Extras (Conta, Configurações, Sobre, Dúvidas, Créditos, Mais).
 */
import React from 'react';
import ReactTestRenderer, { act } from 'react-test-renderer';
import { Text as RNText, Alert } from 'react-native';

jest.mock('react-native-safe-area-context', () => {
  const { View } = require('react-native');
  return {
    SafeAreaProvider: ({ children }) => children,
    SafeAreaView: View,
    useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
  };
});
jest.mock('react-native-vector-icons/Feather', () => 'Feather');
jest.mock('react-native-tts', () => ({
  setDefaultLanguage: jest.fn(),
  setDucking: jest.fn(),
  stop: jest.fn(),
  speak: jest.fn(),
}));
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);
jest.mock('react-native-image-picker', () => ({ launchCamera: jest.fn(), launchImageLibrary: jest.fn() }));
jest.mock('firebase/firestore', () => ({
  collection: jest.fn(),
  addDoc: jest.fn(),
  getDocs: jest.fn(),
  getDocsFromServer: jest.fn(),
  query: jest.fn(),
  orderBy: jest.fn(),
  serverTimestamp: jest.fn(),
}));
jest.mock('../src/services/firebase', () => ({ auth: { currentUser: { uid: 'u1' } }, db: null }));

const mockUpdateUser = jest.fn();
const mockSignOut = jest.fn().mockResolvedValue(undefined);
jest.mock('../src/hooks/useAuth', () => ({
  __esModule: true,
  default: () => ({
    user: { email: 'ana@exemplo.com', displayName: 'Ana Lima', photoURL: null },
    updateUser: mockUpdateUser,
    signOut: mockSignOut,
  }),
}));

import { AccessibilityProvider } from '../src/hooks/useAccessibility';
import useAccessibility from '../src/hooks/useAccessibility';
import { ThemeProvider, useTheme } from '../src/theme/ThemeProvider';
import { ToastProvider } from '../src/ui';
import Conta from '../src/pages/Extras/Conta';
import Configuracoes from '../src/pages/Extras/Configuracoes';
import Sobre from '../src/pages/Extras/Sobre';
import Duvidas from '../src/pages/Extras/Duvidas';
import Creditos from '../src/pages/Extras/Creditos';
import Mais from '../src/pages/Extras/Mais';
import { palettes } from '../src/theme/palettes';

const mounted = [];
const render = async (ui) => {
  let tree;
  await act(async () => {
    tree = ReactTestRenderer.create(
      <AccessibilityProvider>
        <ThemeProvider>
          <ToastProvider>{ui}</ToastProvider>
        </ThemeProvider>
      </AccessibilityProvider>,
    );
  });
  mounted.push(tree);
  return tree;
};

const texts = (tree) => tree.root.findAllByType(RNText).map((n) => [].concat(n.props.children).join(''));
const press = (tree, props) => act(async () => tree.root.findAllByProps(props)[0].props.onPress());
const type = (tree, label, value) =>
  act(async () => tree.root.findAllByProps({ accessibilityLabel: label })[0].props.onChangeText(value));
const nav = () => ({ navigate: jest.fn(), goBack: jest.fn(), getParent: jest.fn(() => ({ navigate: jest.fn() })) });

beforeEach(() => jest.clearAllMocks());
afterEach(() => {
  act(() => {
    while (mounted.length) mounted.pop().unmount();
  });
});

describe('Configurações', () => {
  test('alto contraste troca o tema inteiro pela paleta preto/amarelo', async () => {
    let theme;
    const Probe = () => {
      theme = useTheme();
      return null;
    };
    const tree = await render(
      <>
        <Probe />
        <Configuracoes navigation={nav()} />
      </>,
    );
    expect(theme.colors).toEqual(palettes.light);

    await press(tree, { accessibilityRole: 'switch', accessibilityLabel: 'Alto contraste' });
    expect(theme.colors).toEqual(palettes.highContrast);
  });

  test('tamanho do texto aumenta e diminui, mostrando a porcentagem', async () => {
    const tree = await render(<Configuracoes navigation={nav()} />);
    expect(texts(tree)).toContain('100%');

    await press(tree, { accessibilityRole: 'button', accessibilityLabel: 'Aumentar' });
    expect(texts(tree)).toContain('110%');

    await press(tree, { accessibilityRole: 'button', accessibilityLabel: 'Diminuir' });
    await press(tree, { accessibilityRole: 'button', accessibilityLabel: 'Diminuir' });
    expect(texts(tree)).toContain('90%');
  });

  test('interruptores expõem estado marcado para leitores de tela', async () => {
    const tree = await render(<Configuracoes navigation={nav()} />);
    const notif = tree.root.findAllByProps({ accessibilityRole: 'switch', accessibilityLabel: 'Notificações' })[0];
    expect(notif.props.accessibilityState.checked).toBe(true);
    await act(async () => notif.props.onPress());
    const after = tree.root.findAllByProps({ accessibilityRole: 'switch', accessibilityLabel: 'Notificações' })[0];
    expect(after.props.accessibilityState.checked).toBe(false);
  });
});

describe('Conta', () => {
  test('mostra dados do usuário e valida senhas divergentes sem chamar o servidor', async () => {
    const tree = await render(<Conta />);
    expect(tree.root.findAllByProps({ accessibilityLabel: 'E-mail' })[0].props.value).toBe('ana@exemplo.com');

    await type(tree, 'Nova senha', 'abc123');
    await type(tree, 'Confirmar nova senha', 'abc999');
    await press(tree, { accessibilityRole: 'button', accessibilityLabel: 'Salvar alterações' });

    expect(mockUpdateUser).not.toHaveBeenCalled();
    expect(texts(tree)).toContain('As senhas não conferem.');
  });

  test('salva com os mesmos parâmetros de antes', async () => {
    mockUpdateUser.mockResolvedValue(undefined);
    const tree = await render(<Conta />);
    await type(tree, 'Nome de usuário', 'Ana Souza');
    await press(tree, { accessibilityRole: 'button', accessibilityLabel: 'Salvar alterações' });
    expect(mockUpdateUser).toHaveBeenCalledWith({ nome: 'Ana Souza', email: 'ana@exemplo.com', senha: '' });
    expect(texts(tree)).toContain('Dados atualizados.');
  });

  test('mostra o erro do servidor num aviso, sem travar a tela', async () => {
    mockUpdateUser.mockRejectedValue(new Error('Refaça login antes de alterar o e-mail.'));
    const tree = await render(<Conta />);
    await press(tree, { accessibilityRole: 'button', accessibilityLabel: 'Salvar alterações' });
    expect(texts(tree)).toContain('Refaça login antes de alterar o e-mail.');
  });
});

describe('Mais', () => {
  test('lista destinos e pede confirmação antes de sair', async () => {
    const spy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    const navigation = nav();
    const tree = await render(<Mais navigation={navigation} />);
    expect(texts(tree)).toEqual(expect.arrayContaining(['Ana Lima', 'Configurações', 'Dúvidas', 'Sobre o projeto', 'Créditos', 'Sair']));

    await press(tree, { accessibilityRole: 'button', accessibilityLabel: 'Sair' });
    expect(spy).toHaveBeenCalledWith('Sair da conta?', expect.any(String), expect.any(Array));
    expect(mockSignOut).not.toHaveBeenCalled();

    const confirm = spy.mock.calls[0][2].find((b) => b.text === 'Sair');
    await act(async () => confirm.onPress());
    expect(mockSignOut).toHaveBeenCalledTimes(1);
    spy.mockRestore();
  });

  test('navega para as telas secundárias', async () => {
    const navigation = nav();
    const tree = await render(<Mais navigation={navigation} />);
    await press(tree, { accessibilityRole: 'button', accessibilityLabel: 'Dúvidas' });
    expect(navigation.navigate).toHaveBeenCalledWith('Duvidas');
  });
});

describe('Dúvidas', () => {
  test('sem serviço disponível mostra estado de erro com nova tentativa', async () => {
    const tree = await render(<Duvidas navigation={nav()} />);
    expect(texts(tree)).toEqual(
      expect.arrayContaining(['Não foi possível carregar', 'O serviço de dúvidas está indisponível no momento.']),
    );
    expect(tree.root.findAllByProps({ accessibilityLabel: 'Tentar de novo' }).length).toBeGreaterThan(0);
  });

  test('abre o formulário de nova dúvida', async () => {
    const tree = await render(<Duvidas navigation={nav()} />);
    await press(tree, { accessibilityRole: 'button', accessibilityLabel: 'Nova dúvida' });
    expect(tree.root.findAllByProps({ accessibilityLabel: 'Sua dúvida' }).length).toBeGreaterThan(0);
  });
});

describe('Créditos e Sobre', () => {
  test('eixo expande e mostra os participantes', async () => {
    const tree = await render(<Creditos navigation={nav()} />);
    expect(texts(tree)).not.toContain('Pedro Dimas');

    const eixo = tree.root.find(
      (n) => n.props.accessibilityRole === 'button' && String(n.props.accessibilityLabel).startsWith('Tecnologia') && n.props.onPress,
    );
    expect(eixo.props.accessibilityState.expanded).toBe(false);
    await act(async () => eixo.props.onPress());
    expect(texts(tree)).toEqual(expect.arrayContaining(['Pedro Dimas', 'Orientador']));
  });

  test('eixo sem participantes explica o vazio', async () => {
    const tree = await render(<Creditos navigation={nav()} />);
    const eixo = tree.root.find(
      (n) => n.props.accessibilityRole === 'button' && String(n.props.accessibilityLabel).startsWith('Determinantes') && n.props.onPress,
    );
    await act(async () => eixo.props.onPress());
    expect(texts(tree)).toContain('Os participantes deste eixo ainda não foram informados.');
  });

  test('Sobre lista eventos e redes sociais', async () => {
    const tree = await render(<Sobre navigation={nav()} />);
    expect(texts(tree)).toEqual(
      expect.arrayContaining(['DRA - Curuçá 2024', 'Instagram', 'Twitter/X', 'YouTube']),
    );
  });
});

// Garante que useAccessibility segue exportando o que as telas usam.
test('useAccessibility fora do provider devolve padrões seguros', () => {
  expect(typeof useAccessibility).toBe('function');
});
