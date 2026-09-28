// src/services/registroPdf.js
// Geração, salvamento e compartilhamento da ficha em PDF (sem UI).
// - PDF: RNHTMLtoPDF se disponível; fallback pdf-lib
// - Baixar: SAF (react-native-blob-util) no Android; senão cache + Share
import { Platform, Share } from "react-native";
import RNFS from "react-native-fs";
import logger from "../utils/logger";
import {
  CIRCUNSTANCIA_HUMANO,
  MOTIVO_NAO_BUSCOU,
  TIPO_ABRIGO_MORCEGO,
  ESPECIE_CANINO_FELINO,
  CIRCUNSTANCIA_CANINO_FELINO,
  MOTIVO_NAO_PARTICIPOU_CANINO_FELINO,
  ESPECIE_AVES,
  CIRCUNSTANCIA_AVES,
  ESPECIE_PRODUCAO,
  CIRCUNSTANCIA_PRODUCAO,
  PARTICIPOU_VACINACAO_PRODUCAO,
  MOTIVO_NAO_AVISOU,
  rotulo,
} from "../pages/Main/registro/registroTypeOptions";

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

/* ======================= Campos da ficha, por tipo de vítima ======================= */
// Registros antigos (sem tipoVitima) usam o formato legado direto; registros
// novos ficam em registro.detalhes, conforme o tipo escolhido no cadastro.
// Ver docs/superpowers/specs/2026-09-28-registro-por-tipo-vitima-design.md
function buildCamposFicha(registro, { includeNames, includeLocation }) {
  const nomeNotificadorTxt = includeNames ? (registro?.nomeAcs ?? "-") : "[oculto]";
  const municipioTxt = registro?.municipio ?? "-";
  const localidadeTxt = registro?.localidade ?? "-";
  const dataRegistroStr = formatarDataCurta(registro?.dataRegistro);
  const dataMordeduraStr = formatarDataCurta(registro?.dataAgressao);
  const latTxt = includeLocation
    ? String(registro?.location?.latitude ?? registro?.latitude ?? "-")
    : "[oculto]";
  const lngTxt = includeLocation
    ? String(registro?.location?.longitude ?? registro?.longitude ?? "-")
    : "[oculto]";

  const campos = [
    { label: "Nome do notificador", value: nomeNotificadorTxt },
    { label: "Data do registro", value: dataRegistroStr },
    { label: "Data da mordedura", value: dataMordeduraStr },
    { label: "Município", value: municipioTxt },
  ];
  if (registro?.localidade) campos.push({ label: "Localidade/comunidade", value: localidadeTxt });

  const tipo = registro?.tipoVitima;
  const d = registro?.detalhes || {};

  if (!tipo) {
    // Legado: campos antigos, exibidos como estão (sem tentar reclassificar).
    campos.push(
      { label: "Nome do agredido", value: includeNames ? (registro?.nomeAgredido ?? "-") : "[oculto]" },
      { label: "Apelido", value: registro?.apelido ?? "-" },
      { label: "Idade", value: registro?.idade ?? "-" },
      { label: "Sexo", value: formatarSexo(registro?.sexo) },
      { label: "Tratamento antirrábico", value: formatarTratamento(registro?.tratamentoAntirrabico) },
      { label: "Animal agredido", value: formatarLista(registro?.animalAgredido) },
      { label: "Circunstância", value: formatarLista(registro?.circunstancia) },
      { label: "Possível abrigo?", value: formatarBool(registro?.possivelAbrigo) },
      { label: "Tipo de abrigo", value: registro?.abrigoOpcao ?? "-" },
      { label: "Outro abrigo", value: registro?.abrigoOutro ?? "-" }
    );
  } else if (tipo === "humano") {
    campos.push(
      { label: "Nome do agredido", value: includeNames ? (d.nomeAgredido ?? "-") : "[oculto]" },
      { label: "Apelido", value: d.apelido ?? "-" },
      { label: "Idade", value: d.idade ?? "-" },
      { label: "Sexo", value: formatarSexo(d.sexo) },
      { label: "Ocupação/profissão", value: d.ocupacaoProfissao ?? "-" },
      { label: "Circunstância", value: rotulo(CIRCUNSTANCIA_HUMANO, d.circunstancia) }
    );
    if (d.circunstancia === "praia") campos.push({ label: "Qual praia?", value: d.circunstanciaPraiaQual ?? "-" });
    if (d.circunstancia === "outro") campos.push({ label: "Descrição da circunstância", value: d.circunstanciaOutraDescricao ?? "-" });
    campos.push({ label: "Buscou atendimento?", value: formatarBool(d.buscouAtendimento) });
    if (d.buscouAtendimento === "nao") {
      campos.push({ label: "Motivo de não buscar atendimento", value: rotulo(MOTIVO_NAO_BUSCOU, d.naoBuscouMotivo) });
    }
    campos.push({ label: "Abrigo de morcego?", value: formatarBool(d.abrigoMorcego) });
    if (d.abrigoMorcego === "sim") {
      campos.push(
        { label: "Tipo de abrigo", value: rotulo(TIPO_ABRIGO_MORCEGO, d.abrigoTipo) },
        { label: "Descrição do abrigo", value: d.abrigoDescricao ?? "-" }
      );
    }
  } else if (tipo === "caninoFelino") {
    campos.push(
      { label: "Espécie", value: rotulo(ESPECIE_CANINO_FELINO, d.especie) },
      { label: "Circunstância", value: rotulo(CIRCUNSTANCIA_CANINO_FELINO, d.circunstancia) }
    );
    if (d.circunstancia === "outro") campos.push({ label: "Descrição da circunstância", value: d.circunstanciaDescricao ?? "-" });
    campos.push({ label: "Participou da última campanha de vacinação?", value: formatarBool(d.participouVacinacao) });
    if (d.participouVacinacao === "nao") {
      campos.push({
        label: "Motivo",
        value:
          d.naoParticipouMotivo === "nao_sabe"
            ? rotulo(MOTIVO_NAO_PARTICIPOU_CANINO_FELINO, "nao_sabe")
            : d.naoParticipouDescricao ?? "-",
      });
    }
    campos.push({ label: "Avisou o município?", value: formatarBool(d.avisouMunicipio) });
    if (d.avisouMunicipio === "nao") {
      campos.push({ label: "Motivo de não avisar", value: rotulo(MOTIVO_NAO_AVISOU, d.naoAvisouMotivo) });
      if (d.naoAvisouMotivo === "outro") campos.push({ label: "Descrição", value: d.naoAvisouDescricao ?? "-" });
    }
  } else if (tipo === "aves") {
    campos.push(
      { label: "Espécie", value: rotulo(ESPECIE_AVES, d.especie) },
      { label: "Circunstância", value: rotulo(CIRCUNSTANCIA_AVES, d.circunstancia) }
    );
    if (d.circunstancia === "outro") campos.push({ label: "Descrição da circunstância", value: d.circunstanciaDescricao ?? "-" });
    campos.push({ label: "Avisou a ADEPARÁ ou o município?", value: formatarBool(d.avisouAdeparaOuMunicipio) });
    if (d.avisouAdeparaOuMunicipio === "nao") {
      campos.push({ label: "Motivo de não avisar", value: rotulo(MOTIVO_NAO_AVISOU, d.naoAvisouMotivo) });
      if (d.naoAvisouMotivo === "outro") campos.push({ label: "Descrição", value: d.naoAvisouDescricao ?? "-" });
    }
  } else if (tipo === "producao") {
    campos.push(
      { label: "Espécie", value: rotulo(ESPECIE_PRODUCAO, d.especie) },
      { label: "Circunstância", value: rotulo(CIRCUNSTANCIA_PRODUCAO, d.circunstancia) }
    );
    if (d.circunstancia === "outro") campos.push({ label: "Descrição da circunstância", value: d.circunstanciaDescricao ?? "-" });
    campos.push({
      label: "Participou da última campanha de vacinação?",
      value: rotulo(PARTICIPOU_VACINACAO_PRODUCAO, d.participouVacinacao),
    });
    if (d.participouVacinacao === "nao") campos.push({ label: "Motivo", value: d.naoParticipouDescricao ?? "-" });
    campos.push({ label: "Avisou a ADEPARÁ ou o município?", value: formatarBool(d.avisouAdeparaOuMunicipio) });
    if (d.avisouAdeparaOuMunicipio === "nao") {
      campos.push({ label: "Motivo de não avisar", value: rotulo(MOTIVO_NAO_AVISOU, d.naoAvisouMotivo) });
      if (d.naoAvisouMotivo === "outro") campos.push({ label: "Descrição", value: d.naoAvisouDescricao ?? "-" });
    }
  }

  campos.push({ label: "Latitude", value: latTxt }, { label: "Longitude", value: lngTxt });
  return campos;
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

  const campos = buildCamposFicha(registro, { includeNames, includeLocation });

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
          ${campos.map((c) => `<tr><th>${escapeHtml(c.label)}</th><td>${escapeHtml(c.value)}</td></tr>`).join("\n")}
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
  const linhas = [`Origem: ${origem}`, `Record ID: ${recordId}`, ...campos.map((c) => `${c.label}: ${c.value}`)];

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
