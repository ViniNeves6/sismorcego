import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { StyleSheet, Text as NativeText, TextInput as NativeTextInput } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { FontText, FontTextInput } from '../src/ui/FontText';
import { Text } from '../src/ui/AccessibleNative';
import { AccessibilityProvider } from '../src/hooks/useAccessibility';

jest.mock('react-native-svg', () => ({ __esModule: true, default: 'Svg' }));
let tree;
afterEach(async () => {
  if (tree) await act(async () => tree.unmount());
  tree = null;
  await AsyncStorage.clear();
});

test('nested text inherits the HTML font weight and can request a different weight without artificial bold', async () => {
  await act(async () => { tree = TestRenderer.create(
    <FontText style={{ fontSize: 14, lineHeight: 22, fontWeight: '800' }}>
      Título <FontText testID="inherited">com destaque</FontText>
      <FontText testID="regular" style={{ fontWeight: '400' }}> e descrição</FontText>
    </FontText>,
  ); });
  const outer = tree.root.findAllByType(NativeText)[0];
  expect(StyleSheet.flatten(outer.props.style)).toMatchObject({
    fontFamily: 'PlusJakartaSans-ExtraBold', fontWeight: 'normal', fontSize: 14, lineHeight: 22,
  });
  const native = id => tree.root.findAllByType(NativeText).find(node => node.props.testID === id);
  expect(StyleSheet.flatten(native('inherited').props.style).fontFamily).toBe('PlusJakartaSans-ExtraBold');
  expect(StyleSheet.flatten(native('regular').props.style).fontFamily).toBe('PlusJakartaSans-Regular');
});

test('app font remains applied when accessibility enlarges and recolors text', async () => {
  await AsyncStorage.setItem('@sismorcego:accessibility', JSON.stringify({ fontScale: 1.5, highContrast: true }));
  await act(async () => { tree = TestRenderer.create(<AccessibilityProvider>
    <Text style={{ fontSize: 14, lineHeight: 20, fontWeight: '600', color: '#181126' }}>Descrição</Text>
  </AccessibilityProvider>); });
  expect(StyleSheet.flatten(tree.root.findByType(NativeText).props.style)).toMatchObject({
    fontFamily: 'PlusJakartaSans-SemiBold', fontSize: 21, lineHeight: 30, color: '#FFFFFF',
  });
});

test('text fields keep the same font, dimensions and native editing contract', async () => {
  const onChangeText = jest.fn();
  const ref = React.createRef();
  await act(async () => { tree = TestRenderer.create(<FontTextInput ref={ref} value=""
    onChangeText={onChangeText} style={{ fontSize: 14, height: 46, fontFamily: 'PlusJakartaSans-Medium' }} />); });
  const input = tree.root.findByType(NativeTextInput);
  expect(StyleSheet.flatten(input.props.style)).toMatchObject({
    fontFamily: 'PlusJakartaSans-Medium', fontWeight: 'normal', fontSize: 14, height: 46,
  });
  expect(typeof ref.current.focus).toBe('function');
  await act(async () => input.props.onChangeText('Comunidade'));
  expect(onChangeText).toHaveBeenCalledWith('Comunidade');
});
