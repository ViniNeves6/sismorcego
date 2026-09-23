// src/pages/Main/NovoRegistro.js
import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  View,
  ScrollView,
  Text,
  TextInput,
  Platform,
  PermissionsAndroid,
  Image,
  Alert,
  TouchableOpacity,
  DeviceEventEmitter,
  StyleSheet,
  ActivityIndicator,
} from "react-native";
import { Picker } from "@react-native-picker/picker";
import DateTimePicker from "@react-native-community/datetimepicker";
import { launchCamera, launchImageLibrary } from "react-native-image-picker";
import MapView, { Marker } from "react-native-maps";
import Geolocation from "@react-native-community/geolocation";
import { addToQueue } from "../../services/offlineQueue";
import { syncPendingRegistros } from "../../services/syncRegistros";
import NetInfo from "@react-native-community/netinfo";
import "react-native-get-random-values";
import { nanoid } from "nanoid";
import { auth } from "../../services/firebase";
import Header from "../../components/Header/Header";
import CustomButton from "../../components/Button/CustomButton";
import useAccessibility from "../../hooks/useAccessibility";
import RNFS from "react-native-fs";
import ImageResizer from "react-native-image-resizer";
import logger from '../../utils/logger';
import styles from "./styles";
import CustomPicker from '../../components/CustomPicker/CustomPicker';

const hcLocal = StyleSheet.create({
  textGold: { color: "#FFD700" },
  imageFallbackContainer: { justifyContent: "center", alignItems: "center" },
  imageFallbackText: { color: "#666" },
  photoSavedText: { textAlign: "center", marginTop: 5, color: "green" },
});

// ===== Foto em Base64: limites (para não estourar Firestore 1MiB/doc) =====
// IMPORTANTE:
// - Aqui a imagem deve ser inserida no tamanho original (sem compressÃ£o de qualidade).
// - Ainda assim, BASE64 pode ficar grande. EntÃ£o:
//   1) Preferimos salvar o arquivo original localmente (filePath) e guardar "photoUriLocal".
//   2) SÃ³ guardamos base64 quando couber no limite, para uso em PDF/sync.
const MAX_B64_CHARS = 900000;
const UPLOAD_MAX_DIM = 1280; // dimensao maxima (largura/altura)
const UPLOAD_JPEG_QUALITY = 70; // 0-100
const ORIGINAL_IMAGE_QUALITY = 1; // imagem original para preview/offline

function estimateBytesFromBase64(b64) {
  if (!b64) return 0;
  const len = b64.length;
  const padding = b64.endsWith("==") ? 2 : b64.endsWith("=") ? 1 : 0;
  return Math.max(0, Math.floor((len * 3) / 4) - padding);
}

function safeFilenamePart(v) {
  return String(v || "")
    .trim()
    .replace(/[^\w-]+/g, "_")
    .slice(0, 60);
}

// Gera Base64 reduzido (JPEG) a partir de arquivo local file:// para envio ao Firestore.
async function makeUploadBase64FromLocalFile(localFileUri) {
  if (!localFileUri || !String(localFileUri).startsWith("file://")) {
    return { base64: null, mime: "image/jpeg", sizeBytes: null };
  }

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
    if (!resizedUri) {
      return { base64: null, mime: "image/jpeg", sizeBytes: null };
    }

    const resizedPath = String(resizedUri).replace(/^file:\/\//, "");
    const exists = await RNFS.exists(resizedPath);
    if (!exists) {
      return { base64: null, mime: "image/jpeg", sizeBytes: null };
    }

    const base64 = await RNFS.readFile(resizedPath, "base64");
    if (!base64) {
      return { base64: null, mime: "image/jpeg", sizeBytes: null };
    }

    return {
      base64,
      mime: "image/jpeg",
      sizeBytes: estimateBytesFromBase64(base64),
    };
  } catch {
    return { base64: null, mime: "image/jpeg", sizeBytes: null };
  }
}

export default function NovoRegistro() {
  const { fontScale, highContrast } = useAccessibility();

  // ===== Cores padronizadas para não depender do styles externo =====
  const colors = useMemo(() => {
    return {
      text: highContrast ? "#FFD700" : "#111111",
      placeholder: highContrast ? "#FFD700" : "#666666",
      inputBg: highContrast ? "#000000" : "#FFFFFF",
      inputBorder: highContrast ? "#FFD700" : "#CFCFCF",
      pickerBg: highContrast ? "#000000" : "#FFFFFF",
      pickerText: highContrast ? "#FFD700" : "#111111",
      pickerIcon: highContrast ? "#FFD700" : "#333333",
    };
  }, [highContrast]);

  // Styles dinÃ¢micos (apenas escala de fonte)
  const dyn = useMemo(
    () =>
      StyleSheet.create({
        text22: { fontSize: 22 * fontScale },
        text14: { fontSize: 14 * fontScale },
        inputText: { color: colors.text },
        pickerText: { color: colors.pickerText },
        dateDisplayText: { color: colors.text },
        datePlaceholderText: { color: colors.placeholder },
        locationAccuracyText: { textAlign: "center", marginTop: 6, color: colors.placeholder },
      }),
    [fontScale, colors]
  );

  // ===== Campos do Formulário =====
  const [nomeAcs, setNomeAcs] = useState("");
  const [dataRegistro, setDataRegistro] = useState(new Date());
  const [dataRegistroText, setDataRegistroText] = useState("DD/MM/AAAA");
  const [apelido, setApelido] = useState("");
  const [nomeAgredido, setNomeAgredido] = useState("");
  const [idade, setIdade] = useState("");
  const [sexo, setSexo] = useState("");
  const [tratamentoAntirrabico, setTratamentoAntirrabico] = useState("");
  const [dataAgressao, setDataAgressao] = useState(new Date());
  const [dataAgressaoText, setDataAgressaoText] = useState("DD/MM/AAAA");
  const [municipio, setMunicipio] = useState("");
  const [animalAgredido, setAnimalAgredido] = useState("");
  const [circunstancia, setCircunstancia] = useState("");
  const [possivelAbrigo, setPossivelAbrigo] = useState("");
  const [abrigoOpcao, setAbrigoOpcao] = useState("");
  const [abrigoOutro, setAbrigoOutro] = useState("");

  // ===== Outros estados =====
  const [showDatePicker, setShowDatePicker] = useState(null);

  // ✓ Guardamos precisÃ£o/qualidade do ponto (sem PII)
  // location = { latitude, longitude, accuracy, isHighAccuracy, source }
  const [location, setLocation] = useState(null);

  const [mapRegion, setMapRegion] = useState({
    latitude: -1.354986,
    longitude: -48.395724,
    latitudeDelta: 0.0922,
    longitudeDelta: 0.0421,
  });

  // Foto:
  // - fotoUri: usada para preview
  // - photoUriLocal: caminho salvo no app (file://...) => estratÃ©gia de dados locais endurecida
  // - base64: opcional, sÃ³ quando couber no limite (para PDF/Firestore)
  const [fotoUri, setFotoUri] = useState(null);
  const [fotoUriLocal, setFotoUriLocal] = useState(null);

  const [fotoBase64, setFotoBase64] = useState(null); // SEM prefixo data:image
  const [fotoMime, setFotoMime] = useState(null); // ex: image/jpeg
  const [fotoSize, setFotoSize] = useState(null); // bytes estimados

  const [loading, setLoading] = useState(false);
  const [loadingLocation, setLoadingLocation] = useState(false);

  // ===== Helpers =====
  const formatDate = (date) => {
    if (!date) return "DD/MM/AAAA";
    const d = new Date(date);
    const day = d.getDate().toString().padStart(2, "0");
    const month = (d.getMonth() + 1).toString().padStart(2, "0");
    const year = d.getFullYear();
    return `${day}/${month}/${year}`;
  };

  const resetForm = () => {
    setNomeAcs("");
    setDataRegistro(new Date());
    setDataRegistroText("DD/MM/AAAA");
    setApelido("");
    setNomeAgredido("");
    setIdade("");
    setSexo("");
    setTratamentoAntirrabico("");
    setDataAgressao(new Date());
    setDataAgressaoText("DD/MM/AAAA");
    setMunicipio("");
    setAnimalAgredido("");
    setCircunstancia("");
    setPossivelAbrigo("");
    setAbrigoOpcao("");
    setAbrigoOutro("");

    setLocation(null);

    setFotoUri(null);
    setFotoUriLocal(null);
    setFotoBase64(null);
    setFotoMime(null);
    setFotoSize(null);
  };

  const safeSync = useCallback((opts) => {
    syncPendingRegistros(opts).catch(() => {});
  }, []);

  // Efeito: tenta sincronizar ao montar e quando a rede muda
  useEffect(() => {
    const unsub = NetInfo.addEventListener((state) => {
      if (state.isConnected && state.isInternetReachable) {
        safeSync({
          notify: (n) => {
            Alert.alert("Sincronização", `${n} registro(s) enviados para o servidor.`);
            DeviceEventEmitter.emit("registros:changed");
          },
        });
      }
    });

    safeSync();
    return () => unsub();
  }, [safeSync]);

  // --- Handlers ---
  const onChangeData = (event, selectedDate, type) => {
    setShowDatePicker(null);
    if (selectedDate) {
      if (type === "registro") {
        setDataRegistro(selectedDate);
        setDataRegistroText(formatDate(selectedDate));
      } else {
        setDataAgressao(selectedDate);
        setDataAgressaoText(formatDate(selectedDate));
      }
    }
  };

  // ✓ Normaliza mime (se vier undefined)
  const inferMimeFromUri = (uri) => {
    const u = String(uri || "").toLowerCase();
    if (u.endsWith(".png")) return "image/png";
    if (u.endsWith(".webp")) return "image/webp";
    return "image/jpeg";
  };

  // ✓ Copia a imagem original para o sandbox do app (file://) para manter offline/preview
  const persistPhotoToAppStorage = useCallback(async (assetUri, mime, recordIdForName) => {
    if (!assetUri) return null;

    try {
      const extensionFromMime = (m) => {
        if (m === "image/png") return "png";
        if (m === "image/webp") return "webp";
        return "jpg";
      };

      const ext = extensionFromMime(mime || inferMimeFromUri(assetUri));
      const dir = `${RNFS.DocumentDirectoryPath}/sismorcego_photos`;
      const existsDir = await RNFS.exists(dir);
      if (!existsDir) await RNFS.mkdir(dir);

      const fileName = `registro_${safeFilenamePart(recordIdForName)}_${Date.now()}.${ext}`;
      const destPath = `${dir}/${fileName}`;

      // Se for file:// jÃ¡ dÃ¡ para copiar.
      // Se for content://, RNFS.copyFile pode falhar; nesse caso, tentamos readFile->writeFile (nem sempre funciona).
      if (String(assetUri).startsWith("file://")) {
        const srcPath = assetUri.replace(/^file:\/\//, "");
        const srcExists = await RNFS.exists(srcPath);
        if (!srcExists) return null;
        await RNFS.copyFile(srcPath, destPath);
        return `file://${destPath}`;
      }

      // Tentativa best-effort para content:// (pode falhar dependendo do Android/Provider)
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
  }, []);

  // Mantem o original local e gera Base64 reduzido apenas para upload.
  const applyPhotoPayload = useCallback(
    async ({ uri, base64: _ignoredBase64, mime, recordIdForName }) => {
      if (!uri) return;

      const m = mime || inferMimeFromUri(uri);

      // 1) Salva o arquivo ORIGINAL no app storage (offline/preview).
      const localFileUri = await persistPhotoToAppStorage(uri, m, recordIdForName);

      // 2) Preview/local sempre aponta para o original salvo no app quando disponivel.
      setFotoUri(localFileUri || uri || null);
      setFotoUriLocal(localFileUri || null);
      setFotoMime(m);

      // 3) Base64 para nuvem sempre vem de versao reduzida JPEG (nunca do image-picker).
      const sourceForUpload =
        localFileUri || (uri && String(uri).startsWith("file://") ? uri : null);

      const { base64: reducedB64, mime: reducedMime, sizeBytes } = sourceForUpload
        ? await makeUploadBase64FromLocalFile(sourceForUpload)
        : { base64: null, mime: "image/jpeg", sizeBytes: null };

      if (!reducedB64) {
        setFotoBase64(null);
        setFotoSize(null);
        Alert.alert(
          "Aviso",
          "A foto foi salva no dispositivo, mas nao foi possivel gerar a versao para envio a nuvem."
        );
        return;
      }

      if (reducedB64.length > MAX_B64_CHARS) {
        setFotoBase64(null);
        setFotoSize(null);
        Alert.alert(
          "Foto local salva",
          "A versao reduzida para nuvem ainda ficou grande. O registro seguira com a foto local no dispositivo."
        );
        return;
      }

      setFotoBase64(reducedB64);
      setFotoMime(reducedMime || "image/jpeg");
      setFotoSize(sizeBytes);
    },
    [persistPhotoToAppStorage]
  );

  const handleImagePicker = (method) => {
    // ✓ "tamanho original": quality = 1 (sem compressÃ£o de qualidade)
    // ObservaÃ§Ã£o: alguns aparelhos ainda podem recomprimir internamente; aqui garantimos o mÃ¡ximo possÃ­vel.
    const options = {
      mediaType: "photo",
      quality: ORIGINAL_IMAGE_QUALITY,
      includeBase64: false,
      saveToPhotos: false,
    };

    const callback = async (res) => {
      if (res?.didCancel) return;

      if (res?.assets?.[0]?.uri) {
        const asset = res.assets[0];
        const uri = asset.uri;
        const mime = asset.type || inferMimeFromUri(uri);

        try {
          // valida se o arquivo existe quando for file://
          if (uri && String(uri).startsWith("file://")) {
            const path = uri.replace(/^file:\/\//, "");
            const exists = await RNFS.exists(path);
            if (!exists) {
              Alert.alert("Erro", "A foto foi capturada mas não pôde ser acessada.");
              return;
            }
          }

          // recordIdForName temporÃ¡rio para nome do arquivo (não Ã© o recordId final do registro)
          const tempId = nanoid(10);
          await applyPhotoPayload({ uri, base64: null, mime, recordIdForName: tempId });
        } catch {
          Alert.alert("Erro", "Erro ao processar a foto.");
        }
      } else if (res?.errorCode) {
        Alert.alert(
          `Erro ao usar ${method === "camera" ? "cÃ¢mera" : "galeria"}`,
          res.errorMessage || "Tente novamente"
        );
      }
    };

    if (method === "camera") launchCamera(options, callback);
    else launchImageLibrary(options, callback);
  };

  const handleLocationSuccess = (position, isHighAccuracy) => {
    const { latitude, longitude, accuracy } = position.coords || {};
    const acc = typeof accuracy === "number" ? accuracy : null;

    setLocation({
      latitude,
      longitude,
      accuracy: acc,
      isHighAccuracy: !!isHighAccuracy,
      source: isHighAccuracy ? "gps_high" : "gps_coarse",
    });

    setMapRegion({
      latitude,
      longitude,
      latitudeDelta: 0.01,
      longitudeDelta: 0.01,
    });

    // ✓ Mensagem sensível: reforça que pode não ser tão precisa, mesmo quando pega "high accuracy"
    const accText = acc ? ` (precisão estimada: ~${Math.round(acc)} m)` : "";
    Alert.alert(
      "Localização registrada",
      `As coordenadas foram capturadas, mas a precisão pode variar conforme sinal/GPS${accText}. Se necessrio, tente novamente em uma área aberta.`
    );
  };

  const requestLocationPermission = async () => {
    try {
      setLoadingLocation(true);

      if (Platform.OS === "android") {
        const fine = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
          {
            title: "PermissÃ£o de LocalizaÃ§Ã£o",
            message: "O app precisa acessar sua localizaÃ§Ã£o para registrar o ponto.",
            buttonNeutral: "Pergunte-me depois",
            buttonNegative: "Cancelar",
            buttonPositive: "OK",
          }
        );

        const coarse = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.ACCESS_COARSE_LOCATION
        );

        const ok =
          fine === PermissionsAndroid.RESULTS.GRANTED ||
          coarse === PermissionsAndroid.RESULTS.GRANTED;

        if (!ok) {
          Alert.alert(
            "Permissão negada",
            "Sem permissão de localização não é possível obter as coordenadas."
          );
          return;
        }
      }

      if (Platform.OS === "ios") {
        try {
          const authz = await Geolocation.requestAuthorization();
          if (authz && authz !== "granted") {
            Alert.alert("Permissão negada", "Permissão de localização não concedida.");
            return;
          }
        } catch {
          // ok
        }
      }

      const getLocationWithOptions = (highAccuracy) => {
        return new Promise((resolve, reject) => {
          Geolocation.getCurrentPosition(resolve, reject, {
            enableHighAccuracy: highAccuracy,
            timeout: highAccuracy ? 20000 : 12000,
            maximumAge: highAccuracy ? 5000 : 30000,
          });
        });
      };

      try {
        const position = await getLocationWithOptions(true);
        handleLocationSuccess(position, true);
      } catch (highAccuracyError) {
        try {
          const position = await getLocationWithOptions(false);
          handleLocationSuccess(position, false);

          // ✓ Mensagem ajustada: deixa claro que não foi tÃ£o precisa
          const acc = position?.coords?.accuracy;
          const accText = typeof acc === "number" ? ` (~${Math.round(acc)} m)` : "";
          Alert.alert(
            "Localização aproximada",
            `não foi possível obter alta precisão. Usando localização aproximada${accText}. Se precisar, tente novamente em um local aberto e com GPS ativado.`
          );
        } catch (lowAccuracyError) {
          let msg = "não foi possivel obter sua localização. ";
          const code = lowAccuracyError?.code;

          if (code === 1) msg += "Permissão de localização negada.";
          else if (code === 2) msg += "Sinal de GPS indisponível. Tente em uma área aberta.";
          else if (code === 3) msg += "Tempo limite excedido. Tente novamente.";
          else msg += "Verifique se a localização do dispositivo está ativada.";

          Alert.alert("Erro de localização", msg);
        }
      }
    } catch (error) {
      logger.error("Erro ao solicitar permissão:", error);
      Alert.alert("Erro", "não foi possível acessar o serviço de localização.");
    } finally {
      setLoadingLocation(false);
    }
  };

  // --- Envio do Formulário ---
  const enviarFormulario = async () => {
    const user = auth?.currentUser;
    if (!user) {
      Alert.alert("Login necessário", "Faça login para criar registros e sincronizar depois.");
      return;
    }

    if (!nomeAcs || !nomeAgredido || !sexo || !tratamentoAntirrabico || !municipio) {
      Alert.alert("Campos obrigatórios", "Preencha todos os campos marcados com *");
      return;
    }

    setLoading(true);

    // recordId Ã© o ID do registro (não expÃµe PII)
    const recordId = nanoid();

    // ===== Modelo final (P0): decidir antes de mexer em PDF/sync =====
    // - PII local: serÃ¡ criptografada na camada SQLite (db/registro.js).
    // - Aqui: enviamos dados "em claro" para fila, e a persistÃªncia local criptografa o que for sensÃ­vel.
    // - Foto: sempre mantÃ©m arquivo local (photoUriLocal). Base64 sÃ³ se couber no limite.
    // - Location: inclui accuracy/isHighAccuracy para transparÃªncia de qualidade do dado (não Ã© PII).
    const registroData = {
      recordId,
      uid: user.uid,

      // PII (serÃ¡ criptografado no SQLite)
      nomeAcs,
      nomeAgredido,

      // demais campos
      dataRegistro: dataRegistro.toISOString(),
      apelido,
      idade: Number(idade) || null,
      sexo,
      tratamentoAntirrabico,
      dataAgressao: dataAgressao.toISOString(),
      municipio,
      animalAgredido,
      circunstancia,
      possivelAbrigo,
      abrigoOpcao,
      abrigoOutro: abrigoOutro || null,

      // localizaÃ§Ã£o (com metadados de precisÃ£o)
      location: location
        ? {
            latitude: location.latitude,
            longitude: location.longitude,
            accuracy: location.accuracy ?? null,
            isHighAccuracy: !!location.isHighAccuracy,
            source: location.source || null,
          }
        : null,

      // Foto: estratÃ©gia endurecida
      // - Base64 apenas quando couber no limite (para PDF/Firestore)
      photoBase64: fotoBase64 || null,
      photoMime: fotoMime || null,
      photoSize: typeof fotoSize === "number" ? fotoSize : null,

      // - URI do arquivo salvo no app (offline, tamanho original)
      photoUriLocal: fotoUriLocal || null,

      status: "pending",
      retryCount: 0,
      lastError: null,
      createdAt: new Date().toISOString(),
      updatedAtLocal: new Date().toISOString(),
    };

    try {
      await addToQueue(registroData);

      Alert.alert("Sucesso", "Registro salvo no dispositivo. Será enviado quando houver internet.");

      resetForm();
      DeviceEventEmitter.emit("registros:changed");

      safeSync({
        notify: (n) => {
          Alert.alert("Sincronização", `${n} registro(s) enviados para o servidor.`);
          DeviceEventEmitter.emit("registros:changed");
        },
      });
    } catch (error) {
      logger.error("Erro ao salvar registro:", error);
      Alert.alert("Erro", "não foi possível salvar o registro no dispositivo.");
    } finally {
      setLoading(false);
    }
  };

  // ===== Estilos forçados para picker ficar legível =====
  const pickerContainerFix = useMemo(
    () => ({
      backgroundColor: colors.pickerBg,
      borderColor: colors.inputBorder,
    }),
    [colors]
  );

  const pickerFix = useMemo(
    () => ({
      color: colors.pickerText,
      backgroundColor: colors.pickerBg,
    }),
    [colors]
  );

  const inputFix = useMemo(
    () => ({
      backgroundColor: colors.inputBg,
      borderColor: colors.inputBorder,
      color: colors.text,
    }),
    [colors]
  );

  return (
    <View style={[styles.page, highContrast && styles.pageHC]}>
      <Header title="SISMORCEGO" />

      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Text style={[styles.titulo, dyn.text20, highContrast && styles.tituloHC]}>
          Formulário de Registro
        </Text>

        <Text style={[styles.label, highContrast && styles.labelHC, dyn.text20]}>
          Nome do ACS*
        </Text>
        <TextInput
          style={[styles.input, inputFix, highContrast && styles.inputHC, dyn.text20]}
          placeholder="Digite o nome do ACS"
          placeholderTextColor={colors.placeholder}
          value={nomeAcs}
          onChangeText={setNomeAcs}
        />

        <Text style={[styles.label, highContrast && styles.labelHC, dyn.text20]}>
          Data do Registro*
        </Text>
        <TouchableOpacity
          style={[styles.input, inputFix, highContrast && styles.inputHC]}
          onPress={() => setShowDatePicker("registro")}
        >
          <Text
            style={[
              dyn.text20,
              dataRegistroText === "DD/MM/AAAA" ? dyn.datePlaceholderText : dyn.dateDisplayText,
              highContrast && styles.inputTextHC,
            ]}
          >
            {dataRegistroText}
          </Text>
        </TouchableOpacity>

        {showDatePicker === "registro" && (
          <DateTimePicker
            value={dataRegistro}
            mode="date"
            display={Platform.OS === 'ios' ? 'spinner' : 'default'}
            onChange={(e, d) => onChangeData(e, d, "registro")}
          />
        )}

        <Text style={[styles.label, highContrast && styles.labelHC, dyn.text20]}>
          Data da agressão*
        </Text>
        <TouchableOpacity
          style={[styles.input, inputFix, highContrast && styles.inputHC]}
          onPress={() => setShowDatePicker("agressao")}
        >
          <Text
            style={[
              dyn.text20,
              dataAgressaoText === "DD/MM/AAAA" ? dyn.datePlaceholderText : dyn.dateDisplayText,
              highContrast && styles.inputTextHC,
            ]}
          >
            {dataAgressaoText}
          </Text>
        </TouchableOpacity>

        {showDatePicker === "agressao" && (
          <DateTimePicker
            value={dataAgressao}
            mode="date"
            display={Platform.OS === "ios" ? "spinner" : "default"}
            onChange={(e, d) => onChangeData(e, d, "agressao")}
          />
        )}

        <Text style={[styles.label, highContrast && styles.labelHC, dyn.text20]}>Apelido</Text>
        <TextInput
          style={[styles.input, inputFix, highContrast && styles.inputHC, dyn.text20]}
          placeholder="Digite o apelido"
          placeholderTextColor={colors.placeholder}
          value={apelido}
          onChangeText={setApelido}
        />

        <Text style={[styles.label, highContrast && styles.labelHC, dyn.text20]}>
          Nome do Agredido*
        </Text>
        <TextInput
          style={[styles.input, inputFix, highContrast && styles.inputHC, dyn.text20]}
          placeholder="Digite o nome do agredido"
          placeholderTextColor={colors.placeholder}
          value={nomeAgredido}
          onChangeText={setNomeAgredido}
        />

        <Text style={[styles.label, highContrast && styles.labelHC, dyn.text20]}>Idade</Text>
        <TextInput
          style={[styles.input, inputFix, highContrast && styles.inputHC, dyn.text20]}
          placeholder="Digite a idade"
          placeholderTextColor={colors.placeholder}
          keyboardType="numeric"
          value={idade}
          onChangeText={setIdade}
        />

        {/* ===== Pickers ===== */}
          <Text style={[styles.label, highContrast && styles.labelHC, dyn.text20]}>
            Sexo*
          </Text>
          <CustomPicker
            selectedValue={sexo}
            onValueChange={setSexo}
            items={[
              { label: "Selecione", value: "" },
              { label: "Masculino", value: "M" },
              { label: "Feminino", value: "F" },
            ]}
            placeholder="Selecione o sexo"
            style={[styles.input, highContrast && styles.inputHC]}
            textStyle={dyn.text20}
            highContrast={highContrast}
          />

          <Text style={[styles.label, highContrast && styles.labelHC, dyn.text20]}>
            Tratamento Antirrábico*
          </Text>
          <CustomPicker
            selectedValue={tratamentoAntirrabico}
            onValueChange={setTratamentoAntirrabico}
            items={[
              { label: "Selecione", value: "" },
              { label: "Sim", value: "sim" },
              { label: "Não", value: "nao" },
            ]}
            placeholder="Selecione o tratamento"
            style={[styles.input, highContrast && styles.inputHC]}
            textStyle={dyn.text20}
            highContrast={highContrast}
          />

          <Text style={[styles.label, highContrast && styles.labelHC, dyn.text20]}>
            Animal Agredido?
          </Text>
          <CustomPicker
            selectedValue={animalAgredido}
            onValueChange={setAnimalAgredido}
            items={[
              { label: "Selecione", value: "" },
              { label: "Não", value: "nao" },
              { label: "Cão", value: "cao" },
              { label: "Gato", value: "gato" },
              { label: "Boi", value: "boi" },
              { label: "Porco", value: "porco" },
              { label: "Cavalo", value: "cavalo" },
              { label: "Aves", value: "aves" },
            ]}
            placeholder="Selecione o animal"
            style={[styles.input, highContrast && styles.inputHC]}
            textStyle={dyn.text20}
            highContrast={highContrast}
          />

          <Text style={[styles.label, highContrast && styles.labelHC, dyn.text20]}>
            Circunstância
          </Text>
          <CustomPicker
            selectedValue={circunstancia}
            onValueChange={setCircunstancia}
            items={[
              { label: "Selecione", value: "" },
              { label: "Pescando", value: "pescando" },
              { label: "Caçando", value: "cacando" },
              { label: "Lazer", value: "lazer" },
            ]}
            placeholder="Selecione a circunstância"
            style={[styles.input, highContrast && styles.inputHC]}
            textStyle={dyn.text20}
            highContrast={highContrast}
          />

          <Text style={[styles.label, highContrast && styles.labelHC, dyn.text20]}>
            Possível Abrigo?
          </Text>
          <CustomPicker
            selectedValue={possivelAbrigo}
            onValueChange={(val) => {
              setPossivelAbrigo(val);
              setAbrigoOpcao('');
              setAbrigoOutro('');
            }}
            items={[
              { label: "Selecione", value: "" },
              { label: "Sim", value: "sim" },
              { label: "Não", value: "nao" },
            ]}
            placeholder="Possui abrigo?"
            style={[styles.input, highContrast && styles.inputHC]}
            textStyle={dyn.text20}
            highContrast={highContrast}
          />

          {possivelAbrigo === 'sim' && (
            <>
              <Text style={[styles.label, highContrast && styles.labelHC, dyn.text20]}>
                Tipo de Abrigo
              </Text>
              <CustomPicker
                selectedValue={abrigoOpcao}
                onValueChange={setAbrigoOpcao}
                items={[
                  { label: "Selecione", value: "" },
                  { label: "Casa de madeira sem forro", value: "madeira" },
                  { label: "Casa de alvenaria sem forro", value: "alvenaria" },
                  { label: "Casa de alvenaria com forro", value: "alvenaria_forro" },
                  { label: "Barraco de lona", value: "lona" },
                  { label: "Não tem", value: "nao_tem" },
                  { label: "Outros", value: "outros" },
                ]}
                placeholder="Selecione o tipo de abrigo"
                style={[styles.input, highContrast && styles.inputHC]}
                textStyle={dyn.text20}
                highContrast={highContrast}
              />
            </>
          )}

        {possivelAbrigo === "sim" && abrigoOpcao === "outros" && (
          <>
            <Text style={[styles.label, highContrast && styles.labelHC, dyn.text20]}>
              Outro Abrigo (se houver)
            </Text>
            <TextInput
              style={[styles.input, inputFix, highContrast && styles.inputHC, dyn.text20]}
              placeholder="Descreva o abrigo"
              placeholderTextColor={colors.placeholder}
              value={abrigoOutro}
              onChangeText={setAbrigoOutro}
            />
          </>
        )}

        <Text style={[styles.sectionLabel, highContrast && styles.textHC]}>
          Município da agressão*
        </Text>
        <TextInput
          style={[styles.input, inputFix, highContrast && styles.inputHC, dyn.text20]}
          placeholder="Digite o município da agressão"
          placeholderTextColor={colors.placeholder}
          value={municipio}
          onChangeText={setMunicipio}
        />

        <Text style={[styles.sectionLabel, highContrast && styles.textHC]}>Geolocalização</Text>

        <View style={styles.locationButtonContainer}>
          <CustomButton
            title={loadingLocation ? "Buscando localização..." : "Obter Localização"}
            onPress={requestLocationPermission}
            disabled={loadingLocation}
          />
          {loadingLocation && (
            <ActivityIndicator size="small" color="#0000ff" style={styles.locationIndicator} />
          )}
        </View>

        <View style={styles.latlngRow}>
          <View style={styles.latlngCol}>
            <Text style={[styles.label, highContrast && styles.labelHC, dyn.text20]}>Lat</Text>
            <TextInput
              style={[styles.input, inputFix, highContrast && styles.inputHC, dyn.text20]}
              editable={false}
              value={location ? String(location.latitude).substring(0, 10) : ""}
              placeholder="—"
              placeholderTextColor={colors.placeholder}
            />
          </View>
          <View style={styles.latlngCol}>
            <Text style={[styles.label, highContrast && styles.labelHC, dyn.text20]}>Lng</Text>
            <TextInput
              style={[styles.input, inputFix, highContrast && styles.inputHC, dyn.text20]}
              editable={false}
              value={location ? String(location.longitude).substring(0, 10) : ""}
              placeholder="—"
              placeholderTextColor={colors.placeholder}
            />
          </View>
        </View>

        {location && (
          <>
            <Text style={dyn.locationAccuracyText}>
              {typeof location.accuracy === "number"
                ? `Precisão estimada: ~${Math.round(location.accuracy)} m (pode variar)`
                : "Precisão: não informada (pode variar)"}
            </Text>

            <MapView style={[styles.map, highContrast && styles.mapHC]} region={mapRegion}>
              <Marker coordinate={{ latitude: location.latitude, longitude: location.longitude }} />
            </MapView>
          </>
        )}

        <Text style={[styles.sectionLabel, highContrast && styles.textHC]}>Fotos</Text>
        <View style={styles.buttonsRow}>
          <CustomButton title="Carregar" onPress={() => handleImagePicker("gallery")} style={styles.buttonHalf} />
          <CustomButton title="Tirar" onPress={() => handleImagePicker("camera")} style={styles.buttonHalf} />
        </View>

        {(fotoUri || fotoUriLocal || fotoBase64) && (
          <>
            {fotoUri ? (
              <Image source={{ uri: fotoUri }} style={[styles.imagePreview, highContrast && styles.imageHC]} />
            ) : (
              <View style={[styles.imagePreview, hcLocal.imageFallbackContainer]}>
                <Text style={hcLocal.imageFallbackText}>Foto ok</Text>
              </View>
            )}

            <Text style={hcLocal.photoSavedText}>
              âœ“ Foto salva no dispositivo (tamanho original)
              {fotoUriLocal ? " —” arquivo local ok" : " —” arquivo local indisponÃ­vel"}
              {fotoBase64 && fotoSize ? ` —” Base64 ok (${Math.round(fotoSize / 1024)} KB)` : " —” Base64 nÃ£o salvo"}
            </Text>
          </>
        )}

        <CustomButton
          title={loading ? "Salvando..." : "Salvar Registro"}
          onPress={enviarFormulario}
          disabled={loading || loadingLocation}
        />
      </ScrollView>
    </View>
  );
}
