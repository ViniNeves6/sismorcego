import { PermissionsAndroid, Platform } from 'react-native';
import Geolocation from '@react-native-community/geolocation';
import { launchCamera, launchImageLibrary } from 'react-native-image-picker';
import { processPickedPhoto } from '../src/services/registroPhoto';
import { captureGpsLocation, pickRegistroPhoto } from '../src/services/deviceCapture';

jest.mock('@react-native-community/geolocation', () => ({ getCurrentPosition: jest.fn(), requestAuthorization: jest.fn(), setRNConfiguration: jest.fn() }));
jest.mock('react-native-image-picker', () => ({ launchCamera: jest.fn(), launchImageLibrary: jest.fn() }));
jest.mock('../src/services/registroPhoto', () => ({ processPickedPhoto: jest.fn() }));
beforeEach(() => {
  jest.clearAllMocks();
  Platform.OS = 'android';
  jest.spyOn(PermissionsAndroid, 'requestMultiple').mockResolvedValue({
    [PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION]: 'granted',
    [PermissionsAndroid.PERMISSIONS.ACCESS_COARSE_LOCATION]: 'granted',
  });
});

test('denied permission never captures or invents coordinates', async () => {
  PermissionsAndroid.requestMultiple.mockResolvedValue({ fine: 'denied', coarse: 'denied' });
  await expect(captureGpsLocation()).rejects.toThrow('Permissão');
  expect(Geolocation.getCurrentPosition).not.toHaveBeenCalled();
});
test('GPS failure stays an error after trying actual coarse location', async () => {
  Geolocation.getCurrentPosition.mockImplementation((ok, fail) => fail({ code: 2 }));
  await expect(captureGpsLocation()).rejects.toThrow('Não foi possível obter');
  expect(Geolocation.getCurrentPosition).toHaveBeenCalledTimes(2);
  expect(Geolocation.getCurrentPosition.mock.calls.map(call => call[2])).toEqual([
    { enableHighAccuracy: true, timeout: 20000, maximumAge: 5000 },
    { enableHighAccuracy: false, timeout: 12000, maximumAge: 30000 },
  ]);
});
test('coarse fallback saves actual device coordinates and estimated accuracy', async () => {
  Geolocation.getCurrentPosition.mockImplementationOnce((ok, fail) => fail({ code: 3 }))
    .mockImplementationOnce(ok => ok({ coords: { latitude: -1.5, longitude: -48.5, accuracy: 190 } }));
  expect(await captureGpsLocation()).toEqual({ lat: -1.5, lng: -48.5, accuracy: 190, source: 'gps_coarse', isHighAccuracy: false });
});

test('approximate-only Android permission is respected and never labeled as high accuracy', async () => {
  PermissionsAndroid.requestMultiple.mockResolvedValue({
    [PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION]: 'denied',
    [PermissionsAndroid.PERMISSIONS.ACCESS_COARSE_LOCATION]: 'granted',
  });
  Geolocation.getCurrentPosition.mockImplementation(ok => ok({ coords: { latitude: -1.234567891, longitude: -48.123456789, accuracy: 900 } }));
  expect(await captureGpsLocation()).toEqual({ lat: -1.234567891, lng: -48.123456789, accuracy: 900, source: 'gps_coarse', isHighAccuracy: false });
  expect(Geolocation.getCurrentPosition.mock.calls[0][2].enableHighAccuracy).toBe(false);
});

test('a permission error from the device does not launch an unauthorized fallback', async () => {
  Geolocation.getCurrentPosition.mockImplementation((ok, fail) => fail({ code: 1 }));
  await expect(captureGpsLocation()).rejects.toThrow('Permissão');
  expect(Geolocation.getCurrentPosition).toHaveBeenCalledTimes(1);
});

test.each([[NaN, -48], [91, -48], [-1, 181], [undefined, undefined]])('invalid coordinates %s / %s never become a capture', async (latitude, longitude) => {
  Geolocation.getCurrentPosition.mockImplementation(ok => ok({ coords: { latitude, longitude, accuracy: 2 } }));
  await expect(captureGpsLocation()).rejects.toThrow();
});

test('iOS waits for authorization callbacks before requesting a position and respects denial', async () => {
  Platform.OS = 'ios';
  Geolocation.requestAuthorization.mockImplementation((ok, fail) => fail({ code: 1 }));
  await expect(captureGpsLocation()).rejects.toThrow('Permissão');
  expect(Geolocation.getCurrentPosition).not.toHaveBeenCalled();
  Geolocation.requestAuthorization.mockImplementation(ok => ok());
  Geolocation.getCurrentPosition.mockImplementation(ok => ok({ coords: { latitude: -1, longitude: -48, accuracy: -1 } }));
  expect(await captureGpsLocation()).toMatchObject({ lat: -1, lng: -48, accuracy: null });
  expect(Geolocation.setRNConfiguration).toHaveBeenCalledWith({ authorizationLevel: 'whenInUse', enableBackgroundLocationUpdates: false });
});
test('camera error propagates, and gallery cancellation has no success result', async () => {
  launchCamera.mockResolvedValue({ errorCode: 'permission' });
  await expect(pickRegistroPhoto('camera')).rejects.toThrow('Autorize');
  launchImageLibrary.mockResolvedValue({ didCancel: true });
  expect(await pickRegistroPhoto('gallery')).toBeNull();
  expect(processPickedPhoto).not.toHaveBeenCalled();
});
test('persists and reduces the real photo before returning an attachment', async () => {
  launchCamera.mockResolvedValue({ assets: [{ uri: 'file:///temporary.jpg', type: 'image/jpeg' }] });
  processPickedPhoto.mockResolvedValue({ localUri: 'file:///saved.jpg', previewUri: 'file:///saved.jpg', base64: 'compressed', mime: 'image/jpeg' });
  expect(await pickRegistroPhoto('camera')).toMatchObject({ uri: 'file:///saved.jpg', localUri: 'file:///saved.jpg', base64: 'compressed' });
  expect(launchCamera.mock.calls[0][0].includeBase64).toBe(false);
  processPickedPhoto.mockResolvedValue({ localUri: null });
  await expect(pickRegistroPhoto('camera')).rejects.toThrow('salvar a fotografia');
});
