// src/services/registroPhoto.js
// Persistência e redução de fotos do registro (sem UI).
//
// - Original: copiado para o sandbox do app (offline/preview), sem recompressão.
// - Nuvem: versão JPEG reduzida em Base64, só quando cabe no limite do Firestore
//   (documento de 1 MiB).
import RNFS from "react-native-fs";
import ImageResizer from "react-native-image-resizer";

export const MAX_B64_CHARS = 900000;
export const UPLOAD_MAX_DIM = 1280; // largura/altura máxima
export const UPLOAD_JPEG_QUALITY = 70; // 0-100
export const ORIGINAL_IMAGE_QUALITY = 1; // imagem original para preview/offline

const NO_UPLOAD = { base64: null, mime: "image/jpeg", sizeBytes: null };

export function estimateBytesFromBase64(b64) {
  if (!b64) return 0;
  const len = b64.length;
  const padding = b64.endsWith("==") ? 2 : b64.endsWith("=") ? 1 : 0;
  return Math.max(0, Math.floor((len * 3) / 4) - padding);
}

export function safeFilenamePart(v) {
  return String(v || "")
    .trim()
    .replace(/[^\w-]+/g, "_")
    .slice(0, 60);
}

export function inferMimeFromUri(uri) {
  const u = String(uri || "").toLowerCase();
  if (u.endsWith(".png")) return "image/png";
  if (u.endsWith(".webp")) return "image/webp";
  return "image/jpeg";
}

const extensionFromMime = (m) => {
  if (m === "image/png") return "png";
  if (m === "image/webp") return "webp";
  return "jpg";
};

// Gera Base64 reduzido (JPEG) a partir de arquivo local file:// para envio.
export async function makeUploadBase64FromLocalFile(localFileUri) {
  if (!localFileUri || !String(localFileUri).startsWith("file://")) return NO_UPLOAD;

  try {
    const resized = await ImageResizer.createResizedImage(
      localFileUri,
      UPLOAD_MAX_DIM,
      UPLOAD_MAX_DIM,
      "JPEG",
      UPLOAD_JPEG_QUALITY,
      0
    );

    const resizedUri = resized?.uri || null;
    if (!resizedUri) return NO_UPLOAD;

    const resizedPath = String(resizedUri).replace(/^file:\/\//, "");
    if (!(await RNFS.exists(resizedPath))) return NO_UPLOAD;

    const base64 = await RNFS.readFile(resizedPath, "base64");
    if (!base64) return NO_UPLOAD;

    return { base64, mime: "image/jpeg", sizeBytes: estimateBytesFromBase64(base64) };
  } catch {
    return NO_UPLOAD;
  }
}

// Copia a imagem original para o sandbox do app (file://) para manter offline/preview.
export async function persistPhotoToAppStorage(assetUri, mime, recordIdForName) {
  if (!assetUri) return null;

  try {
    const ext = extensionFromMime(mime || inferMimeFromUri(assetUri));
    const dir = `${RNFS.DocumentDirectoryPath}/sismorcego_photos`;
    if (!(await RNFS.exists(dir))) await RNFS.mkdir(dir);

    const fileName = `registro_${safeFilenamePart(recordIdForName)}_${Date.now()}.${ext}`;
    const destPath = `${dir}/${fileName}`;

    if (String(assetUri).startsWith("file://")) {
      const srcPath = assetUri.replace(/^file:\/\//, "");
      if (!(await RNFS.exists(srcPath))) return null;
      await RNFS.copyFile(srcPath, destPath);
      return `file://${destPath}`;
    }

    // Best-effort para content:// (pode falhar conforme Android/Provider).
    try {
      const b64 = await RNFS.readFile(assetUri, "base64");
      if (!b64) return null;
      await RNFS.writeFile(destPath, b64, "base64");
      return `file://${destPath}`;
    } catch {
      return null;
    }
  } catch {
    return null;
  }
}

// Processa a foto escolhida. Retorna o estado final do anexo + um aviso opcional.
//   notice: null | { tone, message }
export async function processPickedPhoto({ uri, mime, recordIdForName }) {
  const m = mime || inferMimeFromUri(uri);

  // 1) Original salvo no app (offline/preview).
  const localFileUri = await persistPhotoToAppStorage(uri, m, recordIdForName);

  const base = {
    previewUri: localFileUri || uri || null,
    localUri: localFileUri || null,
    base64: null,
    mime: m,
    sizeBytes: null,
    notice: null,
  };

  // 2) Base64 para nuvem sempre vem da versão reduzida (nunca do image-picker).
  const sourceForUpload = localFileUri || (uri && String(uri).startsWith("file://") ? uri : null);
  const reduced = sourceForUpload ? await makeUploadBase64FromLocalFile(sourceForUpload) : NO_UPLOAD;

  if (!reduced.base64) {
    return {
      ...base,
      notice: {
        tone: "warning",
        message: "Foto salva no aparelho, mas não foi possível prepará-la para envio.",
      },
    };
  }

  if (reduced.base64.length > MAX_B64_CHARS) {
    return {
      ...base,
      notice: {
        tone: "warning",
        message: "A foto ficou grande para envio. O registro seguirá com a foto só no aparelho.",
      },
    };
  }

  return {
    ...base,
    base64: reduced.base64,
    mime: reduced.mime || "image/jpeg",
    sizeBytes: reduced.sizeBytes,
  };
}
