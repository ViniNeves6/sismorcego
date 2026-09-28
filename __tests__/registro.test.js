/**
 * Fase 3: Novo Registro, Buscar e serviços de histórico/PDF.
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
  test('renderiza seções e o botão de salvar', async () => {
    const tree = await render(<NovoRegistro />);
    expect(texts(tree)).toEqual(
      expect.arrayContaining(['Novo registro', 'Responsável', 'Pessoa agredida', 'Ocorrência', 'Localização']),
    );
    expect(tree.root.findAllByProps({ accessibilityLabel: 'Salvar registro' }).length).toBeGreaterThan(0);
  });

  test('não salva sem os campos obrigatórios e mostra erros inline', async () => {
    const tree = await render(<NovoRegistro />);
    await press(tree, { accessibilityRole: 'button', accessibilityLabel: 'Salvar registro' });

    expect(addToQueue).not.toHaveBeenCalled();
    expect(texts(tree)).toEqual(
      expect.arrayContaining([
        'Informe o nome do ACS.',
        'Informe o nome da pessoa agredida.',
        'Selecione o sexo.',
        'Informe se fez tratamento antirrábico.',
        'Informe o município da agressão.',
      ]),
    );
  });

  test('salva o registro na fila com os valores gravados no formato de sempre', async () => {
    const tree = await render(<NovoRegistro />);

    await type(tree, 'Nome do ACS', ' Maria Souza ');
    await type(tree, 'Nome', 'João Lima');
    await type(tree, 'Município da agressão', 'Curuçá');
    await type(tree, 'Idade (opcional)', '4a2x');

    // Selects abrem numa folha; escolhe a opção pelo nome acessível.
    await press(tree, { accessibilityRole: 'button', accessibilityLabel: 'Sexo' });
    await press(tree, { accessibilityRole: 'button', accessibilityLabel: 'Feminino' });
    await press(tree, { accessibilityRole: 'button', accessibilityLabel: 'Fez tratamento antirrábico?' });
    await press(tree, { accessibilityRole: 'button', accessibilityLabel: 'Não' });

    await press(tree, { accessibilityRole: 'button', accessibilityLabel: 'Salvar registro' });

    expect(addToQueue).toHaveBeenCalledTimes(1);
    const saved = addToQueue.mock.calls[0][0];
    expect(saved).toMatchObject({
      recordId: 'rec-123',
      uid: 'u1',
      nomeAcs: 'Maria Souza',
      nomeAgredido: 'João Lima',
      municipio: 'Curuçá',
      idade: 42,
      sexo: 'F',
      tratamentoAntirrabico: 'nao',
      status: 'pending',
      retryCount: 0,
      location: null,
      photoBase64: null,
      photoUriLocal: null,
    });
    expect(typeof saved.dataAgressao).toBe('string');
  });
});

describe('Buscar', () => {
  const nav = { navigate: jest.fn() };
  const registros = [
    { recordId: 'a', municipio: 'Curuçá', nomeAgredido: 'João', status: 'pending', dataRegistro: '2024-03-05T12:00:00.000Z', createdAt: '2024-03-05T12:00:00.000Z' },
    { recordId: 'b', municipio: 'Belém', nomeAgredido: 'Ana', status: 'synced', dataRegistro: '2024-03-06T12:00:00.000Z', createdAt: '2024-03-06T12:00:00.000Z' },
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
  test('mergeByRecordId: nuvem vence local e ordena do mais novo para o mais antigo', () => {
    const local = [
      { recordId: 'a', status: 'pending', createdAt: '2024-01-01T00:00:00.000Z' },
      { recordId: 'c', status: 'pending', createdAt: '2024-03-01T00:00:00.000Z' },
    ];
    const cloud = [{ recordId: 'a', status: 'synced', createdAt: '2024-01-01T00:00:00.000Z' }];
    const out = mergeByRecordId(cloud, local);
    expect(out.map((r) => r.recordId)).toEqual(['c', 'a']);
    expect(out.find((r) => r.recordId === 'a')).toMatchObject({ status: 'synced', _origin: 'cloud' });
  });

  test('formatadores do PDF', () => {
    expect(formatarDataCurta('2024-03-05T12:00:00.000Z')).toBe('05/03/2024');
    expect(formatarDataCurta(null)).toBe('-');
    expect(formatarSexo('M')).toBe('Masculino');
    expect(formatarTratamento('nao')).toBe('Não');
    expect(safeFileName('São José do Ê')).toBe('Ficha_Sao_Jose_do_E');
  });
});
