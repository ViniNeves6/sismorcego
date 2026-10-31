import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { ScrollView, Text } from 'react-native';
import ScrollViewWithScrollbar from '../src/ui/ScrollViewWithScrollbar';

let tree;
const mount = async props => act(async () => {
  tree = TestRenderer.create(<ScrollViewWithScrollbar {...props}><Text>Pergunta</Text></ScrollViewWithScrollbar>);
});
const measure = async (viewport, content) => act(async () => {
  const scroll = tree.root.findByType(ScrollView);
  scroll.props.onLayout({ nativeEvent: { layout: { height: viewport } } });
  scroll.props.onContentSizeChange(300, content);
});
const tracks = () => tree.root.findAll(node => typeof node.type === 'string' && node.props.onResponderGrant && node.props.onAccessibilityAction);
afterEach(async () => { if (tree) await act(async () => tree.unmount()); tree = null; });

test('inset history keeps its scrollbar visible with one question and disables dragging when everything fits', async () => {
  await mount({ variant: 'inset', accessibilityLabel: 'Minhas perguntas' });
  await measure(350, 214);
  expect(tracks()).toHaveLength(1);
  const track = tracks()[0];
  expect(track.props.accessible).toBe(false);
  expect(track.props.onStartShouldSetResponder()).toBe(false);
  // Even an unexpected grant with no overflow must not divide by zero.
  await act(async () => track.props.onResponderGrant({ nativeEvent: { locationY: 30, pageY: 130 } }));
  expect(JSON.stringify(tree.toJSON())).not.toContain('NaN');
});

test.each([true, false])('scrollbar scrolls inside the history and respects reduced motion %s', async reduceMotion => {
  await mount({ variant: 'inset', accessibilityLabel: 'Minhas perguntas', reduceMotion });
  await measure(300, 1200);
  const scrollTo = jest.spyOn(tree.root.findByType(ScrollView).instance, 'scrollTo');
  const track = tracks()[0];
  expect(track.props.accessibilityLabel).toBe('Rolagem: Minhas perguntas');
  expect(track.props.onStartShouldSetResponder()).toBe(true);
  await act(async () => track.props.onAccessibilityAction({ nativeEvent: { actionName: 'increment' } }));
  expect(scrollTo).toHaveBeenLastCalledWith({ y: 225, animated: !reduceMotion });
  await act(async () => track.props.onAccessibilityAction({ nativeEvent: { actionName: 'decrement' } }));
  expect(scrollTo).toHaveBeenLastCalledWith({ y: 0, animated: !reduceMotion });
  await act(async () => {
    track.props.onResponderGrant({ nativeEvent: { locationY: 30, pageY: 130 } });
    track.props.onResponderMove({ nativeEvent: { pageY: 3000 } });
    track.props.onResponderRelease();
  });
  expect(scrollTo).toHaveBeenLastCalledWith({ y: 900, animated: false });
  await measure(300, 214);
  expect(tracks()).toHaveLength(1);
  expect(tracks()[0].props.onStartShouldSetResponder()).toBe(false);
});

test('default form scrollbar still appears only when the form overflows', async () => {
  await mount({});
  await measure(350, 214);
  expect(tracks()).toHaveLength(0);
  await measure(350, 1000);
  expect(tracks()).toHaveLength(1);
  expect(tracks()[0].props.accessibilityLabel).toBe('Rolagem do formulário');
  expect(tree.root.findAll(node => typeof node.type === 'string' && node.props.accessibilityLabel === 'Rolar para baixo')).toHaveLength(1);
});
