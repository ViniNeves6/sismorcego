import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { Text } from 'react-native';
import { Animated } from '../src/ui/AccessibleNative';
import AnimatedScreenTransition from '../src/ui/AnimatedScreenTransition';
import AdminPanelScreen from '../src/pages/Admin/AdminPanelScreen';
import DeferredPanelMap from '../src/pages/Admin/DeferredPanelMap';

jest.mock('../src/ui/useReduceMotion', () => () => mockSystemReducedMotion);
jest.mock('react-native-maps', () => {
  const ReactLib = require('react');
  const { View } = require('react-native');
  return { __esModule: true,
    default: ReactLib.forwardRef((props, ref) => {
      ReactLib.useImperativeHandle(ref, () => ({ animateToRegion: mockAnimateToRegion }));
      ReactLib.useEffect(() => { mockNativeMount(); }, []);
      return <View {...props} testID="deferred-native-map" />;
    }),
    Marker: props => <View {...props} testID="deferred-marker" />,
    Heatmap: props => <View {...props} testID="deferred-heatmap" />,
  };
});
jest.mock('react-native-svg', () => ({ __esModule: true, default: 'Svg', Path: 'Path', Circle: 'Circle', Rect: 'Rect',
  Line: 'Line', Polyline: 'Polyline', Polygon: 'Polygon', Defs: 'Defs', LinearGradient: 'LinearGradient', Stop: 'Stop' }));

let tree, frames, idleTasks, nextId, animations;
let mockSystemReducedMotion = false;
const mockAnimateToRegion = jest.fn(), mockNativeMount = jest.fn();
const originalSchedulers = Object.fromEntries(['requestAnimationFrame','cancelAnimationFrame','requestIdleCallback','cancelIdleCallback'].map(key => [key,global[key]]));
const rows = [{ uid:'agent',id:'one',victimKey:'humano',city:'Belém',isoDate:'2026-10-29',gps:{lat:-1.4,lng:-48.4} }];
const points = [{ id:'agent/one',latitude:-1.4,longitude:-48.4,weight:1 }];
const region = { latitude:-1.4,longitude:-48.4,latitudeDelta:0.1,longitudeDelta:0.1 };
const mapNodes = () => tree.root.findAllByProps({testID:'deferred-native-map'});
const hasText = value => tree.root.findAllByType(Text).some(node => node.props.children === value);
const frame = async () => act(async () => { const pending=[...frames.values()];frames.clear();pending.forEach(callback => callback()); });
const idle = async () => act(async () => { const pending=[...idleTasks.values()];idleTasks.clear();pending.forEach(callback => callback()); });
const open = async element => act(async () => { tree=TestRenderer.create(element); });
const visit = (key,reduceMotion=false) => <AnimatedScreenTransition screenKey={key} reduceMotion={reduceMotion}>
  {key==='panel' ? <AdminPanelScreen records={rows} reduceMotion /> : <Text>Registros</Text>}
</AnimatedScreenTransition>;

beforeEach(() => {
  frames=new Map();idleTasks=new Map();nextId=1;animations=[];mockSystemReducedMotion=false;
  mockAnimateToRegion.mockClear();mockNativeMount.mockClear();
  global.requestAnimationFrame=jest.fn(callback => {const id=nextId++;frames.set(id,callback);return id;});
  global.cancelAnimationFrame=jest.fn(id => frames.delete(id));
  global.requestIdleCallback=jest.fn(callback => {const id=nextId++;idleTasks.set(id,callback);return id;});
  global.cancelIdleCallback=jest.fn(id => idleTasks.delete(id));
  jest.spyOn(Animated,'timing').mockImplementation((value,config) => {
    let complete;
    const animation={start:callback=>{complete=callback;animations.push(animation);},stop:jest.fn(),
      finish:()=>{value.setValue(config.toValue);complete?.({finished:true});}};
    return animation;
  });
});
afterEach(async () => {
  if(tree)await act(async () => tree.unmount());tree=null;
  Object.entries(originalSchedulers).forEach(([key,value]) => {global[key]=value;});
  jest.restoreAllMocks();
});

test('panel renders its counters before navigation completes; native map waits for entry, two frames and idle',async()=>{
  await open(visit('panel'));
  expect(hasText('Total de registros')).toBe(true);
  expect(hasText('Carregando mapa…')).toBe(true);
  expect(mapNodes()).toHaveLength(0);expect(frames.size).toBe(0);
  await act(async () => animations.at(-1).finish());
  await frame();expect(mapNodes()).toHaveLength(0);
  await frame();expect(mapNodes()).toHaveLength(0);expect(idleTasks.size).toBe(1);
  await idle();expect(mapNodes().length).toBeGreaterThan(0);expect(mockNativeMount).toHaveBeenCalledTimes(1);
  expect(hasText('Carregando mapa…')).toBe(true);
  await act(async () => mapNodes()[0].props.onMapReady());
  expect(hasText('Carregando mapa…')).toBe(false);
  expect(hasText('Total de registros')).toBe(true);
});

test.each(['application','system'])('reduced motion from %s still paints the screen before mounting the map',async source=>{
  mockSystemReducedMotion=source==='system';
  await open(visit('panel',source==='application'));
  expect(animations).toHaveLength(0);expect(mapNodes()).toHaveLength(0);
  await frame();await frame();expect(mapNodes()).toHaveLength(0);
  await idle();expect(mockNativeMount).toHaveBeenCalledTimes(1);
});

test('leaving before idle cancels map work, including a late callback, and a new visit starts fresh',async()=>{
  await open(visit('panel',true));await frame();await frame();
  const lateIdle=[...idleTasks.values()][0];
  await act(async () => tree.update(visit('home',true)));
  expect(global.cancelIdleCallback).toHaveBeenCalled();
  await act(async () => lateIdle());expect(mockNativeMount).not.toHaveBeenCalled();
  await act(async () => tree.update(visit('panel',true)));
  expect(mapNodes()).toHaveLength(0);
  await frame();await frame();await idle();expect(mockNativeMount).toHaveBeenCalledTimes(1);
});

test('an interrupted old entry cannot enable the map on a quick return to the panel',async()=>{
  await open(visit('panel'));const oldEntry=animations.at(-1);
  await act(async () => tree.update(visit('home')));
  await act(async () => tree.update(visit('panel')));
  const latestExit=animations.at(-1);
  await act(async () => oldEntry.finish());
  expect(frames.size).toBe(0);expect(mockNativeMount).not.toHaveBeenCalled();
  await act(async () => latestExit.finish());
  expect(frames.size).toBe(0);expect(mockNativeMount).not.toHaveBeenCalled();
  await act(async () => animations.at(-1).finish());
  await frame();await frame();await idle();expect(mockNativeMount).toHaveBeenCalledTimes(1);
});

test('an existing map stays visible until the panel fade-out finishes',async()=>{
  await open(visit('panel'));
  await act(async () => animations.at(-1).finish());
  await frame();await frame();await idle();
  await act(async () => mapNodes()[0].props.onMapReady());
  expect(hasText('Carregando mapa…')).toBe(false);
  await act(async () => tree.update(visit('home')));
  expect(mapNodes().length).toBeGreaterThan(0);
  expect(hasText('Carregando mapa…')).toBe(false);
  expect(mockNativeMount).toHaveBeenCalledTimes(1);
  await act(async () => animations.at(-1).finish());
  expect(mapNodes()).toHaveLength(0);
  expect(hasText('Registros')).toBe(true);
});

test('filter changes before map readiness use the latest region, then update without remounting',async()=>{
  await open(<DeferredPanelMap points={points} region={region}/>);
  await frame();await frame();await idle();
  const latest={...region,latitude:-1.8};
  await act(async () => tree.update(<DeferredPanelMap points={points} region={latest}/>));
  expect(mockAnimateToRegion).not.toHaveBeenCalled();
  await act(async () => mapNodes()[0].props.onMapReady());
  expect(mockAnimateToRegion).toHaveBeenLastCalledWith(latest,0);
  await act(async () => tree.update(<DeferredPanelMap points={points} region={region}/>));
  expect(mockAnimateToRegion).toHaveBeenLastCalledWith(region,0);
  expect(mockNativeMount).toHaveBeenCalledTimes(1);
});

test('a panel without GPS records never initializes the native maps SDK',async()=>{
  await open(<AnimatedScreenTransition screenKey="panel" reduceMotion><AdminPanelScreen reduceMotion records={[]}/></AnimatedScreenTransition>);
  expect(hasText('Nenhum registro com GPS para esses filtros.')).toBe(true);
  expect(global.requestAnimationFrame).not.toHaveBeenCalled();
  expect(mockNativeMount).not.toHaveBeenCalled();
});

test('development StrictMode can restart an interrupted initial entry and still enable the map',async()=>{
  await open(<React.StrictMode>{visit('panel')}</React.StrictMode>);
  await act(async () => animations.at(-1).finish());
  await frame();await frame();await idle();
  expect(mapNodes().length).toBeGreaterThan(0);
  expect(mockNativeMount).toHaveBeenCalled();
});
