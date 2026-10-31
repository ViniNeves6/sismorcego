import React from 'react';
import Renderer, { act } from 'react-test-renderer';
import { Image } from 'react-native';
import { Rect, Text } from 'react-native-svg';
import HowToModal from '../src/ui/HowToModal';
import HowToRecordsPreview from '../src/ui/HowToRecordsPreview';

let mockHighContrast = false, tree;
jest.mock('../src/hooks/useAccessibility', () => () => ({ highContrast: mockHighContrast, fontScale: 1, settings: {} }));
jest.mock('../src/ui/useReduceMotion', () => () => true);
jest.mock('../src/hooks/useSpeakOnMount', () => jest.fn());
const text = () => tree.root.findAllByType(Text).map(node => node.props.children);
afterEach(async () => { if (tree) await act(async () => tree.unmount()); tree = null; mockHighContrast = false; });

test.each([false, true])('help first picture uses the current search/status layout with coordinator=%s', async isCoordenador => {
  await act(async () => { tree = Renderer.create(<HowToModal visible reduceMotion isCoordenador={isCoordenador} />); });
  expect(tree.root.findAllByType(Image)).toHaveLength(2);
  expect(text()).toEqual(expect.arrayContaining(['Buscar por município, vítima ou comunidade...', 'Todos', 'Pendentes', 'Enviados']));
  expect(text().includes('Município: Todos')).toBe(isCoordenador);
  expect(text().includes('Vítima: Todas')).toBe(isCoordenador);
  const preview = tree.root.findByType(HowToRecordsPreview);
  expect(preview.props.isCoordenador).toBe(isCoordenador);
});

test('the illustration scales as a whole and adapts its controls to high contrast', async () => {
  mockHighContrast = true;
  await act(async () => { tree = Renderer.create(<HowToRecordsPreview isCoordenador />); });
  const svg = tree.root.findAllByProps({ testID: 'howto-records-preview' })[0];
  expect(svg.props).toMatchObject({ width: '100%', height: '100%', preserveAspectRatio: 'xMidYMid meet', viewBox: '0 0 360 174' });
  expect(tree.root.findAllByType(Rect).every(node => ['#08080C', '#FFD700'].includes(node.props.fill))).toBe(true);
});
