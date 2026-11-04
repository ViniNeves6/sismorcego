import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { StyleSheet, Text, View } from 'react-native';
import { Animated } from '../src/ui/AccessibleNative';
import AnimatedScreenTransition from '../src/ui/AnimatedScreenTransition';
import AppCalendarModal from '../src/ui/AppCalendarModal';
import RecordNotificationsModal from '../src/ui/RecordNotificationsModal';
import { layoutCalendar } from './helpers/layoutCalendar';

jest.mock('../src/services/redesignData', () => ({}));
jest.mock('../src/ui/useReduceMotion', () => () => mockReducedMotion);
jest.mock('react-native-svg', () => ({
  __esModule: true, default: 'Svg', Path: 'Path', Circle: 'Circle', Rect: 'Rect',
  Line: 'Line', Polyline: 'Polyline',
}));
jest.mock('../src/ui/AccessibleNative', () => {
  const actual = jest.requireActual('../src/ui/AccessibleNative');
  return { ...actual, Animated: { ...actual.Animated, timing: jest.fn() } };
});

let tree;
let mockReducedMotion = false;
let animations;
const calendarProps = { selectedIsoDate: '2026-10-08', onClose: jest.fn(), onSelectDate: jest.fn() };
const hasText = label => tree.root.findAllByType(Text).some(node => node.props.children === label);
const press = async label => {
  const button = tree.root.findAll(node => node.props.accessibilityLabel === label && node.props.onPress)[0];
  await act(async () => button.props.onPress());
};
const finish = async animation => act(async () => animation.finish());

beforeEach(() => {
  mockReducedMotion = false;
  animations = [];
  Animated.timing.mockImplementation((value, config) => {
    let completion;
    let completed = false;
    const animation = {
      config, value,
      start: callback => {
        completion = callback;
        animation.mountedAtStart = tree?.toJSON();
        animations.push(animation);
      },
      stop: jest.fn(() => {
        if (!completed) { completed = true; completion?.({ finished: false }); }
      }),
      finish: () => {
        if (!completed) {
          completed = true;
          value.setValue(config.toValue);
          completion?.({ finished: true });
        }
      },
    };
    return animation;
  });
});

afterEach(async () => {
  if (tree) await act(async () => tree.unmount());
  tree = null;
});

test('navigation keeps each previous screen until fade-out, then fades in the next in both directions', async () => {
  const screen = key => <AnimatedScreenTransition screenKey={key}><Text>{key}</Text></AnimatedScreenTransition>;
  await act(async () => { tree = TestRenderer.create(screen('Registros')); });
  await finish(animations.at(-1));
  for (const [previous, next] of [['Registros', 'Notificar'], ['Notificar', 'Mais'], ['Mais', 'Notificar'], ['Notificar', 'Registros']]) {
    const animationCount = animations.length;
    await act(async () => tree.update(screen(next)));
    expect(hasText(previous)).toBe(true);
    expect(hasText(next)).toBe(false);
    expect(animations).toHaveLength(animationCount + 1);
    expect(animations.at(-1).config).toMatchObject({ duration: 100, toValue: 0 });
    await finish(animations.at(-1));
    expect(hasText(previous)).toBe(false);
    expect(hasText(next)).toBe(true);
    expect(animations).toHaveLength(animationCount + 2);
    expect(animations.at(-1).config).toMatchObject({ duration: 200, toValue: 1 });
    await finish(animations.at(-1));
  }
});

test('intermediate fade frames leave overlapping card faces, borders and shadows fully opaque', async () => {
  await act(async () => {
    tree = TestRenderer.create(<AnimatedScreenTransition screenKey="alerts">
      <View style={{ backgroundColor: '#FFFFFF', borderWidth: 1.5, borderRadius: 16, elevation: 2 }}>
        <Text>Alerta</Text>
      </View>
    </AnimatedScreenTransition>);
  });
  const entry = animations.at(-1);
  for (const progress of [0.1, 0.5, 0.9]) {
    await act(async () => entry.value.setValue(progress));
    const content = tree.root.findAllByProps({ testID: 'screen-transition-content' })[0];
    const fade = tree.root.findAllByProps({ testID: 'screen-transition-fade' })[0];
    expect(StyleSheet.flatten(content.props.style).opacity).toBeUndefined();
    expect(StyleSheet.flatten(content.props.style).transform).toBeUndefined();
    const cover = StyleSheet.flatten(fade.props.style);
    expect(cover.backgroundColor).toBe('#FFFFFF');
    expect(cover.elevation).toBeGreaterThan(16);
    expect(cover.shadowColor).toBe('transparent');
    expect(cover.opacity.__getValue()).toBeCloseTo(1 - progress);
    expect(fade.props.pointerEvents).toBe('none');
    expect(content.props.pointerEvents).toBe('none');
    expect(hasText('Alerta')).toBe(true);
  }
  await finish(entry);
  expect(tree.root.findAllByProps({ testID: 'screen-transition-fade' })).toHaveLength(0);
  expect(tree.root.findAllByProps({ testID: 'screen-transition-content' })[0].props.pointerEvents).toBe('auto');
});

test('rapid navigation mounts only the latest destination after the retained screen exits', async () => {
  const screen = (key, text = key) => <AnimatedScreenTransition screenKey={key}><Text>{text}</Text></AnimatedScreenTransition>;
  await act(async () => { tree = TestRenderer.create(screen('Registros')); });
  await finish(animations.at(-1));
  await act(async () => tree.update(screen('Painel')));
  const abandonedExit = animations.at(-1);
  await act(async () => tree.update(screen('Alertas')));
  expect(abandonedExit.stop).toHaveBeenCalled();
  await finish(abandonedExit);
  expect(hasText('Registros')).toBe(true);
  expect(hasText('Painel')).toBe(false);
  expect(hasText('Alertas')).toBe(false);
  await finish(animations.at(-1));
  expect(hasText('Registros')).toBe(false);
  expect(hasText('Alertas')).toBe(true);
  const entry = animations.at(-1);
  const count = animations.length;
  await act(async () => tree.update(screen('Alertas', 'Alertas atualizados')));
  expect(hasText('Alertas atualizados')).toBe(true);
  expect(animations).toHaveLength(count);
  await finish(entry);
  expect(tree.root.findAllByProps({ testID: 'screen-transition-fade' })).toHaveLength(0);
});

test('enabling reduced motion during exit shows the destination immediately and cancels the cover', async () => {
  const screen = key => <AnimatedScreenTransition screenKey={key}><Text>{key}</Text></AnimatedScreenTransition>;
  await act(async () => { tree = TestRenderer.create(screen('Registros')); });
  await finish(animations.at(-1));
  await act(async () => tree.update(screen('Alertas')));
  const exit = animations.at(-1);
  mockReducedMotion = true;
  await act(async () => tree.update(screen('Alertas')));
  expect(exit.stop).toHaveBeenCalled();
  expect(hasText('Registros')).toBe(false);
  expect(hasText('Alertas')).toBe(true);
  expect(tree.root.findAllByProps({ testID: 'screen-transition-fade' })).toHaveLength(0);
  await finish(exit);
  expect(hasText('Alertas')).toBe(true);
});

test('reduced motion switches screens immediately without running a transition', async () => {
  mockReducedMotion = true;
  const screen = key => <AnimatedScreenTransition screenKey={key}><Text>{key}</Text></AnimatedScreenTransition>;
  await act(async () => { tree = TestRenderer.create(screen('Registros')); });
  await act(async () => tree.update(screen('Notificar')));
  expect(hasText('Notificar')).toBe(true);
  expect(hasText('Registros')).toBe(false);
  expect(animations).toHaveLength(0);
});

test('calendar starts entry with its native content mounted and retains it through exit and reopening', async () => {
  const calendar = visible => <AppCalendarModal {...calendarProps} visible={visible} />;
  await act(async () => { tree = TestRenderer.create(calendar(false)); });
  expect(tree.toJSON()).toBeNull();
  expect(animations).toHaveLength(0);

  await act(async () => tree.update(calendar(true)));
  expect(animations.at(-1).mountedAtStart).not.toBeNull();
  expect(hasText('Selecionar data')).toBe(true);
  await finish(animations.at(-1));

  await act(async () => tree.update(calendar(false)));
  expect(hasText('Selecionar data')).toBe(true);
  const interruptedExit = animations.at(-1);
  await act(async () => tree.update(calendar(true)));
  expect(interruptedExit.stop).toHaveBeenCalled();
  await finish(animations.at(-1));
  expect(hasText('Selecionar data')).toBe(true);

  await act(async () => tree.update(calendar(false)));
  await finish(animations.at(-1));
  expect(tree.toJSON()).toBeNull();
});

test('calendar month and year menus remain mounted until their closing animations finish', async () => {
  await act(async () => { tree = TestRenderer.create(<AppCalendarModal {...calendarProps} visible />); });
  await finish(animations.at(-1));
  await layoutCalendar(tree);
  for (const [button, menuText] of [['Selecionar mês', 'Janeiro'], ['Selecionar ano', '1930']]) {
    await press(button);
    expect(animations.at(-1).mountedAtStart).not.toBeNull();
    expect(hasText(menuText)).toBe(true);
    await finish(animations.at(-1));
    await press(button);
    expect(hasText(menuText)).toBe(true);
    await finish(animations.at(-1));
    expect(hasText(menuText)).toBe(false);
  }
});

test('system reduced motion shows and closes the calendar immediately', async () => {
  mockReducedMotion = true;
  await act(async () => { tree = TestRenderer.create(<AppCalendarModal {...calendarProps} visible />); });
  expect(hasText('Selecionar data')).toBe(true);
  await act(async () => tree.update(<AppCalendarModal {...calendarProps} visible={false} />));
  expect(tree.toJSON()).toBeNull();
  expect(animations).toHaveLength(0);
});

test('the bell panel lists actual pending records and opens a selection only after its exit finishes', async () => {
  const records = [
    { id: 'pending', title: 'Humano', city: 'Curuçá', date: '26/10/2026', status: 'pending' },
    { id: 'sent', title: 'Já enviado', city: 'Belém', status: 'synced' },
  ];
  const onSelectRecord = jest.fn();
  const modal = visible => <RecordNotificationsModal visible={visible} records={records}
    onClose={() => tree.update(modal(false))} onSelectRecord={onSelectRecord} />;
  await act(async () => { tree = TestRenderer.create(modal(true)); });
  await finish(animations.at(-1));
  expect(hasText('Curuçá')).toBe(true);
  expect(hasText('26/10/2026')).toBe(true);
  expect(hasText('Aguardando envio')).toBe(true);
  expect(hasText('Já enviado')).toBe(false);
  await press('Abrir registro Humano de Curuçá');
  expect(onSelectRecord).not.toHaveBeenCalled();
  expect(hasText('Notificações')).toBe(true);
  await finish(animations.at(-1));
  expect(tree.toJSON()).toBeNull();
  expect(onSelectRecord).toHaveBeenCalledWith(records[0]);
});

test('the bell panel reports an empty queue without creating example notifications', async () => {
  await act(async () => { tree = TestRenderer.create(<RecordNotificationsModal visible records={[]} reduceMotion onClose={jest.fn()} />); });
  expect(hasText('Nenhum registro aguardando envio.')).toBe(true);
  expect(tree.root.findAll(node => node.props.accessibilityLabel?.startsWith('Abrir registro'))).toHaveLength(0);
});
