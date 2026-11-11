// Foto da ocorrência na nuvem, num documento separado da ficha:
//   registros/{uid}/itens/{recordId}/foto/principal = { mime, base64, size, updatedAt }
// A lista e o painel continuam leves; a foto só é baixada ao abrir os detalhes
// ou gerar o PDF. Gratuito no plano Spark (sem Firebase Storage).
import { deleteDoc, doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore';
import { db as defaultDb } from './firebase';

export const PHOTO_DOC_ID = 'principal';
export const MAX_PHOTO_BASE64 = 900000; // cabe no limite de 1 MiB por documento do Firestore
const MIMES = ['image/jpeg', 'image/png', 'image/webp'];

const photoRef = (database, uid, recordId) => doc(database, 'registros', uid, 'itens', String(recordId), 'foto', PHOTO_DOC_ID);
const stripDataUrl = value => String(value || '').replace(/^data:[^;]+;base64,/, '');

// Impressão digital barata (tamanho + hash FNV-1a) para não reenviar a mesma foto.
export function photoFingerprint(base64) {
  const text = stripDataUrl(base64);
  if (!text) return null;
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i += 1) { hash ^= text.charCodeAt(i); hash = Math.imul(hash, 0x01000193) >>> 0; }
  return `${text.length}:${hash.toString(16)}`;
}

// Chamado depois que a ficha foi gravada. Devolve a impressão digital da foto
// que está na nuvem (ou null). Erros sobem: a ficha fica para nova tentativa.
export async function syncRecordPhoto(registro, uid, database = defaultDb) {
  const base64 = registro?.photoHidden ? '' : stripDataUrl(registro?.photoBase64);
  const fingerprint = photoFingerprint(base64);
  const uploaded = registro?.photoCloudFingerprint || null;
  if (fingerprint === uploaded) return uploaded;
  const ref = photoRef(database, uid, registro.recordId);
  if (fingerprint) {
    if (base64.length > MAX_PHOTO_BASE64) throw new Error('A fotografia é grande demais para enviar. Anexe a foto novamente.');
    const mime = MIMES.includes(registro.photoMime) ? registro.photoMime : 'image/jpeg';
    await setDoc(ref, { mime, base64, size: Math.round(base64.length * 0.75), updatedAt: serverTimestamp() });
    return fingerprint;
  }
  // A foto foi removida depois de enviada: apaga a cópia da nuvem.
  if (uploaded) await deleteDoc(ref);
  return null;
}

export async function loadCloudPhoto(uid, recordId, database = defaultDb) {
  if (!database || !uid || !recordId) return null;
  try {
    const snapshot = await getDoc(photoRef(database, uid, recordId));
    const data = snapshot.exists() ? snapshot.data() : null;
    return data?.base64 ? { base64: data.base64, mime: data.mime || 'image/jpeg' } : null;
  } catch {
    return null; // sem permissão/rede: a ficha continua utilizável sem a foto
  }
}

const hasLocalPhoto = raw => Boolean(!raw?.photoHidden && (raw?.photoBase64 || raw?.photoUriLocal || raw?.photoLocalUri));
const cameFromCloud = raw => Boolean(raw && (raw._origin === 'cloud' || raw.hasServerCopy || raw.serverRevision));

// Registro bruto (fila/nuvem) com a foto da nuvem anexada, quando faltar localmente.
export async function withCloudPhotoRaw(raw, database = defaultDb) {
  if (!raw || hasLocalPhoto(raw) || !cameFromCloud(raw)) return raw;
  const photo = await loadCloudPhoto(raw.uid, raw.recordId || raw.id, database);
  if (!photo) return raw;
  return { ...raw, photoBase64: photo.base64, photoMime: photo.mime, photoHidden: false,
    photoCloudFingerprint: photoFingerprint(photo.base64) };
}

// O mesmo para o registro de tela (toRecordView): preenche record.photo.
export async function withCloudPhotoView(record, database = defaultDb) {
  if (!record || record.photo || !record._raw) return record;
  const raw = await withCloudPhotoRaw(record._raw, database);
  if (raw === record._raw) return record;
  const dataUrl = `data:${raw.photoMime};base64,${raw.photoBase64}`;
  return { ...record, _raw: raw, photo: { uri: dataUrl, dataUrl, localUri: null, base64: raw.photoBase64, mime: raw.photoMime } };
}
