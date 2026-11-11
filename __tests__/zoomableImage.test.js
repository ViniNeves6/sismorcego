import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { BackHandler } from 'react-native';
import ZoomableImageModal, { clampOffset, createZoomController, fittedSize, zoomAround, MAX_SCALE, DOUBLE_TAP_SCALE, DOUBLE_TAP_MS } from '../src/ui/ZoomableImageModal';

jest.mock('../src/ui/useReduceMotion', () => () => true);
jest.mock('../src/hooks/useSpeakOnMount', () => jest.fn());

const AREA = { width: 400, height: 800 };
let tree, back, now;
const touch = (x, y) => ({ pageX: x, pageY: y, locationX: x, locationY: y });
const render = async (props = {}) => {
  await act(async () => {
    tree = TestRenderer.create(<ZoomableImageModal visible source={{ uri: 'x.jpg' }} title="A doença raiva" aspectRatio={1600 / 2114} onClose={jest.fn()} {...props} />);
  });
  await act(async () => tree.root.findByProps({ testID: 'zoom-area' }).props.onLayout({ nativeEvent: { layout: AREA } }));
};

beforeEach(() => {
  now = 1000;
  jest.spyOn(Date, 'now').mockImplementation(() => now);
  jest.spyOn(BackHandler, 'addEventListener').mockImplementation((_, fn) => { back = fn; return { remove: jest.fn() }; });
});
afterEach(async () => { if (tree) await act(async () => tree.unmount()); tree = null; jest.restoreAllMocks(); });

test('the image fits the screen and never pans outside it', () => {
  const fitted = fittedSize(AREA, 1600 / 2114);
  expect(fitted.width).toBeCloseTo(400);
  expect(fitted.height).toBeCloseTo(400 * 2114 / 1600);
  expect(clampOffset({ x: 999, y: -999 }, 1, fitted, AREA)).toEqual({ x: 0, y: 0 });
  const zoomed = clampOffset({ x: 999, y: -999 }, 3, fitted, AREA);
  expect(zoomed.x).toBeCloseTo((400 * 3 - 400) / 2);
  expect(zoomed.y).toBeCloseTo(-(fitted.height * 3 - 800) / 2);
  expect(zoomAround({ x: 100, y: 0 }, 1, 2, { x: 0, y: 0 })).toEqual({ x: -100, y: 0 });
});

const controller = () => {
  let view = { scale: 1, x: 0, y: 0 };
  const fitted = fittedSize(AREA, 1600 / 2114);
  const apply = next => {
    const scale = Math.min(MAX_SCALE, Math.max(1, next.scale));
    view = { scale, ...clampOffset(next, scale, fitted, AREA) };
  };
  const c = createZoomController({ getView: () => view, getArea: () => AREA, apply, now: () => now });
  return { c, view: () => view };
};
const tap = (c, x, y) => { c.grant([touch(x, y)]); c.release({ x, y }); };

test('double tap zooms into the tapped point and a second double tap returns to normal', () => {
  const { c, view } = controller();
  tap(c, 300, 400); now += 120; tap(c, 300, 400);
  expect(view().scale).toBe(DOUBLE_TAP_SCALE);
  expect(view().x).toBeLessThan(0); // o ponto à direita do centro fica sob o dedo
  now += 1000; tap(c, 200, 400); now += 120; tap(c, 200, 400);
  expect(view()).toEqual({ scale: 1, x: 0, y: 0 });
});

test('two slow taps or a drag do not zoom', () => {
  const { c, view } = controller();
  tap(c, 300, 400); now += DOUBLE_TAP_MS + 10; tap(c, 300, 400);
  expect(view().scale).toBe(1);
  c.grant([touch(300, 400)]); c.move([touch(340, 400)], 40, 0); c.release({ x: 340, y: 400 });
  now += 50; tap(c, 340, 400);
  expect(view().scale).toBe(1);
});

test('pinching with two fingers zooms up to the maximum, pans while zoomed and returns to 1', () => {
  const { c, view } = controller();
  c.grant([touch(150, 400), touch(250, 400)]);
  c.move([touch(100, 400), touch(300, 400)]);
  expect(view().scale).toBeCloseTo(2);
  c.move([touch(0, 400), touch(4000, 400)]);
  expect(view().scale).toBe(MAX_SCALE);
  c.release();
  c.grant([touch(200, 400)]); c.move([touch(260, 430)], 60, 30); c.release();
  expect(view().x).not.toBe(0);
  c.grant([touch(150, 400), touch(250, 400)]);
  c.move([touch(199, 400), touch(201, 400)]);
  c.release();
  expect(view()).toEqual({ scale: 1, x: 0, y: 0 });
});

test('a second finger arriving after the first starts a pinch from there', () => {
  const { c, view } = controller();
  c.grant([touch(150, 400)]);
  c.move([touch(150, 400), touch(250, 400)]);
  c.move([touch(100, 400), touch(300, 400)]);
  expect(view().scale).toBeCloseTo(2);
});

test('closing works from the button and from Android back', async () => {
  const onClose = jest.fn();
  await render({ onClose });
  await act(async () => tree.root.findAll(n => n.props.accessibilityLabel === 'Fechar imagem ampliada' && n.props.onPress)[0].props.onPress());
  expect(back()).toBe(true);
  expect(onClose).toHaveBeenCalledTimes(2);
  await act(async () => tree.update(<ZoomableImageModal visible={false} onClose={onClose} />));
  expect(tree.toJSON()).toBeNull();
});
