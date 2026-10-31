import React from 'react';
import ReactTestRenderer, { act } from 'react-test-renderer';
import { Text as RNText } from 'react-native';
import RegistrosScreen from '../src/pages/Main/RegistrosScreen';

jest.mock('react-native-linear-gradient', () => 'LinearGradient');
jest.mock('react-native-svg', () => ({
  __esModule: true,
  default: 'Svg',
  Path: 'Path',
  Circle: 'Circle',
  Rect: 'Rect',
  Line: 'Line',
  Polyline: 'Polyline',
}));

describe('RegistrosScreen HTML filter transition and card animations', () => {
  const sampleRecords = [
    {
      id: 'rec-1',
      title: 'Canino / Felino',
      city: 'Curuçá',
      reporter: 'Carlos Eduardo Silva',
      status: 'synced',
      statusLabel: 'Sincronizado',
      date: '15/09/2026',
      victimKey: 'canino',
    },
    {
      id: 'rec-2',
      title: 'Agressão em Humano',
      city: 'Belém',
      reporter: 'André Vinicius Neves Alves',
      status: 'synced',
      statusLabel: 'Sincronizado',
      date: '28/09/2026',
      victimKey: 'humano',
    },
    {
      id: 'rec-3',
      title: 'Canino / Felino',
      city: 'Ananindeua',
      reporter: 'Luciana Ferreira Lima',
      status: 'pending',
      statusLabel: 'Pendente',
      date: '29/10/2026',
      victimKey: 'canino',
    },
  ];

  test('renders expandable filter pills with badge counts matching records pool', async () => {
    let tree;
    await act(async () => {
      tree = ReactTestRenderer.create(
        <RegistrosScreen
          records={sampleRecords}
          reduceMotion={true}
        />
      );
    });

    const texts = tree.root.findAllByType(RNText).map(t => t.props.children);
    // Labels
    expect(texts).toContain('Todos');
    expect(texts).toContain('Pendentes');
    expect(texts).toContain('Enviados');

    // Counts: Todos = 3, Pendentes = 1, Enviados = 2
    expect(texts).toContain(3);
    expect(texts).toContain(1);
    expect(texts).toContain(2);
  });

  test('switching filters updates active pill state and filters records correctly', async () => {
    const onSelectRecord = jest.fn();
    let tree;
    await act(async () => {
      tree = ReactTestRenderer.create(
        <RegistrosScreen
          records={sampleRecords}
          onSelectRecord={onSelectRecord}
          reduceMotion={true}
        />
      );
    });

    // Press "Pendentes"
    const pendentesBtn = tree.root.findAll(
      node => typeof node.props.onPress === 'function' &&
        node.findAllByType(RNText).some(t => t.props.children === 'Pendentes')
    )[0];
    expect(pendentesBtn).toBeDefined();

    await act(async () => {
      pendentesBtn.props.onPress();
    });

    const renderedTexts = tree.root.findAllByType(RNText).map(t => t.props.children);
    expect(renderedTexts).toContain('Município de Ananindeua');
    expect(renderedTexts).not.toContain('Município de Curuçá');
    expect(renderedTexts).not.toContain('Município de Belém');

    // Press "Enviados"
    const enviadosBtn = tree.root.findAll(
      node => typeof node.props.onPress === 'function' &&
        node.findAllByType(RNText).some(t => t.props.children === 'Enviados')
    )[0];
    expect(enviadosBtn).toBeDefined();

    await act(async () => {
      enviadosBtn.props.onPress();
    });

    const syncedTexts = tree.root.findAllByType(RNText).map(t => t.props.children);
    expect(syncedTexts).toContain('Município de Curuçá');
    expect(syncedTexts).toContain('Município de Belém');
    expect(syncedTexts).not.toContain('Município de Ananindeua');
  });

  test('renders card with Opção 3 watermark layout, pin, and agent initials', async () => {
    let tree;
    await act(async () => {
      tree = ReactTestRenderer.create(
        <RegistrosScreen
          records={sampleRecords}
          reduceMotion={true}
        />
      );
    });

    const renderedTexts = tree.root.findAllByType(RNText).map(t => t.props.children);
    // Titles and locations
    expect(renderedTexts).toContain('Canino / Felino');
    expect(renderedTexts).toContain('Agressão em Humano');
    expect(renderedTexts).toContain('Município de Curuçá');
    expect(renderedTexts).toContain('Município de Belém');

    // Agent initials and names
    expect(renderedTexts).toContain('CE'); // Carlos Eduardo Silva
    expect(renderedTexts).toContain('Carlos Eduardo Silva');
    expect(renderedTexts).toContain('AV'); // André Vinicius Neves Alves
    expect(renderedTexts).toContain('André Vinicius Neves Alves');
    expect(renderedTexts).toContain('Agente');

    // Dates and sync labels
    expect(renderedTexts).toContain('15/09/2026');
    expect(renderedTexts).toContain('28/09/2026');
    expect(renderedTexts).toContain('Sincronizado');
    expect(renderedTexts).toContain('Pendente');
  });
});
