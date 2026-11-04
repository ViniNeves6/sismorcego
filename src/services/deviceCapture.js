import { PermissionsAndroid, Platform } from 'react-native';
import Geolocation from '@react-native-community/geolocation';
import { launchCamera, launchImageLibrary } from 'react-native-image-picker';
import { processPickedPhoto } from './registroPhoto';
import { gpsAccuracy, isValidGpsCoordinates } from './gpsCoordinates';

const position = highAccuracy => new Promise((resolve, reject) => {
  Geolocation.getCurrentPosition(result => {
    if (!isValidGpsCoordinates(result?.coords?.latitude, result?.coords?.longitude)) {
      reject(new Error('O aparelho não retornou coordenadas válidas. Tente novamente.'));
      return;
    }
    resolve(result);
  }, reject, {
    enableHighAccuracy: highAccuracy, timeout: highAccuracy ? 20000 : 12000,
    maximumAge: highAccuracy ? 5000 : 30000,
  });
});
export async function captureGpsLocation() {
  let highAccuracy = true;
  if (Platform.OS === 'android') {
    const permissions = await PermissionsAndroid.requestMultiple([
      PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION, PermissionsAndroid.PERMISSIONS.ACCESS_COARSE_LOCATION,
    ]);
    const fine = permissions[PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION] === PermissionsAndroid.RESULTS.GRANTED;
    const coarse = permissions[PermissionsAndroid.PERMISSIONS.ACCESS_COARSE_LOCATION] === PermissionsAndroid.RESULTS.GRANTED;
    if (!fine && !coarse) {
      throw new Error('Permissão de localização negada. Autorize o acesso para capturar o GPS.');
    }
    highAccuracy = fine;
  } else if (Platform.OS === 'ios') {
    Geolocation.setRNConfiguration({ authorizationLevel: 'whenInUse', enableBackgroundLocationUpdates: false });
    await new Promise((resolve, reject) => Geolocation.requestAuthorization(resolve, error => {
      reject(new Error(error?.code === 1
        ? 'Permissão de localização negada. Autorize o acesso nos ajustes do aparelho.'
        : 'Não foi possível autorizar a localização. Verifique se ela está ativada no aparelho.'));
    }));
  }
  let result;
  try { result = await position(highAccuracy); } catch (error) {
    if (error?.code === 1) throw new Error('Permissão de localização negada.');
    if (!highAccuracy) throw new Error('Não foi possível obter o GPS. Verifique a localização do aparelho e tente novamente.');
    highAccuracy = false;
    try { result = await position(false); } catch (cause) {
      throw new Error(cause?.code === 1 ? 'Permissão de localização negada.' : 'Não foi possível obter o GPS. Verifique a localização do aparelho e tente novamente em uma área aberta.');
    }
  }
  const { latitude, longitude, accuracy } = result.coords || {};
  return { lat: latitude, lng: longitude, accuracy: gpsAccuracy(accuracy), isHighAccuracy: highAccuracy, source: highAccuracy ? 'gps_high' : 'gps_coarse' };
}

export async function pickRegistroPhoto(source) {
  const options = { mediaType: 'photo', quality: 1, includeBase64: false, selectionLimit: 1 };
  const result = await (source === 'camera' ? launchCamera(options) : launchImageLibrary(options));
  if (result.didCancel) return null;
  if (result.errorCode) throw new Error(result.errorCode === 'permission' ? 'Autorize o acesso à câmera ou à galeria nas configurações do aparelho.' : result.errorMessage || 'Não foi possível abrir a fotografia.');
  const asset = result.assets?.[0];
  if (!asset?.uri) throw new Error('Nenhuma fotografia foi retornada pelo aparelho.');
  const photo = await processPickedPhoto({ uri: asset.uri, mime: asset.type, recordIdForName: `anexo-${Date.now()}` });
  if (!photo.localUri) throw new Error('Não foi possível salvar a fotografia no aparelho. Tente novamente.');
  return { ...photo, name: asset.fileName || 'Fotografia', uri: photo.previewUri, dataUrl: photo.previewUri };
}
