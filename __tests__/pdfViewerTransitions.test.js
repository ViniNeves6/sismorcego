import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { Modal } from 'react-native';
import { Animated } from '../src/ui/AccessibleNative';
import PdfViewerModal from '../src/pages/Main/buscar/PdfViewerModal';

jest.mock('react-native-pdf', () => 'Pdf');
jest.mock('../src/ui/Icon', () => 'Icon');
jest.mock('../src/ui/SismorcegoIcons', () => ({ CloseIcon: 'CloseIcon' }));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 24, bottom: 24 }) }));
jest.mock('../src/ui/useReduceMotion', () => () => mockReduceMotion);
jest.mock('../src/ui/AccessibleNative', () => {
  const rn = require('react-native');
  return { View: rn.View, Text: rn.Text, Pressable: rn.Pressable, Animated: { ...rn.Animated, timing: jest.fn() } };
});
let mockReduceMotion = false;
let animations, tree;
const props = { onClose: jest.fn(), onDownload: jest.fn(), onError: jest.fn() };
const a = { path: 'file:///cache/a.pdf' }, b = { path: 'file:///cache/b.pdf' };
const update = async pdf => act(async () => tree.update(<PdfViewerModal {...props} pdf={pdf} />));
const finish = async () => act(async () => animations.at(-1).finish());
beforeEach(() => {
  mockReduceMotion = false; animations = []; jest.clearAllMocks();
  Animated.timing.mockImplementation((value, config) => {
    let done;
    const animation = { config, start: cb => { done = cb; animations.push(animation); }, stop: jest.fn(),
      finish: () => { value.setValue(config.toValue); done?.({ finished: true }); } };
    return animation;
  });
});
afterEach(async () => { if (tree) await act(async () => tree.unmount()); tree = null; });

test('retains the PDF through close and replaces documents only after the exit finishes', async () => {
  await act(async () => { tree = TestRenderer.create(<PdfViewerModal {...props} pdf={a} />); });
  await finish();
  await update(b);
  expect(tree.root.findByType('Pdf').props.source.uri).toBe(a.path);
  expect(animations.at(-1).config.toValue).toBe(0);
  await finish();
  expect(tree.root.findByType('Pdf').props.source.uri).toBe(b.path);
  expect(animations.at(-1).config.toValue).toBe(1);
  await finish();
  await update(null);
  expect(tree.root.findByType('Pdf').props.source.uri).toBe(b.path);
  await finish();
  expect(tree.toJSON()).toBeNull();
});

test('Android back, close and download retain their actions in the sheet header', async () => {
  await act(async () => { tree = TestRenderer.create(<PdfViewerModal {...props} pdf={a} />); });
  const modal = tree.root.findByType(Modal);
  expect(modal.props).toMatchObject({ transparent: true, animationType: 'none' });
  modal.props.onRequestClose();
  tree.root.findAll(n => n.props.accessibilityLabel === 'Fechar' && n.props.onPress)[0].props.onPress();
  tree.root.findAll(n => n.props.accessibilityLabel === 'Baixar ou compartilhar PDF' && n.props.onPress)[0].props.onPress();
  expect(props.onClose).toHaveBeenCalledTimes(2);
  expect(props.onDownload).toHaveBeenCalledTimes(1);
});

test('reopening interrupts an exit and reduced motion closes without animation', async () => {
  await act(async () => { tree = TestRenderer.create(<PdfViewerModal {...props} pdf={a} />); });
  await finish(); await update(null);
  const exit = animations.at(-1);
  await update(a);
  expect(exit.stop).toHaveBeenCalled();
  await finish();
  expect(tree.root.findByType('Pdf').props.source.uri).toBe(a.path);
  mockReduceMotion = true;
  await update(null);
  expect(tree.toJSON()).toBeNull();
});

test('reduced motion opens and replaces documents without transitions', async () => {
  mockReduceMotion = true;
  await act(async () => { tree = TestRenderer.create(<PdfViewerModal {...props} pdf={null} />); });
  await update(a);
  expect(tree.root.findByType('Pdf').props.source.uri).toBe(a.path);
  await update(b);
  expect(tree.root.findByType('Pdf').props.source.uri).toBe(b.path);
  await update(null);
  expect(tree.toJSON()).toBeNull();
  expect(animations).toHaveLength(0);
});
