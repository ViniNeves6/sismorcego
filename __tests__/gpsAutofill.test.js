import React, { useState } from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { Text, TextInput } from 'react-native';
import NovaNotificacaoScreen from '../src/pages/Main/NovaNotificacaoScreen';
import { captureGpsLocation } from '../src/services/deviceCapture';
import { reverseGeocodeLocation, reverseGeocodeMunicipio } from '../src/services/geocoding';

jest.mock('../src/ui/GpsMapPreview', () => () => null);
jest.mock('../src/services/redesignData', () => ({}));
jest.mock('../src/services/deviceCapture', () => ({ captureGpsLocation: jest.fn(), pickRegistroPhoto: jest.fn() }));
jest.mock('../src/utils/logger', () => ({ warn: jest.fn() }));
jest.mock('react-native-svg', () => ({
  __esModule: true, default: 'Svg', Path: 'Path', Circle: 'Circle', Rect: 'Rect', Line: 'Line', Polyline: 'Polyline',
}));

const coords = { lat: -1.4, lng: -48.4, accuracy: 8, source: 'gps_high', isHighAccuracy: true };
const response = address => ({ ok: true, json: async () => ({ address }) });
let tree;
function Form({ initialCity = '', initialCommunity = '', visible = true }) {
  const [city, setCity] = useState(initialCity);
  const [community, setCommunity] = useState(initialCommunity);
  const [gpsState, setGpsState] = useState(null);
  if (!visible) return null;
  return <NovaNotificacaoScreen reporterName="Ana" reduceMotion selectedVictimKey="humano"
    victimData={{ humano: {}, canino: {}, aves: {}, producao: {} }} victimSaved={{}}
    city={city} setCity={setCity} community={community} setCommunity={setCommunity}
    gpsState={gpsState} setGpsState={setGpsState} />;
}
const mount = async props => act(async () => { tree = TestRenderer.create(<Form {...props} />); });
const field = placeholder => tree.root.findAllByType(TextInput).find(node => node.props.placeholder === placeholder);
const gpsButton = () => tree.root.findAll(node => typeof node.props.onPress === 'function'
  && node.findAllByType(Text).some(text => ['Obter a localização pelo GPS', 'Coordenadas GPS gravadas com sucesso'].includes(text.props.children)))[0];

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(global, 'fetch').mockResolvedValue(response({ city: 'Belém', suburb: 'Marco' }));
  captureGpsLocation.mockResolvedValue(coords);
});
afterEach(async () => {
  if (tree) await act(async () => tree.unmount());
  tree = null;
  jest.restoreAllMocks();
  jest.useRealTimers();
});

test.each([
  [{ city: 'Belém', neighbourhood: 'Comunidade Nova', suburb: 'Marco' }, 'Belém', 'Comunidade Nova'],
  [{ city: 'Belém', suburb: 'Marco' }, 'Belém', 'Marco'],
  [{ municipality: 'Curuçá', village: 'Vila Lauro Sodré' }, 'Curuçá', 'Vila Lauro Sodré'],
  [{ county: 'Curuçá', hamlet: 'Comunidade rural' }, 'Curuçá', 'Comunidade rural'],
  [{ city: 'Belém', village: 'Belém', road: 'Rua de teste' }, 'Belém', null],
  [{ city: 'Belém', road: 'Rua de teste', name: 'Estabelecimento' }, 'Belém', null],
])('geocoding distinguishes municipality and locality in %j', async (address, municipio, localidade) => {
  fetch.mockResolvedValueOnce(response(address));
  expect(await reverseGeocodeLocation(coords.lat, coords.lng)).toEqual({ municipio, localidade });
  expect(fetch.mock.calls[0][0]).toContain('zoom=18&addressdetails=1&accept-language=pt-BR');
});

test('municipality-only callers retain their string response', async () => {
  expect(await reverseGeocodeMunicipio(coords.lat, coords.lng)).toBe('Belém');
});

test('invalid coordinates do not start an address lookup', async () => {
  expect(await reverseGeocodeLocation(91, coords.lng)).toBeNull();
  expect(fetch).not.toHaveBeenCalled();
});

test('an unavailable address service does not fabricate a locality', async () => {
  fetch.mockResolvedValueOnce({ ok: false });
  expect(await reverseGeocodeLocation(coords.lat, coords.lng)).toBeNull();
  fetch.mockRejectedValueOnce(new Error('offline'));
  expect(await reverseGeocodeLocation(coords.lat, coords.lng)).toBeNull();
});

test('a stalled address lookup is cancelled after eight seconds', async () => {
  jest.useFakeTimers();
  fetch.mockImplementationOnce((url, { signal }) => new Promise((resolve, reject) => {
    signal.addEventListener('abort', () => reject(new Error('aborted')));
  }));
  const lookup = reverseGeocodeLocation(coords.lat, coords.lng);
  await jest.advanceTimersByTimeAsync(8000);
  expect(await lookup).toBeNull();
});

test('capturing GPS automatically fills municipality and community and leaves both editable', async () => {
  await mount();
  await act(async () => gpsButton().props.onPress());
  expect(field('Ex.: Curuçá').props.value).toBe('Belém');
  expect(field('Ex.: Vila Lauro Sodré').props.value).toBe('Marco');
  await act(async () => field('Ex.: Vila Lauro Sodré').props.onChangeText('Comunidade corrigida'));
  expect(field('Ex.: Vila Lauro Sodré').props.value).toBe('Comunidade corrigida');
});

test('text entered before or during a lookup is preserved', async () => {
  let finish;
  fetch.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
  await mount({ initialCity: 'Município informado' });
  let capture;
  await act(async () => { capture = gpsButton().props.onPress(); });
  await act(async () => field('Ex.: Vila Lauro Sodré').props.onChangeText('Comunidade informada'));
  await act(async () => { finish(response({ city: 'Belém', suburb: 'Marco' })); await capture; });
  expect(field('Ex.: Curuçá').props.value).toBe('Município informado');
  expect(field('Ex.: Vila Lauro Sodré').props.value).toBe('Comunidade informada');
});

test('GPS remains captured when the address cannot be found', async () => {
  fetch.mockRejectedValueOnce(new Error('offline'));
  await mount();
  await act(async () => gpsButton().props.onPress());
  expect(tree.root.findByType(NovaNotificacaoScreen).props.gpsState).toMatchObject({ ...coords, status: 'done' });
  expect(field('Ex.: Vila Lauro Sodré').props.value).toBe('');
});

test('a delayed result from a previous capture cannot fill the new position', async () => {
  let finish;
  fetch.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }))
    .mockResolvedValueOnce(response({ city: 'Curuçá' }));
  await mount();
  let firstCapture;
  await act(async () => { firstCapture = gpsButton().props.onPress(); });
  captureGpsLocation.mockResolvedValueOnce({ ...coords, lat: -0.7 });
  await act(async () => gpsButton().props.onPress());
  await act(async () => { finish(response({ city: 'Belém', suburb: 'Marco' })); await firstCapture; });
  expect(field('Ex.: Curuçá').props.value).toBe('Curuçá');
  expect(field('Ex.: Vila Lauro Sodré').props.value).toBe('');
});

test('leaving during GPS acquisition cancels pending updates and does not lock the form on return', async () => {
  let finish;
  captureGpsLocation.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
  await mount();
  let capture;
  await act(async () => { capture = gpsButton().props.onPress(); });
  await act(async () => tree.update(<Form visible={false} />));
  await act(async () => { finish(coords); await capture; });
  await act(async () => tree.update(<Form />));
  expect(tree.root.findByType(NovaNotificacaoScreen).props.gpsState).toBeNull();
  expect(gpsButton().props.disabled).toBe(false);
  expect(fetch).not.toHaveBeenCalled();
});
