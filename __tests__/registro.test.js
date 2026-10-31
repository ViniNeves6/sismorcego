/**
 * Fase 3: Novo Registro, Buscar e serviços de histórico/PDF.
 */
import React from 'react';
jest.mock('../src/hooks/useAuth', () => ({ __esModule: true, default: () => ({ user: { uid: 'acs', displayName: 'Ana' }, role: 'acs' }) }));
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
jest.mock('react-native-tts', () => ({
  setDefaultLanguage: jest.fn(),
  setDucking: jest.fn(),
  stop: jest.fn(),
  speak: jest.fn(),
}));
jest.mock('react-native-maps', () => ({ __esModule: true, default: 'MapView', Marker: 'Marker' }));
jest.mock('react-native-pdf', () => 'Pdf');
jest.mock('react-native-fs', () => ({
  exists: jest.fn().mockResolvedValue(true),
  readFile: jest.fn(),
  writeFile: jest.fn(),
  mkdir: jest.fn(),
  copyFile: jest.fn(),
  unlink: jest.fn(),
  DocumentDirectoryPath: '/docs',
  CachesDirectoryPath: '/cache',
}));
jest.mock('react-native-image-resizer', () => ({ createResizedImage: jest.fn() }));
jest.mock('react-native-image-picker', () => ({ launchCamera: jest.fn(), launchImageLibrary: jest.fn() }));
jest.mock('@react-native-community/geolocation', () => ({
  getCurrentPosition: jest.fn(),
  requestAuthorization: jest.fn(),
}));
jest.mock('@react-native-community/datetimepicker', () => 'DateTimePicker');
jest.mock('@react-native-community/netinfo', () => ({
  addEventListener: jest.fn(() => () => {}),
  fetch: jest.fn().mockResolvedValue({ isConnected: false }),
}));
jest.mock('@react-navigation/native', () => ({
  useFocusEffect: (cb) => require('react').useEffect(cb, [cb]),
}));
jest.mock('react-native-get-random-values', () => ({}));
jest.mock('nanoid', () => ({ nanoid: () => 'rec-123' }));
jest.mock('firebase/firestore', () => ({
  collection: jest.fn(),
  getDocs: jest.fn(),
  query: jest.fn(),
  orderBy: jest.fn(),
  limit: jest.fn(),
}));
jest.mock('../src/services/firebase', () => ({ auth: { currentUser: { uid: 'u1' } }, db: null }));
jest.mock('../src/services/syncRegistros', () => ({ syncPendingRegistros: jest.fn().mockResolvedValue(0) }));
jest.mock('../src/services/offlineQueue', () => ({
  addToQueue: jest.fn().mockResolvedValue(undefined),
  loadQueue: jest.fn(),
}));

import { AccessibilityProvider } from '../src/hooks/useAccessibility';
import { ThemeProvider } from '../src/theme/ThemeProvider';
import { ToastProvider } from '../src/ui';
import NovoRegistro from '../src/pages/Main/NovoRegistro';
import Buscar from '../src/pages/Main/Buscar';
import { addToQueue, loadQueue } from '../src/services/offlineQueue';
import { mergeByRecordId } from '../src/services/historico';
import { formatarDataCurta, formatarSexo, formatarTratamento, safeFileName } from '../src/services/registroPdf';

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

beforeEach(() => jest.clearAllMocks());

// Desmonta para limpar timers (ex.: do toast) antes do fim do teste.
afterEach(() => {
  act(() => {
    while (mounted.length) mounted.pop().unmount();
  });
});

describe('NovoRegistro', () => {
  const nav = { navigate: jest.fn(), setParams: jest.fn() };
  test('mostra os dados comuns e os quatro destinos por tipo de vítima', async () => {
    const tree = await render(<NovoRegistro navigation={nav} route={{ params: {} }} />);
    expect(texts(tree)).toEqual(expect.arrayContaining(['Novo registro', 'Notificador', 'Ocorrência', 'Localização', 'Humano', 'Canino / Felino', 'Aves', 'Animal de produção']));
  });
  test('impede avançar sem os dados comuns obrigatórios', async () => {
    const tree = await render(<NovoRegistro navigation={nav} route={{ params: {} }} />);
    await press(tree, { accessibilityRole: 'button', accessibilityLabel: 'Humano' });
    expect(nav.navigate).not.toHaveBeenCalled();
    expect(texts(tree)).toEqual(expect.arrayContaining(['Informe o nome do notificador.', 'Informe o município da mordedura.']));
  });
  test('encaminha os dados reais para o formulário específico', async () => {
    const tree = await render(<NovoRegistro navigation={nav} route={{ params: {} }} />);
    await type(tree, 'Nome do notificador', ' Maria Souza ');
    await type(tree, 'Município da mordedura', 'Curuçá');
    await press(tree, { accessibilityRole: 'button', accessibilityLabel: 'Aves' });
    expect(nav.navigate).toHaveBeenCalledWith('RegistroAves', { comum: expect.objectContaining({ nomeNotificador: 'Maria Souza', municipio: 'Curuçá', location: null, photoBase64: null }) });
    expect(addToQueue).not.toHaveBeenCalled();
  });
});

describe('Buscar', () => {
  const nav = { navigate: jest.fn() };
  const registros = [
    { recordId: 'a', uid: 'u1', municipio: 'Curuçá', nomeAgredido: 'João', status: 'pending', dataRegistro: '2024-03-05T12:00:00.000Z', createdAt: '2024-03-05T12:00:00.000Z' },
    { recordId: 'b', uid: 'u1', municipio: 'Belém', nomeAgredido: 'Ana', status: 'synced', dataRegistro: '2024-03-06T12:00:00.000Z', createdAt: '2024-03-06T12:00:00.000Z' },
  ];

  test('lista registros com status legível', async () => {
    loadQueue.mockResolvedValue(registros);
    const tree = await render(<Buscar navigation={nav} />);
    expect(texts(tree)).toEqual(expect.arrayContaining(['Curuçá', 'Belém', 'Pendente', 'Enviado', '2 registros']));
  });

  test('busca ignora acento e filtro por envio funciona', async () => {
    loadQueue.mockResolvedValue(registros);
    const tree = await render(<Buscar navigation={nav} />);

    await type(tree, 'Buscar registros', 'curuca');
    expect(texts(tree)).toContain('Curuçá');
    expect(texts(tree)).not.toContain('Belém');

    await type(tree, 'Buscar registros', '');
    await press(tree, { accessibilityRole: 'radio', accessibilityLabel: 'Enviados' });
    expect(texts(tree)).toContain('Belém');
    expect(texts(tree)).not.toContain('Curuçá');
  });

  test('estado vazio convida a criar um registro', async () => {
    loadQueue.mockResolvedValue([]);
    const tree = await render(<Buscar navigation={nav} />);
    expect(texts(tree)).toContain('Nenhum registro ainda');
    await press(tree, { accessibilityRole: 'button', accessibilityLabel: 'Novo registro' });
    expect(nav.navigate).toHaveBeenCalledWith('Registrar');
  });

  test('tocar num registro abre as opções de PDF', async () => {
    loadQueue.mockResolvedValue(registros);
    const tree = await render(<Buscar navigation={nav} />);
    const card = tree.root.find(
      (n) => n.props.accessibilityRole === 'button' && String(n.props.accessibilityLabel).includes('Curuçá') && n.props.onPress,
    );
    await act(async () => card.props.onPress());
    expect(texts(tree)).toEqual(expect.arrayContaining(['Ficha completa', 'Sem localização', 'Sem nomes']));
  });
});

describe('serviços', () => {
  test('mergeByRecordId: alteração local pendente vence a cópia antiga da nuvem', () => {
    const local = [
      { recordId: 'a', status: 'pending', createdAt: '2024-01-01T00:00:00.000Z' },
      { recordId: 'c', status: 'pending', createdAt: '2024-03-01T00:00:00.000Z' },
    ];
    const cloud = [{ recordId: 'a', status: 'synced', createdAt: '2024-01-01T00:00:00.000Z' }];
    const out = mergeByRecordId(cloud, local);
    expect(out.map((r) => r.recordId)).toEqual(['c', 'a']);
    expect(out.find((r) => r.recordId === 'a')).toMatchObject({ status: 'pending', _origin: 'local' });
  });

  test('formatadores do PDF', () => {
    expect(formatarDataCurta('2024-03-05T12:00:00.000Z')).toBe('05/03/2024');
    expect(formatarDataCurta('2026-10-01')).toBe('01/10/2026');
    expect(formatarDataCurta(null)).toBe('-');
    expect(formatarSexo('M')).toBe('Masculino');
    expect(formatarTratamento('nao')).toBe('Não');
    expect(safeFileName('São José do Ê')).toBe('Ficha_Sao_Jose_do_E');
  });
});
