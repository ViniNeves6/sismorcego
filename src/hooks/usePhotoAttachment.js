// src/hooks/usePhotoAttachment.js
import { useCallback, useState } from "react";
import { launchCamera, launchImageLibrary } from "react-native-image-picker";
import RNFS from "react-native-fs";
import "react-native-get-random-values"; // precisa vir antes do nanoid
import { nanoid } from "nanoid";
import { useToast } from "../ui";
import {
  ORIGINAL_IMAGE_QUALITY,
  inferMimeFromUri,
  processPickedPhoto,
} from "../services/registroPhoto";

const EMPTY = { previewUri: null, localUri: null, base64: null, mime: null, sizeBytes: null };

// Foto anexada ao registro: escolher (câmera/galeria), estado e limpeza.
export default function usePhotoAttachment() {
  const toast = useToast();
  const [photo, setPhoto] = useState(EMPTY);

  const reset = useCallback(() => setPhoto(EMPTY), []);

  const pick = useCallback(
    (method) => {
      // Qualidade 1 = sem compressão (alguns aparelhos ainda recomprimem).
      const options = {
        mediaType: "photo",
        quality: ORIGINAL_IMAGE_QUALITY,
        includeBase64: false,
        saveToPhotos: false,
      };

      const callback = async (res) => {
        if (res?.didCancel) return;

        const asset = res?.assets?.[0];
        if (!asset?.uri) {
          if (res?.errorCode) {
            const where = method === "camera" ? "a câmera" : "a galeria";
            toast.show(res.errorMessage || `Não foi possível usar ${where}. Tente novamente.`, {
              tone: "danger",
            });
          }
          return;
        }

        try {
          if (String(asset.uri).startsWith("file://")) {
            const exists = await RNFS.exists(asset.uri.replace(/^file:\/\//, ""));
            if (!exists) {
              toast.show("A foto foi capturada, mas não pôde ser acessada.", { tone: "danger" });
              return;
            }
          }

          // ID temporário só para nomear o arquivo (não é o recordId do registro).
          const { notice, ...next } = await processPickedPhoto({
            uri: asset.uri,
            mime: asset.type || inferMimeFromUri(asset.uri),
            recordIdForName: nanoid(10),
          });
          setPhoto(next);
          if (notice) toast.show(notice.message, { tone: notice.tone });
        } catch {
          toast.show("Erro ao processar a foto.", { tone: "danger" });
        }
      };

      if (method === "camera") launchCamera(options, callback);
      else launchImageLibrary(options, callback);
    },
    [toast]
  );

  return { photo, hasPhoto: Boolean(photo.previewUri || photo.localUri), pick, reset };
}
