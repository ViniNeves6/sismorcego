import React from 'react';
import ReactTestRenderer, { act } from 'react-test-renderer';
import { RefreshControl, ScrollView } from 'react-native';
import AdminPanelScreen from '../src/pages/Admin/AdminPanelScreen';
import AdminAlertsScreen from '../src/pages/Admin/AdminAlertsScreen';
import BottomSheetModal from '../src/ui/BottomSheetModal';
import { toRecordView } from '../src/services/registroAdapter';

jest.mock('react-native-svg', () => ({
  __esModule: true,
  default: 'Svg',
  Path: 'Path',
  Circle: 'Circle',
  Rect: 'Rect',
  Line: 'Line',
  Polyline: 'Polyline',
  Polygon: 'Polygon',
  Defs: 'Defs',
  LinearGradient: 'LinearGradient',
  RadialGradient: 'RadialGradient',
  Stop: 'Stop',
  G: 'G',
  Text: 'SvgText',
}));

jest.mock('react-native-maps', () => {
  const { View } = require('react-native');
  const MockMapView = (props) => <View testID="mock-map-view" {...props} />;
  MockMapView.Marker = (props) => <View testID="mock-marker" {...props} />;
  MockMapView.Heatmap = (props) => <View testID="mock-heatmap" {...props} />;
  return {
    __esModule: true,
    default: MockMapView,
    Marker: MockMapView.Marker,
    Heatmap: MockMapView.Heatmap,
    PROVIDER_GOOGLE: 'google',
  };
});

test.each([
  { kind: 'text', options: ['Todos', 'Belém'], selectedValue: 'Todos' },
  { kind: 'id and label', options: [{ id: 'all', label: 'Todos' }, { id: 'belem', label: 'Belém' }], selectedValue: 'all' },
])('filter sheets render $kind options as labels and return the original selection', async ({ options, selectedValue }) => {
  const onSelect = jest.fn();
  const onExited = jest.fn();
  let tree;
  try {
    await act(async () => { tree = ReactTestRenderer.create(
      <BottomSheetModal visible reduceMotion title="Município" options={options} selectedValue={selectedValue} onSelect={onSelect} />,
    ); });
    const text = tree.root.findAllByType('Text').map(node => node.props.children);
    expect(text).toEqual(expect.arrayContaining(['Município', 'Todos', 'Belém']));
    const option = tree.root.findAll(node => typeof node.props.onPress === 'function'
      && node.findAllByType('Text').some(label => label.props.children === 'Belém'))[0];
    await act(async () => option.props.onPress());
    expect(onSelect.mock.calls[0][0]).toBe(options[1]);
    await act(async () => tree.update(
      <BottomSheetModal visible={false} reduceMotion title="Município" options={options}
        selectedValue={selectedValue} onSelect={onSelect} onExited={onExited} />,
    ));
    expect(tree.toJSON()).toBeNull();
    expect(onExited).toHaveBeenCalledTimes(1);
  } finally {
    if (tree) await act(async () => tree.unmount());
  }
});

test('panel exposes its native scroll view, offset and content height to the guide', async () => {
  const state = { node: null, offset: 0 };
  let tree;
  try {
    await act(async () => { tree = ReactTestRenderer.create(<AdminPanelScreen scrollRef={state} />); });
    expect(state.node).toBeTruthy();
    expect(typeof state.node.scrollTo).toBe('function');
    const scroll = tree.root.findByType(ScrollView);
    await act(async () => {
      scroll.props.onContentSizeChange(360, 1600);
      scroll.props.onScroll({ nativeEvent: { contentOffset: { y: 400 } } });
    });
    expect(state).toMatchObject({ offset: 400, contentHeight: 1600 });
  } finally {
    if (tree) await act(async () => tree.unmount());
  }
  expect(state.node).toBeNull();
});

test('the guide reserves temporary scroll room without changing the ordinary panel', async () => {
  let tree;
  try {
    await act(async () => { tree = ReactTestRenderer.create(<AdminPanelScreen />); });
    expect(tree.root.findAllByProps({ testID: 'admin-guide-scroll-space' })).toHaveLength(0);
    await act(async () => tree.root.findByType(ScrollView).props.onLayout({ nativeEvent: { layout: { height: 800 } } }));
    await act(async () => tree.update(<AdminPanelScreen guideActive />));
    expect(tree.root.findAllByProps({ testID: 'admin-guide-scroll-space' })[0].props.style.height).toBe(800);
    await act(async () => tree.update(<AdminPanelScreen guideActive={false} />));
    expect(tree.root.findAllByProps({ testID: 'admin-guide-scroll-space' })).toHaveLength(0);
  } finally {
    if (tree) await act(async () => tree.unmount());
  }
});

test('panel renders adapter GPS in the native heatmap and filters its counters and points together', async () => {
  jest.useFakeTimers().setSystemTime(new Date(2026, 9, 28, 12));
  let tree;
  const onOpenBottomSheet = jest.fn();
  const rows = [
    { recordId: 'a', tipoVitima: 'humano', municipio: 'Curuçá', location: { latitude: -1.4, longitude: -48.4 } },
    { recordId: 'b', tipoVitima: 'caninoFelino', municipio: 'Belém', location: { latitude: -1.5, longitude: -48.5 } },
    { recordId: 'c', tipoVitima: 'aves', municipio: 'Curuçá', dataMordedura: '' },
    { recordId: 'd', tipoVitima: 'producao', municipio: 'Curuçá', dataMordedura: '2026-01-01', location: { latitude: 91, longitude: -48 } },
  ].map(row => toRecordView({ uid: 'acs', dataMordedura: '2026-10-28', ...row }));
  const heatmap = () => tree.root.findAllByProps({ testID: 'mock-heatmap' })[0].props.points;
  const count = label => {
    let node = tree.root.findAllByType('Text').find(item => item.props.children === label);
    while (node.findAllByType('Text').length < 2) node = node.parent;
    return node.findAllByType('Text')[0].props.children;
  };
  const filter = async (label, id) => {
    await act(async () => tree.root.findAll(node => node.props.accessibilityLabel === label && node.props.onPress)[0].props.onPress());
    await act(async () => onOpenBottomSheet.mock.calls[onOpenBottomSheet.mock.calls.length - 1][0].onSelect({ id }));
  };
  try {
    await act(async () => { tree = ReactTestRenderer.create(<AdminPanelScreen records={rows} onOpenBottomSheet={onOpenBottomSheet} />); });
    await act(async () => jest.advanceTimersByTime(1000));
    expect(heatmap()).toEqual([{ latitude: -1.4, longitude: -48.4, weight: 1 }, { latitude: -1.5, longitude: -48.5, weight: 1 }]);
    expect(count('Total de registros')).toBe(4);
    expect(count('Em humanos')).toBe(1);
    expect(count('Em animais')).toBe(3);
    await filter('Filtrar por município', 'Curuçá');
    expect(count('Total de registros')).toBe(3);
    expect(heatmap()).toHaveLength(1);
    await filter('Filtrar por período', '7');
    expect(count('Total de registros')).toBe(1);
    expect(count('Em animais')).toBe(0);
    expect(heatmap()).toHaveLength(1);
  } finally {
    if (tree) await act(async () => tree.unmount());
    jest.useRealTimers();
  }
});

test.each([
  { name: 'empty', alerts: [] },
  { name: 'populated', alerts: [{ id: 'actual-alert', title: 'Humano', lida: false }] },
  { name: 'failed', error: 'Falha ao carregar os alertas.' },
])('alerts can be refreshed by pulling down when the feed is $name', async screenProps => {
  const onRetry = jest.fn();
  let tree;
  try {
    await act(async () => { tree = ReactTestRenderer.create(<AdminAlertsScreen {...screenProps} onRetry={onRetry} />); });
    const scroll = tree.root.findByType(ScrollView);
    expect(scroll.props.alwaysBounceVertical).toBe(true);
    const refresh = tree.root.findByType(RefreshControl);
    expect(refresh.props.refreshing).toBe(false);
    await act(async () => refresh.props.onRefresh());
    expect(onRetry).toHaveBeenCalledTimes(1);
    await act(async () => tree.update(<AdminAlertsScreen {...screenProps} loading onRetry={onRetry} />));
    expect(tree.root.findByType(RefreshControl).props.refreshing).toBe(true);
    await act(async () => tree.update(<AdminAlertsScreen {...screenProps} loading={false} onRetry={onRetry} />));
    expect(tree.root.findByType(RefreshControl).props.refreshing).toBe(false);
  } finally {
    if (tree) await act(async () => tree.unmount());
  }
});

test('alerts report an actual feed failure and allow retry instead of claiming the inbox is empty', async () => {
  const onRetry = jest.fn();
  let tree;
  try {
    await act(async () => { tree = ReactTestRenderer.create(<AdminAlertsScreen error="Falha ao carregar os alertas." onRetry={onRetry} />); });
    const text = tree.root.findAllByType('Text').map(node => node.props.children);
    expect(text).toContain('Falha ao carregar os alertas.');
    expect(text).not.toContain('Nenhum alerta para o filtro selecionado.');
    const retry = tree.root.findAll(node => node.props.onPress === onRetry)[0];
    await act(async () => retry.props.onPress());
    expect(onRetry).toHaveBeenCalledTimes(1);
  } finally {
    if (tree) await act(async () => tree.unmount());
  }
});

describe('Coordinator Admin Screens', () => {
  const mockRecords = [
    {
      id: 'rec-1',
      tipo: 'humano',
      municipio: 'Recife',
      localidade: 'Boa Viagem',
      dataNotificacao: new Date().toISOString(),
      dataOcorrencia: new Date().toISOString(),
      latitude: -8.05,
      longitude: -34.88,
      nomeAgente: 'Agente Silva',
      status: 'pendente',
    },
    {
      id: 'rec-2',
      tipo: 'canino_felino',
      municipio: 'Olinda',
      localidade: 'Carmo',
      dataNotificacao: new Date().toISOString(),
      dataOcorrencia: new Date().toISOString(),
      latitude: -7.99,
      longitude: -34.85,
      nomeAgente: 'Agente Souza',
      status: 'enviado',
    },
    {
      id: 'rec-3',
      tipo: 'producao',
      municipio: 'Recife',
      localidade: 'Várzea',
      dataNotificacao: new Date().toISOString(),
      dataOcorrencia: new Date().toISOString(),
      latitude: null,
      longitude: null,
      nomeAgente: 'Agente Carlos',
      status: 'enviado',
    },
  ];

  const mockAlerts = [
    {
      id: 'alert-1',
      recordId: 'rec-1',
      tipo: 'humano',
      tipoVitima: 'Humano',
      municipio: 'Recife',
      localidade: 'Boa Viagem',
      resumo: 'Contato com morcego em área residencial.',
      dataHora: '28/10/2026 14:30',
      nomeAcs: 'Agente Silva',
      lida: false,
    },
    {
      id: 'alert-2',
      recordId: 'rec-2',
      tipo: 'canino_felino',
      tipoVitima: 'Cão/Gato',
      municipio: 'Olinda',
      localidade: 'Carmo',
      resumo: 'Mordedura em cão doméstico.',
      dataHora: '27/10/2026 10:15',
      nomeAcs: 'Agente Souza',
      lida: true,
    },
  ];

  describe('AdminPanelScreen', () => {
    test('renders KPIs, animal breakdown, map summary and trend chart with records', async () => {
      let tree;
      const setCity = jest.fn();
      const setPeriod = jest.fn();
      const setVictim = jest.fn();

      await act(async () => {
        tree = ReactTestRenderer.create(
          <AdminPanelScreen
            records={mockRecords}
            adminCityFilter="todos"
            setAdminCityFilter={setCity}
            adminPeriodFilter="todo"
            setAdminPeriodFilter={setPeriod}
            adminVictimFilter="todos"
            setAdminVictimFilter={setVictim}
            reduceMotion={true}
          />
        );
      });

      expect(tree).toBeDefined();
      const textNodes = tree.root.findAllByType('Text').map((n) => n.props.children);
      const allText = JSON.stringify(textNodes);

      expect(allText).toContain('Painel');
      expect(allText).toContain('Monitoramento epidemiológico regional');
      expect(allText).toContain('Total de registros');
      expect(allText).toContain('Em humanos');
      expect(allText).toContain('Em animais');
      expect(allText).toContain('Distribuição em animais');
      expect(allText).toContain('Mapa de calor e ocorrências');
      expect(allText).toContain('Registros por período');
    });

    test('renders gracefully with empty records', async () => {
      let tree;
      await act(async () => {
        tree = ReactTestRenderer.create(
          <AdminPanelScreen
            records={[]}
            adminCityFilter="todos"
            setAdminCityFilter={jest.fn()}
            adminPeriodFilter="todo"
            setAdminPeriodFilter={jest.fn()}
            adminVictimFilter="todos"
            setAdminVictimFilter={jest.fn()}
            reduceMotion={true}
          />
        );
      });

      expect(tree).toBeDefined();
      const textNodes = tree.root.findAllByType('Text').map((n) => n.props.children);
      const allText = JSON.stringify(textNodes);
      expect(allText).toContain('Total de registros');
      expect(allText).toContain('Nenhum registro com GPS para esses filtros.');
    });
  });

  describe('AdminAlertsScreen', () => {
    test('renders overview with unread badge, filter pills, and alerts list', async () => {
      const onMarkRead = jest.fn();
      const onMarkAllRead = jest.fn();
      const onSelectAlert = jest.fn();
      let tree;

      await act(async () => {
        tree = ReactTestRenderer.create(
          <AdminAlertsScreen
            alerts={mockAlerts}
            loading={false}
            onMarkRead={onMarkRead}
            onMarkAllRead={onMarkAllRead}
            onSelectAlert={onSelectAlert}
            reduceMotion={true}
          />
        );
      });

      expect(tree).toBeDefined();
      const textNodes = tree.root.findAllByType('Text').map((n) => n.props.children);
      const allText = JSON.stringify(textNodes);

      expect(allText).toContain('Alertas');
      expect(allText).toContain('Alertas no aplicativo, atualizados com conexão');
      expect(allText).toContain('Todos');
      expect(allText).toContain('Não lidos');
      expect(allText).toContain('Lidos');
      expect(allText).toContain('Novo alerta');
      expect(allText).toContain('Agente: Agente Silva');
    });

    test('renders empty state when there are no alerts matching filter', async () => {
      let tree;
      await act(async () => {
        tree = ReactTestRenderer.create(
          <AdminAlertsScreen
            alerts={[]}
            loading={false}
            reduceMotion={true}
          />
        );
      });

      expect(tree).toBeDefined();
      const textNodes = tree.root.findAllByType('Text').map((n) => n.props.children);
      const allText = JSON.stringify(textNodes);
      expect(allText).toContain('Nenhum alerta para o filtro selecionado.');
    });
  });
});
