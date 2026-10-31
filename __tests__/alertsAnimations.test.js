import React from 'react';
import ReactTestRenderer, { act } from 'react-test-renderer';
import { Text as RNText } from 'react-native';
import AdminAlertsScreen from '../src/pages/Admin/AdminAlertsScreen';

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

describe('AdminAlertsScreen HTML filter transition and card animations', () => {
  const sampleAlerts = [
    {
      id: 'alert-1',
      title: 'Canino / Felino',
      city: 'África Do Sul',
      locality: 'Angola',
      summary: 'Saiu para pescar com o proprietário',
      date: '01/10/2026 às 20:07',
      reporter: 'Vinicius Charizard',
      lida: false,
    },
    {
      id: 'alert-2',
      title: 'Canino / Felino',
      city: 'Belém',
      locality: 'Castanheira',
      summary: 'Saiu para pescar com o proprietário',
      date: '28/09/2026 às 18:57',
      reporter: 'André Vinicius Neves Alves',
      lida: true,
    },
    {
      id: 'alert-3',
      title: 'Agressão em Humano',
      city: 'Ananindeua',
      locality: 'Centro',
      summary: 'Mordedura na mão',
      date: '15/09/2026 às 10:00',
      reporter: 'Carlos Eduardo Silva',
      lida: true,
    },
  ];

  test('renders expandable filter pills with badge counts matching alerts pool', async () => {
    let tree;
    await act(async () => {
      tree = ReactTestRenderer.create(
        <AdminAlertsScreen
          alerts={sampleAlerts}
          reduceMotion={true}
        />
      );
    });

    const texts = tree.root.findAllByType(RNText).map(t => t.props.children);
    // Labels
    expect(texts).toContain('Todos');
    expect(texts).toContain('Não lidos');
    expect(texts).toContain('Lidos');

    // Counts: Todos = 3, Não lidos = 1, Lidos = 2
    expect(texts).toContain(3);
    expect(texts).toContain(1);
    expect(texts).toContain(2);
  });

  test('switching filters updates active pill state and filters alert cards correctly', async () => {
    let tree;
    await act(async () => {
      tree = ReactTestRenderer.create(
        <AdminAlertsScreen
          alerts={sampleAlerts}
          reduceMotion={true}
        />
      );
    });

    // Press "Não lidos"
    const unreadBtn = tree.root.findAll(
      node => typeof node.props.onPress === 'function' &&
        node.findAllByType(RNText).some(t => t.props.children === 'Não lidos')
    )[0];
    expect(unreadBtn).toBeDefined();

    await act(async () => {
      unreadBtn.props.onPress();
    });

    const renderedTexts = tree.root.findAllByType(RNText).map(t => t.props.children);
    expect(renderedTexts).toContain('Angola');
    expect(renderedTexts).toContain('África Do Sul');
    expect(renderedTexts).not.toContain('Castanheira');
    expect(renderedTexts).not.toContain('Centro');

    // Press "Lidos"
    const readBtn = tree.root.findAll(
      node => typeof node.props.onPress === 'function' &&
        node.findAllByType(RNText).some(t => t.props.children === 'Lidos')
    )[0];
    expect(readBtn).toBeDefined();

    await act(async () => {
      readBtn.props.onPress();
    });

    const readTexts = tree.root.findAllByType(RNText).map(t => t.props.children);
    expect(readTexts).toContain('Castanheira');
    expect(readTexts).toContain('Centro');
    expect(readTexts).not.toContain('Angola');
  });
});
