// src/pages/Main/Buscar.js (LOCAL + NUVEM)
// - Local: loadQueue() (offlineQueue)
// - Nuvem (quando online): Firestore registros/{uid}/itens
// - Mescla: nuvem vence local (por recordId)
// - Recarrega ao focar (useFocusEffect) e ao evento 'registros:changed'
// - PDF: RNHTMLtoPDF se disponível; fallback pdf-lib
// - Visualiza em Modal (react-native-pdf)
// - "Baixar": SAF (react-native-blob-util) se disponível; fallback RNFS/Share

import React, { useEffect, useMemo, useState, useCallback } from 'react';
import {
  ScrollView,
  Text,
  TouchableOpacity,
  View,
  ActivityIndicator,
  Alert,
  Modal,
  Platform,
  Share,
  DeviceEventEmitter,
} from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import RNFS from 'react-native-fs';
import Pdf from 'react-native-pdf';
import { useFocusEffect } from '@react-navigation/native';

import { loadQueue } from '../../services/offlineQueue';
import { db, auth } from '../../services/firebase';

import { collection, getDocs, query, orderBy, limit } from 'firebase/firestore';

import Header from '../../components/Header/Header';
import styles from './stylesBuscar';
import useAccessibility from '../../hooks/useAccessibility';
import logger from '../../utils/logger';

// ======= Dependências opcionais (tentativas) =======
let RNHTMLtoPDF;
try {
  RNHTMLtoPDF = require('react-native-html-to-pdf');
} catch (_e) {
  RNHTMLtoPDF = undefined;
}

let RNBlob;
try {
  RNBlob = require('react-native-blob-util');
} catch (_e) {
  RNBlob = undefined;
}

// ======= Polyfills para fallback pdf-lib no RN =======
try {
  const { Buffer } = require('buffer');
  if (Buffer && !global.Buffer) global.Buffer = Buffer;
  if (!global.btoa) {
    global.btoa = (s) => Buffer.from(s, 'binary').toString('base64');
  }
  if (!global.atob) {
    global.atob = (b64) => Buffer.from(b64, 'base64').toString('binary');
  }
} catch (_e) {
  // ok
}

/* ======================= Utils ======================= */
const normalizeFileUri = (p) => {
  if (!p) return null;
  return p.startsWith('file://') ? p : `file://${p}`;
};

const escapeHtml = (v) => {
  const s = String(v ?? '');
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
};

const formatarSexo = (sexo) => {
  if (sexo === 1 || String(sexo).toUpperCase() === 'M') return 'Masculino';
  if (sexo === 2 || String(sexo).toUpperCase() === 'F') return 'Feminino';
  return sexo || '-';
};

const formatarTratamento = (val) => {
  if (
    val === 1 ||
    val === true ||
    (typeof val === 'string' && val.toLowerCase() === 'sim')
  )
    return 'Sim';
  if (
    val === 0 ||
    val === false ||
    (typeof val === 'string' && val.toLowerCase() === 'nao')
  )
    return 'Não';
  return val || '-';
};

const formatarLista = (lista) =>
  Array.isArray(lista) ? lista.join(', ') : lista || '-';

const formatarBool = (v) => {
  if (v === true) return 'Sim';
  if (v === false) return 'Não';
  if (typeof v === 'string') {
    const s = v.trim().toLowerCase();
    if (s === 'sim' || s === 's' || s === 'true' || s === '1') return 'Sim';
    if (s === 'nao' || s === 'não' || s === 'n' || s === 'false' || s === '0')
      return 'Não';
  }
  if (v === 1) return 'Sim';
  if (v === 0) return 'Não';
  return v ?? '-';
};

const formatarDataCurta = (iso) => {
  if (!iso) return '-';
  try {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return String(iso);
    return d.toLocaleDateString();
  } catch {
    return String(iso);
  }
};

const safeFileName = (raw, prefix = 'Ficha') => {
  const base = String(raw ?? 'registro')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\w-]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '');
  const trimmed = base.slice(0, 40) || 'registro';
  return `${prefix}_${trimmed}`;
};

const getSortTime = (r) => {
  const a = r?.createdAt;
  if (a?.toDate) return a.toDate().getTime();
  if (typeof a === 'string') return new Date(a).getTime() || 0;
  const dr = r?.dataRegistro;
  if (typeof dr === 'string') return new Date(dr).getTime() || 0;
  return 0;
};

const mergeByRecordId = (cloudArr, localArr) => {
  const map = new Map();

  (Array.isArray(localArr) ? localArr : []).forEach((r, idx) => {
    const key = r?.recordId || r?.id || String(idx);
    map.set(key, { id: key, ...r, _origin: 'local' });
  });

  (Array.isArray(cloudArr) ? cloudArr : []).forEach((r, idx) => {
    const key = r?.recordId || r?.id || String(idx);
    map.set(key, { id: key, ...r, _origin: 'cloud' });
  });

  const out = Array.from(map.values());
  out.sort((a, b) => getSortTime(b) - getSortTime(a));
  return out;
};

/* ========= Fallback JS com pdf-lib ========= */
async function buildPdfWithPdfLib({ titulo, linhas, imageBase64 }) {
  let pdfLib;
  try {
    pdfLib = require('pdf-lib');
  } catch (_e) {
    Alert.alert(
      'PDF fallback indisponível',
      "Instale 'pdf-lib' para usar o fallback: npm i pdf-lib"
    );
    throw _e;
  }

  const { PDFDocument, StandardFonts, rgb } = pdfLib;
  const pdfDoc = await PDFDocument.create();

  let page = pdfDoc.addPage([595, 842]); // A4
  let height = page.getSize().height;
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);

  const marginX = 50;
  const marginTop = 50;
  const marginBottom = 60;
  let y = height - marginTop;

  const drawLine = (t, size = 12) => {
    page.drawText(String(t), {
      x: marginX,
      y,
      size,
      font,
      color: rgb(0, 0, 0),
    });
    y -= size + 4;
    if (y < marginBottom) {
      page = pdfDoc.addPage([595, 842]);
      height = page.getSize().height;
      y = height - marginTop;
    }
  };

  drawLine(titulo || 'Ficha Cadastral', 18);
  y -= 10;

  if (imageBase64) {
    try {
      const raw = String(imageBase64);
      const withoutPrefix = raw.replace(/^data:image\/\w+;base64,/, '');

      let bytes;
      if (global.Buffer) {
        bytes = global.Buffer.from(withoutPrefix, 'base64');
      } else if (typeof global.atob === 'function') {
        const bin = global.atob(withoutPrefix);
        bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
      } else {
        throw new Error('Base64 decode indisponível no ambiente atual.');
      }

      let img;
      if (/^data:image\/png/.test(raw)) img = await pdfDoc.embedPng(bytes);
      else img = await pdfDoc.embedJpg(bytes);

      const iw = 300;
      const ih = (img.height / img.width) * iw;

      if (y - ih < marginBottom) {
        page = pdfDoc.addPage([595, 842]);
        height = page.getSize().height;
        y = height - marginTop;
      }

      page.drawImage(img, { x: marginX, y: y - ih, width: iw, height: ih });
      y -= ih + 12;
    } catch (e) {
      logger.warn('Falha ao inserir imagem no PDF (fallback):', e);
    }
  }

  (linhas || []).forEach((linha) => drawLine(linha, 12));
  return pdfDoc.save();
}

/* ======================= Componente ======================= */
export default function Buscar() {
  const [registros, setRegistros] = useState([]);
  const [loading, setLoading] = useState(true);

  const [modalVisible, setModalVisible] = useState(false);
  const [pdfPath, setPdfPath] = useState(null);
  const [pdfBase64, setPdfBase64] = useState(null);

  const { highContrast, fontScale, textToSpeechEnabled, speak } =
    useAccessibility();

  const carregarLocais = useCallback(async () => {
    try {
      const arr = await loadQueue();
      if (!Array.isArray(arr)) return [];
      return arr.map((r, idx) => ({
        id: r?.recordId || String(idx),
        ...r,
        _origin: 'local',
      }));
    } catch (e) {
      logger.error('Erro ao carregar dados locais:', e);
      return [];
    }
  }, []);

  const carregarNuvem = useCallback(async () => {
    try {
      const user = auth?.currentUser;
      if (!user) return [];

      if (!db) {
        logger.log('db não disponível, pulando carregamento da nuvem');
        return [];
      }

      const net = await NetInfo.fetch();
      const isOnline = !!(net.isConnected && net.isInternetReachable !== false);
      if (!isOnline) return [];

      const col = collection(db, 'registros', user.uid, 'itens');
      const q = query(col, orderBy('updatedAt', 'desc'), limit(300));
      const snap = await getDocs(q);

      const cloud = [];
      snap.forEach((docSnap) => {
        cloud.push({ id: docSnap.id, ...docSnap.data(), _origin: 'cloud' });
      });

      return cloud;
    } catch (e) {
      logger.error('Erro ao carregar nuvem:', e);
      return [];
    }
  }, []);

  const carregarTudo = useCallback(async () => {
    setLoading(true);

    const local = await carregarLocais();
    const cloud = await carregarNuvem();

    const merged = mergeByRecordId(cloud, local);
    setRegistros(merged);

    setLoading(false);
  }, [carregarLocais, carregarNuvem]);

  useFocusEffect(
    useCallback(() => {
      (async () => {
        await carregarTudo();
      })();
      return () => {};
    }, [carregarTudo])
  );

  useEffect(() => {
    const sub = DeviceEventEmitter.addListener('registros:changed', async () => {
      await carregarTudo();
    });
    return () => sub.remove();
  }, [carregarTudo]);

  useEffect(() => {
    if (textToSpeechEnabled)
      speak('Tela de histórico. Registros locais e da nuvem.');
  }, [textToSpeechEnabled, speak]);

  // Converte URI de imagem (file:// OU content://) para data:image/*;base64
  const converterUriParaBase64 = useCallback(
    async (uri, mimeType = 'image/jpeg') => {
      try {
        if (!uri) return null;

        // Já é base64 data-uri
        if (String(uri).startsWith('data:image')) return String(uri);

        // content:// (muito comum na galeria Android)
        if (String(uri).startsWith('content://')) {
          if (RNBlob?.fs?.readFile) {
            const b64 = await RNBlob.fs.readFile(uri, 'base64');
            return `data:${mimeType};base64,${b64}`;
          }
          logger.warn(
            'URI content:// detectada, mas react-native-blob-util não está disponível. Sem foto no PDF.'
          );
          return null;
        }

        // file://...
        const normalized = normalizeFileUri(uri);
        const path = normalized.replace(/^file:\/\//, '');

        const exists = await RNFS.exists(path);
        if (!exists) {
          logger.warn('Arquivo de imagem não encontrado:', path);
          return null;
        }

        const base64 = await RNFS.readFile(path, 'base64');
        return `data:${mimeType};base64,${base64}`;
      } catch (error) {
        logger.warn('Erro ao converter imagem para base64:', error);
        return null;
      }
    },
    [/* RNBlob & RNFS are module singletons */]
  );

  const gerarPDF = useCallback(
    async (registro, opts = { includeNames: true, includeLocation: true }) => {
      try {
        if (!registro) return;

        // ---- dados do registro (tudo que existe no NovoRegistro) ----
        const dataRegistroStr = registro?.dataRegistro
          ? formatarDataCurta(registro.dataRegistro)
          : '-';
        const dataAgressaoStr = registro?.dataAgressao
          ? formatarDataCurta(registro.dataAgressao)
          : '-';

        const includeNames = opts?.includeNames !== false;
        const includeLocation = opts?.includeLocation !== false;

        const nomeAcsTxt = includeNames ? (registro?.nomeAcs ?? '-') : '[oculto]';
        const nomeAgredidoTxt = includeNames ? (registro?.nomeAgredido ?? '-') : '[oculto]';

        const latTxt = includeLocation
          ? String(registro?.location?.latitude ?? registro?.latitude ?? registro?.lat ?? '-')
          : '[oculto]';

        const lngTxt = includeLocation
          ? String(registro?.location?.longitude ?? registro?.longitude ?? registro?.lng ?? '-')
          : '[oculto]';

        const possivelAbrigoTxt = formatarBool(registro?.possivelAbrigo);
        const abrigoOpcaoTxt = registro?.abrigoOpcao ?? '-';
        const abrigoOutroTxt = registro?.abrigoOutro ?? '-';

        // ---- imagem com suporte a MIME type ----
        let imagemBase64 = null;

        if (registro?.photoBase64) {
          // Verifica se já tem o prefixo correto
          const photoBase64Str = String(registro.photoBase64);
          
          if (photoBase64Str.startsWith('data:image')) {
            // Já está no formato correto com prefixo
            imagemBase64 = photoBase64Str;
          } else {
            // Precisa adicionar o prefixo com o MIME correto
            const mime = registro?.photoMime || 'image/jpeg';
            imagemBase64 = `data:${mime};base64,${photoBase64Str}`;
          }
        } else if (registro?.photoUriLocal) {
          // Converte URI para Base64 com MIME apropriado
          const mime = registro?.photoMime || 'image/jpeg';
          imagemBase64 = await converterUriParaBase64(registro.photoUriLocal, mime);
        }

        // Log apenas do tamanho, NUNCA do conteúdo completo (evita crash)
        if (imagemBase64) {
          logger.log(`📸 Imagem Base64 gerada: ${(imagemBase64.length * 0.75 / 1024).toFixed(2)} KB`);
        } else {
          logger.log('📸 Sem imagem para o PDF');
        }

        // ---- HTML com escape (evita quebrar PDF / evita HTML injection) ----
        const html = `
          <html>
            <head>
              <meta charset="utf-8" />
              <style>
                body { font-family: Arial, sans-serif; padding: 15px; }
                h1 { text-align: center; margin-bottom: 10px; }
                .meta { color: #555; font-size: 12px; text-align: center; margin-bottom: 14px; }
                table { width: 100%; border-collapse: collapse; margin: 12px 0; }
                th, td { border: 1px solid #333; padding: 8px; text-align: left; font-size: 14px; vertical-align: top; }
                th { background: #f0f0f0; width: 38%; }
                img { width: 100%; height: 220px; margin: 10px 0 14px; display: block; object-fit: cover; border: 1px solid #ddd; }
                .small { font-size: 12px; color: #666; }
              </style>
            </head>
            <body>
              <h1>Ficha Cadastral</h1>
              <div class="meta">
                <div><b>Origem:</b> ${escapeHtml(registro?._origin === 'cloud' ? 'Nuvem' : 'Local')}</div>
                <div class="small"><b>Record ID:</b> ${escapeHtml(registro?.recordId ?? registro?.id ?? '-')}</div>
              </div>

              ${imagemBase64 ? `<img src="${imagemBase64}" alt="Foto do registro" />` : '<p class="small">Sem foto</p>'}

              <table>
                <tr><th>Nome do ACS</th><td>${escapeHtml(nomeAcsTxt)}</td></tr>
                <tr><th>Data do Registro</th><td>${escapeHtml(dataRegistroStr)}</td></tr>

                <tr><th>Nome do Agredido</th><td>${escapeHtml(nomeAgredidoTxt)}</td></tr>
                <tr><th>Apelido</th><td>${escapeHtml(registro?.apelido ?? '-')}</td></tr>
                <tr><th>Idade</th><td>${escapeHtml(registro?.idade ?? '-')}</td></tr>

                <tr><th>Sexo</th><td>${escapeHtml(formatarSexo(registro?.sexo))}</td></tr>
                <tr><th>Tratamento Antirrábico</th><td>${escapeHtml(formatarTratamento(registro?.tratamentoAntirrabico))}</td></tr>

                <tr><th>Data da Agressão</th><td>${escapeHtml(dataAgressaoStr)}</td></tr>
                <tr><th>Município</th><td>${escapeHtml(registro?.municipio ?? '-')}</td></tr>

                <tr><th>Animal Agredido</th><td>${escapeHtml(formatarLista(registro?.animalAgredido))}</td></tr>
                <tr><th>Circunstância</th><td>${escapeHtml(formatarLista(registro?.circunstancia))}</td></tr>

                <tr><th>Possível Abrigo?</th><td>${escapeHtml(possivelAbrigoTxt)}</td></tr>
                <tr><th>Tipo de Abrigo</th><td>${escapeHtml(abrigoOpcaoTxt)}</td></tr>
                <tr><th>Outro Abrigo</th><td>${escapeHtml(abrigoOutroTxt)}</td></tr>

                <tr><th>Latitude</th><td>${escapeHtml(latTxt)}</td></tr>
                <tr><th>Longitude</th><td>${escapeHtml(lngTxt)}</td></tr>
              </table>
            </body>
          </html>
        `;

        const fileName = safeFileName(registro?.municipio, 'Ficha');

        // 1) RNHTMLtoPDF (preferência)
        if (RNHTMLtoPDF && typeof RNHTMLtoPDF.convert === 'function') {
          const shouldReturnBase64 = Platform.OS === 'ios';
          const { filePath, base64 } = await RNHTMLtoPDF.convert({
            html,
            fileName,
            directory: 'Caches', // ✅ P0: cache, não permanente
            base64: shouldReturnBase64,
          });

          if (shouldReturnBase64 && base64) {
            setPdfBase64(base64);
            setPdfPath(null);
            setModalVisible(true);
            return;
          }

          if (!filePath) {
            throw new Error('Falha ao gerar PDF (sem filePath/base64)');
          }

          const candidatePath = normalizeFileUri(filePath);
          const exists = await RNFS.exists(
            candidatePath.replace(/^file:\/\//, '')
          );
          if (!exists) {
            throw new Error('Arquivo PDF gerado não encontrado no cache.');
          }

          setPdfPath(candidatePath);
          setPdfBase64(null);
          setModalVisible(true);
          return;
        }

        // 2) Fallback pdf-lib
        const linhas = [
          `Origem: ${registro?._origin === 'cloud' ? 'Nuvem' : 'Local'}`,
          `Record ID: ${registro?.recordId ?? registro?.id ?? '-'}`,
          `Nome do ACS: ${nomeAcsTxt}`,
          `Data do Registro: ${dataRegistroStr}`,
          `Nome do Agredido: ${nomeAgredidoTxt}`,
          `Apelido: ${registro?.apelido ?? '-'}`,
          `Idade: ${registro?.idade ?? '-'}`,
          `Sexo: ${formatarSexo(registro?.sexo)}`,
          `Tratamento Antirrábico: ${formatarTratamento(
            registro?.tratamentoAntirrabico
          )}`,
          `Data da Agressão: ${dataAgressaoStr}`,
          `Município: ${registro?.municipio ?? '-'}`,
          `Animal Agredido: ${formatarLista(registro?.animalAgredido)}`,
          `Circunstância: ${formatarLista(registro?.circunstancia)}`,
          `Possível Abrigo?: ${possivelAbrigoTxt}`,
          `Tipo de Abrigo: ${abrigoOpcaoTxt}`,
          `Outro Abrigo: ${abrigoOutroTxt}`,
          `Latitude: ${latTxt}`,
          `Longitude: ${lngTxt}`,
        ];

        const pdfBytes = await buildPdfWithPdfLib({
          titulo: 'Ficha Cadastral',
          linhas,
          imageBase64: imagemBase64 || null,
        });

        if (!global.Buffer) {
          throw new Error('Buffer indisponível para salvar PDF em arquivo.');
        }

        const base64 = global.Buffer.from(pdfBytes).toString('base64');
        const tempPdfPath = `${RNFS.CachesDirectoryPath}/Ficha_${Date.now()}.pdf`;
        await RNFS.writeFile(tempPdfPath, base64, 'base64');

        setPdfPath(normalizeFileUri(tempPdfPath));
        setPdfBase64(null);
        setModalVisible(true);
      } catch (error) {
        logger.warn('Erro ao gerar PDF:', error);
        Alert.alert('Erro', 'Não foi possível gerar o PDF.');
      }
    },
    [converterUriParaBase64]
  );

  const compartilharArquivo = useCallback(async (filePath) => {
    try {
      await Share.share({
        url: normalizeFileUri(filePath),
        message: 'Ficha em PDF',
        title: 'Compartilhar PDF',
      });
    } catch (e) {
      logger.error('Erro ao compartilhar PDF:', e);
      Alert.alert('Erro', 'Falha ao compartilhar o PDF.');
    }
  }, []);

  const baixarPDF = useCallback(async () => {
    try {
      if (!pdfPath && !pdfBase64) return;

      // 1) Android + SAF
      if (Platform.OS === 'android' && RNBlob && RNBlob.Android?.createDocument) {
        const nome = `Ficha_${Date.now()}.pdf`;
        const uri = await RNBlob.Android.createDocument(nome, 'application/pdf');

        if (pdfBase64) {
          await RNBlob.fs.writeFile(uri, pdfBase64, 'base64');
        } else if (pdfPath) {
          const raw = pdfPath.replace(/^file:\/\//, '');
          const asBase64 = await RNFS.readFile(raw, 'base64');
          await RNBlob.fs.writeFile(uri, asBase64, 'base64');
        }

        setModalVisible(false);
        Alert.alert('Sucesso', 'PDF salvo no local escolhido.');
        return;
      }

      // 2) iOS ou Android sem RNBlob → cache + share (e limpar depois)
      const tempPath = `${RNFS.CachesDirectoryPath}/Ficha_${Date.now()}.pdf`;

      try {
        if (pdfBase64) {
          await RNFS.writeFile(tempPath, pdfBase64, 'base64');
        } else if (pdfPath) {
          const raw = pdfPath.replace(/^file:\/\//, '');
          const asBase64 = await RNFS.readFile(raw, 'base64');
          await RNFS.writeFile(tempPath, asBase64, 'base64');
        }

        setModalVisible(false);
        await compartilharArquivo(tempPath);
      } finally {
        // ✅ P0: não manter PII em cache pra sempre
        try {
          const exists = await RNFS.exists(tempPath);
          if (exists) await RNFS.unlink(tempPath);
        } catch (_e) {}
      }
    } catch (error) {
      logger.error('Erro ao salvar/compartilhar PDF:', error);
      setModalVisible(false);
      Alert.alert('Erro', 'Não foi possível salvar o PDF.');
    }
  }, [pdfPath, pdfBase64, compartilharArquivo]);

  const pdfSource = useMemo(() => {
    if (pdfPath) return { uri: encodeURI(pdfPath), cache: false };
    if (pdfBase64) return { uri: `data:application/pdf;base64,${pdfBase64}` };
    return null;
  }, [pdfPath, pdfBase64]);

  const confirmarPDF = useCallback(
    (registro) => {
      Alert.alert(
        'Gerar/Compartilhar PDF',
        'Este PDF pode conter dados pessoais (nome, município e localização). Como deseja gerar?',
        [
          { text: 'Cancelar', style: 'cancel' },
          {
            text: 'Completo',
            onPress: () => gerarPDF(registro, { includeNames: true, includeLocation: true }),
          },
          {
            text: 'Sem localização',
            onPress: () => gerarPDF(registro, { includeNames: true, includeLocation: false }),
          },
          {
            text: 'Sem nomes',
            onPress: () => gerarPDF(registro, { includeNames: false, includeLocation: true }),
          },
        ],
        { cancelable: true }
      );
    },
    [gerarPDF]
  );

  return (
    <View style={[styles.screen, highContrast && styles.screenHC]}>
      <Header />

      <Text
        style={[
          styles.pageTitle,
          { fontSize: 22 * fontScale },
          highContrast && styles.pageTitleHC,
        ]}
      >
        Histórico de Registros (Local + Nuvem)
      </Text>

      {loading && (
        <View style={styles.centered}>
          <ActivityIndicator
            size="large"
            color={highContrast ? '#FFD700' : '#6200ee'}
          />
          <Text
            style={[
              styles.centeredText,
              { fontSize: 16 * fontScale },
              highContrast && styles.centeredTextHC,
            ]}
          >
            Carregando registros...
          </Text>
        </View>
      )}

      {!loading && registros.length === 0 && (
        <View style={styles.centered}>
          <Text
            style={[
              styles.centeredText,
              { fontSize: 16 * fontScale },
              highContrast && styles.centeredTextHC,
            ]}
          >
            Nenhum registro encontrado.
          </Text>
        </View>
      )}

      {!loading && registros.length > 0 && (
        <ScrollView style={styles.container}>
          {registros.map((reg) => (
            <TouchableOpacity
              key={reg.id}
              style={[styles.card, highContrast && styles.cardHC]}
              onPress={() => confirmarPDF(reg)}
            >
              <Text
                style={[
                  styles.title,
                  { fontSize: 16 * fontScale },
                  highContrast && styles.titleHC,
                ]}
              >
                {reg.municipio || 'Sem município'}
              </Text>

              <Text
                style={[
                  styles.subtitle,
                  { fontSize: 14 * fontScale },
                  highContrast && styles.subtitleHC,
                ]}
              >
                {formatarDataCurta(reg.dataRegistro) || 'Data não informada'}
              </Text>

              <Text
                style={[
                  styles.subtitle,
                  { fontSize: 12 * fontScale },
                  highContrast && styles.subtitleHC,
                ]}
              >
                Status: {reg.status || 'local_only'} • Origem:{' '}
                {reg._origin === 'cloud' ? 'Nuvem' : 'Local'}
                {(reg.photoUriLocal || reg.photoBase64) && ' 📸'}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}

      <Modal
        visible={modalVisible}
        transparent
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={estilosModal.modalContainer}>
          <View style={estilosModal.modalContent}>
            {pdfSource ? (
              <Pdf
                source={pdfSource}
                style={estilosModal.pdf}
                onLoadComplete={(pages) =>
                  logger.log(`📄 PDF carregado: ${pages} página(s)`)
                }
                onError={(e) => {
                  logger.error('❌ Erro no Pdf viewer:', e);
                  Alert.alert('Erro', 'Falha ao abrir o PDF.');
                }}
                enableAntialiasing
                useAndroidHardwareAcceleration
                trustAllCerts={false}
              />
            ) : (
              <Text>Carregando PDF...</Text>
            )}

            <View style={estilosModal.botoesContainer}>
              <TouchableOpacity
                style={[estilosModal.botaoModal, estilosModal.botaoFechar]}
                onPress={() => setModalVisible(false)}
              >
                <Text style={estilosModal.botaoTexto}>Fechar</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[estilosModal.botaoModal, estilosModal.botaoDownload]}
                onPress={baixarPDF}
                disabled={!pdfPath && !pdfBase64}
              >
                <Text style={estilosModal.botaoTexto}>Baixar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

/* ======================= Estilos do Modal ======================= */
const estilosModal = {
  modalContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  modalContent: {
    width: '90%',
    height: '80%',
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 10,
  },
  pdf: {
    flex: 1,
    width: '100%',
  },
  botoesContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 10,
  },
  botaoModal: {
    flex: 1,
    marginHorizontal: 5,
    padding: 10,
    borderRadius: 6,
    alignItems: 'center',
  },
  botaoFechar: { backgroundColor: '#e53935' },
  botaoDownload: { backgroundColor: '#43a047' },
  botaoTexto: { color: '#fff', fontSize: 16, fontWeight: '600' },
};
