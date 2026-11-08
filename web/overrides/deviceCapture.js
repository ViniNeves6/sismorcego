// Web: substitui src/services/deviceCapture.js.
// GPS pelo navegador; foto pelo seletor do Safari (câmera ou fototeca), reduzida
// num <canvas> e guardada como data: URL no próprio registro.
import { gpsAccuracy, isValidGpsCoordinates } from '../../src/services/gpsCoordinates';
import { MAX_B64_CHARS } from '../../src/services/registroPhoto';

const MAX_DIM = 1280, QUALITY = 0.72;
const position = highAccuracy => new Promise((resolve, reject) => {
  if (!navigator.geolocation) { reject(Object.assign(new Error('unsupported'), { code: 2 })); return; }
  navigator.geolocation.getCurrentPosition(result => {
    if (!isValidGpsCoordinates(result?.coords?.latitude, result?.coords?.longitude)) {
      reject(new Error('O aparelho não retornou coordenadas válidas. Tente novamente.')); return;
    }
    resolve(result);
  }, reject, { enableHighAccuracy: highAccuracy, timeout: highAccuracy ? 20000 : 12000, maximumAge: highAccuracy ? 5000 : 30000 });
});

export async function captureGpsLocation() {
  let highAccuracy = true, result;
  try { result = await position(true); } catch (error) {
    if (error?.code === 1) throw new Error('Permissão de localização negada. No iPhone: Ajustes › Privacidade › Serviços de Localização › Safari.');
    highAccuracy = false;
    try { result = await position(false); } catch (cause) {
      throw new Error(cause?.code === 1 ? 'Permissão de localização negada.' : 'Não foi possível obter o GPS. Verifique a localização do aparelho e tente novamente em uma área aberta.');
    }
  }
  const { latitude, longitude, accuracy } = result.coords || {};
  return { lat: latitude, lng: longitude, accuracy: gpsAccuracy(accuracy), isHighAccuracy: highAccuracy, source: highAccuracy ? 'gps_high' : 'gps_coarse' };
}

// Precisa ser chamado direto do toque do usuário: o Safari só abre a câmera assim.
function chooseFile(source) {
  return new Promise(resolve => {
    const input = document.createElement('input');
    input.type = 'file'; input.accept = 'image/*';
    if (source === 'camera') input.capture = 'environment';
    input.style.display = 'none';
    const done = file => { input.remove(); resolve(file); };
    input.addEventListener('change', () => done(input.files?.[0] || null), { once: true });
    input.addEventListener('cancel', () => done(null), { once: true });
    document.body.appendChild(input);
    input.click();
  });
}

const loadImage = file => new Promise((resolve, reject) => {
  const url = URL.createObjectURL(file);
  const img = new Image();
  img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
  img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Não foi possível ler a fotografia.')); };
  img.src = url;
});

export async function pickRegistroPhoto(source) {
  const file = await chooseFile(source);
  if (!file) return null;
  const img = await loadImage(file);
  const scale = Math.min(1, MAX_DIM / Math.max(img.naturalWidth, img.naturalHeight));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(img.naturalWidth * scale); canvas.height = Math.round(img.naturalHeight * scale);
  canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
  const dataUrl = canvas.toDataURL('image/jpeg', QUALITY);
  const base64 = dataUrl.split(',')[1];
  if (base64.length > MAX_B64_CHARS) throw new Error('A fotografia ficou grande demais. Tente outra imagem.');
  return { previewUri: dataUrl, localUri: null, uri: dataUrl, dataUrl, base64, mime: 'image/jpeg',
    sizeBytes: Math.round(base64.length * 0.75), notice: null, name: file.name || 'Fotografia' };
}
