// src/services/registroPdf.js
// Geração, salvamento e compartilhamento da ficha em PDF (sem UI).
// - PDF: RNHTMLtoPDF se disponível; fallback pdf-lib
// - Baixar: SAF (react-native-blob-util) no Android; senão cache + Share
import { Platform, Share } from "react-native";
import RNFS from "react-native-fs";
import logger from "../utils/logger";

// ======= Dependências opcionais =======
let RNHTMLtoPDF;
try {
  RNHTMLtoPDF = require("react-native-html-to-pdf");
} catch (_e) {
  RNHTMLtoPDF = undefined;
}

let RNBlob;
try {
  RNBlob = require("react-native-blob-util");
} catch (_e) {
  RNBlob = undefined;
}

// ======= Polyfills para o fallback pdf-lib no RN =======
try {
  const { Buffer } = require("buffer");
  if (Buffer && !global.Buffer) global.Buffer = Buffer;
  if (!global.btoa) global.btoa = (s) => Buffer.from(s, "binary").toString("base64");
  if (!global.atob) global.atob = (b64) => Buffer.from(b64, "base64").toString("binary");
} catch (_e) {
  // ok
}

/* ======================= Formatação ======================= */
export const normalizeFileUri = (p) => {
  if (!p) return null;
  return p.startsWith("file://") ? p : `file://${p}`;
};

const escapeHtml = (v) =>
  String(v ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");

export const formatarSexo = (sexo) => {
  if (sexo === 1 || String(sexo).toUpperCase() === "M") return "Masculino";
  if (sexo === 2 || String(sexo).toUpperCase() === "F") return "Feminino";
  return sexo || "-";
};

export const formatarTratamento = (val) => {
  if (val === 1 || val === true || (typeof val === "string" && val.toLowerCase() === "sim")) return "Sim";
  if (val === 0 || val === false || (typeof val === "string" && val.toLowerCase() === "nao")) return "Não";
  return val || "-";
};

const formatarLista = (lista) => (Array.isArray(lista) ? lista.join(", ") : lista || "-");

export const formatarBool = (v) => {
  if (v === true) return "Sim";
  if (v === false) return "Não";
  if (typeof v === "string") {
    const s = v.trim().toLowerCase();
    if (s === "sim" || s === "s" || s === "true" || s === "1") return "Sim";
    if (s === "nao" || s === "não" || s === "n" || s === "false" || s === "0") return "Não";
  }
  if (v === 1) return "Sim";
  if (v === 0) return "Não";
  return v ?? "-";
};

// dd/mm/aaaa, independente do idioma do aparelho.
export const formatarDataCurta = (iso) => {
  if (!iso) return "-";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return String(iso);
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  return `${day}/${month}/${d.getFullYear()}`;
};

export const safeFileName = (raw, prefix = "Ficha") => {
  const base = String(raw ?? "registro")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^\w-]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "");
  return `${prefix}_${base.slice(0, 40) || "registro"}`;
};

/* ========= Fallback JS com pdf-lib ========= */
async function buildPdfWithPdfLib({ titulo, linhas, imageBase64 }) {
  const { PDFDocument, StandardFonts, rgb } = require("pdf-lib");
  const pdfDoc = await PDFDocument.create();

  let page = pdfDoc.addPage([595, 842]); // A4
  let height = page.getSize().height;
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);

  const marginX = 50;
  const marginTop = 50;
  const marginBottom = 60;
  let y = height - marginTop;

  const drawLine = (t, size = 12) => {
    page.drawText(String(t), { x: marginX, y, size, font, color: rgb(0, 0, 0) });
    y -= size + 4;
    if (y < marginBottom) {
      page = pdfDoc.addPage([595, 842]);
      height = page.getSize().height;
      y = height - marginTop;
    }
  };

  drawLine(titulo || "Ficha Cadastral", 18);
  y -= 10;

  if (imageBase64) {
    try {
      const raw = String(imageBase64);
      const withoutPrefix = raw.replace(/^data:image\/\w+;base64,/, "");

      let bytes;
      if (global.Buffer) {
        bytes = global.Buffer.from(withoutPrefix, "base64");
      } else if (typeof global.atob === "function") {
        const bin = global.atob(withoutPrefix);
        bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
      } else {
        throw new Error("Base64 decode indisponível no ambiente atual.");
      }

      const img = /^data:image\/png/.test(raw) ? await pdfDoc.embedPng(bytes) : await pdfDoc.embedJpg(bytes);

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
      logger.warn("Falha ao inserir imagem no PDF (fallback):", e);
    }
  }

  (linhas || []).forEach((linha) => drawLine(linha, 12));
  return pdfDoc.save();
}

/* ======================= Imagem ======================= */
// Converte URI de imagem (file:// OU content://) para data:image/*;base64
async function converterUriParaBase64(uri, mimeType = "image/jpeg") {
  try {
    if (!uri) return null;
    if (String(uri).startsWith("data:image")) return String(uri);

    // content:// (comum na galeria do Android)
    if (String(uri).startsWith("content://")) {
      if (RNBlob?.fs?.readFile) {
        const b64 = await RNBlob.fs.readFile(uri, "base64");
        return `data:${mimeType};base64,${b64}`;
      }
      logger.warn("URI content:// detectada, mas react-native-blob-util não está disponível. Sem foto no PDF.");
      return null;
    }

    const path = normalizeFileUri(uri).replace(/^file:\/\//, "");
    if (!(await RNFS.exists(path))) {
      logger.warn("Arquivo de imagem não encontrado:", path);
      return null;
    }
    const base64 = await RNFS.readFile(path, "base64");
    return `data:${mimeType};base64,${base64}`;
  } catch (error) {
    logger.warn("Erro ao converter imagem para base64:", error);
    return null;
  }
}

async function resolveImage(registro) {
  const mime = registro?.photoMime || "image/jpeg";

  if (registro?.photoBase64) {
    const b64 = String(registro.photoBase64);
    return b64.startsWith("data:image") ? b64 : `data:${mime};base64,${b64}`;
  }
  if (registro?.photoUriLocal) return converterUriParaBase64(registro.photoUriLocal, mime);
  return null;
}

/* ======================= API pública ======================= */

/**
 * Gera a ficha em PDF.
 * @returns {Promise<{ path: string|null, base64: string|null }>}
 * @throws se não for possível gerar
 */
export async function generateRegistroPdf(registro, opts = {}) {
  if (!registro) throw new Error("Registro inválido.");

  const includeNames = opts.includeNames !== false;
  const includeLocation = opts.includeLocation !== false;

  const dataRegistroStr = registro?.dataRegistro ? formatarDataCurta(registro.dataRegistro) : "-";
  const dataAgressaoStr = registro?.dataAgressao ? formatarDataCurta(registro.dataAgressao) : "-";

  const nomeAcsTxt = includeNames ? (registro?.nomeAcs ?? "-") : "[oculto]";
  const nomeAgredidoTxt = includeNames ? (registro?.nomeAgredido ?? "-") : "[oculto]";

  const latTxt = includeLocation
    ? String(registro?.location?.latitude ?? registro?.latitude ?? registro?.lat ?? "-")
    : "[oculto]";
  const lngTxt = includeLocation
    ? String(registro?.location?.longitude ?? registro?.longitude ?? registro?.lng ?? "-")
    : "[oculto]";

  const possivelAbrigoTxt = formatarBool(registro?.possivelAbrigo);
  const abrigoOpcaoTxt = registro?.abrigoOpcao ?? "-";
  const abrigoOutroTxt = registro?.abrigoOutro ?? "-";

  const imagemBase64 = await resolveImage(registro);
  // Loga só o tamanho, nunca o conteúdo (evita crash e vazamento).
  logger.log(imagemBase64 ? `📸 Imagem Base64 gerada: ${((imagemBase64.length * 0.75) / 1024).toFixed(2)} KB` : "📸 Sem imagem para o PDF");

  const origem = registro?._origin === "cloud" ? "Nuvem" : "Local";
  const recordId = registro?.recordId ?? registro?.id ?? "-";

  // HTML com escape (não quebra o PDF e evita injeção de HTML).
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
          <div><b>Origem:</b> ${escapeHtml(origem)}</div>
          <div class="small"><b>Record ID:</b> ${escapeHtml(recordId)}</div>
        </div>

        ${imagemBase64 ? `<img src="${imagemBase64}" alt="Foto do registro" />` : '<p class="small">Sem foto</p>'}

        <table>
          <tr><th>Nome do ACS</th><td>${escapeHtml(nomeAcsTxt)}</td></tr>
          <tr><th>Data do Registro</th><td>${escapeHtml(dataRegistroStr)}</td></tr>

          <tr><th>Nome do Agredido</th><td>${escapeHtml(nomeAgredidoTxt)}</td></tr>
          <tr><th>Apelido</th><td>${escapeHtml(registro?.apelido ?? "-")}</td></tr>
          <tr><th>Idade</th><td>${escapeHtml(registro?.idade ?? "-")}</td></tr>

          <tr><th>Sexo</th><td>${escapeHtml(formatarSexo(registro?.sexo))}</td></tr>
          <tr><th>Tratamento Antirrábico</th><td>${escapeHtml(formatarTratamento(registro?.tratamentoAntirrabico))}</td></tr>

          <tr><th>Data da Agressão</th><td>${escapeHtml(dataAgressaoStr)}</td></tr>
          <tr><th>Município</th><td>${escapeHtml(registro?.municipio ?? "-")}</td></tr>

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

  const fileName = safeFileName(registro?.municipio, "Ficha");

  // 1) RNHTMLtoPDF (preferência)
  if (RNHTMLtoPDF && typeof RNHTMLtoPDF.convert === "function") {
    const wantsBase64 = Platform.OS === "ios";
    const { filePath, base64 } = await RNHTMLtoPDF.convert({
      html,
      fileName,
      directory: "Caches", // cache, não permanente
      base64: wantsBase64,
    });

    if (wantsBase64 && base64) return { path: null, base64 };
    if (!filePath) throw new Error("Falha ao gerar PDF (sem filePath/base64)");

    const candidatePath = normalizeFileUri(filePath);
    if (!(await RNFS.exists(candidatePath.replace(/^file:\/\//, "")))) {
      throw new Error("Arquivo PDF gerado não encontrado no cache.");
    }
    return { path: candidatePath, base64: null };
  }

  // 2) Fallback pdf-lib
  const linhas = [
    `Origem: ${origem}`,
    `Record ID: ${recordId}`,
    `Nome do ACS: ${nomeAcsTxt}`,
    `Data do Registro: ${dataRegistroStr}`,
    `Nome do Agredido: ${nomeAgredidoTxt}`,
    `Apelido: ${registro?.apelido ?? "-"}`,
    `Idade: ${registro?.idade ?? "-"}`,
    `Sexo: ${formatarSexo(registro?.sexo)}`,
    `Tratamento Antirrábico: ${formatarTratamento(registro?.tratamentoAntirrabico)}`,
    `Data da Agressão: ${dataAgressaoStr}`,
    `Município: ${registro?.municipio ?? "-"}`,
    `Animal Agredido: ${formatarLista(registro?.animalAgredido)}`,
    `Circunstância: ${formatarLista(registro?.circunstancia)}`,
    `Possível Abrigo?: ${possivelAbrigoTxt}`,
    `Tipo de Abrigo: ${abrigoOpcaoTxt}`,
    `Outro Abrigo: ${abrigoOutroTxt}`,
    `Latitude: ${latTxt}`,
    `Longitude: ${lngTxt}`,
  ];

  const pdfBytes = await buildPdfWithPdfLib({ titulo: "Ficha Cadastral", linhas, imageBase64: imagemBase64 });

  if (!global.Buffer) throw new Error("Buffer indisponível para salvar PDF em arquivo.");

  const base64 = global.Buffer.from(pdfBytes).toString("base64");
  const tempPdfPath = `${RNFS.CachesDirectoryPath}/Ficha_${Date.now()}.pdf`;
  await RNFS.writeFile(tempPdfPath, base64, "base64");

  return { path: normalizeFileUri(tempPdfPath), base64: null };
}

export async function sharePdf(filePath) {
  await Share.share({
    url: normalizeFileUri(filePath),
    message: "Ficha em PDF",
    title: "Compartilhar PDF",
  });
}

const readAsBase64 = ({ path, base64 }) =>
  base64 ? Promise.resolve(base64) : RNFS.readFile(path.replace(/^file:\/\//, ""), "base64");

/**
 * Salva o PDF onde o usuário escolher (Android/SAF) ou abre o compartilhamento.
 * @returns {Promise<'saved'|'shared'|null>}
 */
export async function savePdf({ path, base64 }) {
  if (!path && !base64) return null;

  // 1) Android + SAF
  if (Platform.OS === "android" && RNBlob && RNBlob.Android?.createDocument) {
    const uri = await RNBlob.Android.createDocument(`Ficha_${Date.now()}.pdf`, "application/pdf");
    await RNBlob.fs.writeFile(uri, await readAsBase64({ path, base64 }), "base64");
    return "saved";
  }

  // 2) iOS, ou Android sem RNBlob: cache + share, apagando depois (sem PII em cache).
  const tempPath = `${RNFS.CachesDirectoryPath}/Ficha_${Date.now()}.pdf`;
  try {
    await RNFS.writeFile(tempPath, await readAsBase64({ path, base64 }), "base64");
    await sharePdf(tempPath);
    return "shared";
  } finally {
    try {
      if (await RNFS.exists(tempPath)) await RNFS.unlink(tempPath);
    } catch (_e) {
      // ok
    }
  }
}
