// src/services/registroPdf.js
// Geração, salvamento e compartilhamento da ficha em PDF (sem UI).
// - PDF: RNHTMLtoPDF se disponível; fallback pdf-lib
// - Baixar: seletor nativo de documentos no Android; compartilhar arquivo no iOS.
import { NativeModules, Platform } from "react-native";
import FileShare from 'react-native-share';
import RNFS from "react-native-fs";
import logger from "../utils/logger";
import { parseRegistroDate } from './registroDate';
import { buildFichaModel, buildFichaHtml, decorateFichaPdf, buildStyledFichaPdf } from './registroPdfLayout';
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
  const module = require("react-native-blob-util");
  RNBlob = module.default || module;
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
  const d = parseRegistroDate(iso);
  if (!d) return String(iso);
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
export function buildCamposFicha(registro, { includeNames, includeLocation }) {
  const nomeNotificadorTxt = includeNames ? (registro?.nomeAcs ?? "-") : "[oculto]";
  const municipioTxt = registro?.municipio ?? "-";
  const localidadeTxt = registro?.localidade ?? "-";
  const dataRegistroStr = formatarDataCurta(registro?.dataRegistro ?? registro?.createdAt);
  const dataMordeduraStr = formatarDataCurta(registro?.dataAgressao ?? registro?.dataMordedura);
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
      { label: "Apelido", value: includeNames ? (registro?.apelido ?? "-") : "[oculto]" },
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
      { label: "Apelido", value: includeNames ? (d.apelido ?? "-") : "[oculto]" },
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
          d.naoParticipouMotivo === "outro"
            ? d.naoParticipouDescricao ?? "-"
            : rotulo(MOTIVO_NAO_PARTICIPOU_CANINO_FELINO, d.naoParticipouMotivo),
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

  if (tipo && d.localAgressao) campos.push({ label: "Local da agressão", value: d.localAgressao });
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

  const imagemBase64 = opts.includePhoto === false || opts.photo === false ? null : await resolveImage(registro);
  const model = buildFichaModel(registro, campos, imagemBase64);
  const fileName = `${safeFileName(registro.municipio, "Sismorcego")}_${Date.now()}`;
  const nativeGenerate = RNHTMLtoPDF?.generatePDF || RNHTMLtoPDF?.default?.generatePDF
    || RNHTMLtoPDF?.convert || RNHTMLtoPDF?.default?.convert;
  let pdfBytes;
  if (typeof nativeGenerate === 'function') {
    let nativePath;
    try {
      const html = buildFichaHtml(model, await loadPdfFontCss());
      const result = await nativeGenerate({
        html, fileName, width: 595, height: 842,
        padding: 0, base64: false, shouldPrintBackgrounds: true,
      });
      nativePath = result.filePath?.replace(/^file:\/\//, '');
      const base64 = result.base64 || await RNFS.readFile(nativePath, 'base64');
      pdfBytes = await decorateFichaPdf(global.Buffer.from(base64, 'base64'));
    } catch (error) {
      logger.warn('PDF HTML indisponível; usando ficha vetorial.', error?.message);
    } finally {
      if (nativePath) {
        try { await RNFS.unlink(nativePath); } catch { /* Limpeza do arquivo intermediário. */ }
      }
    }
  }
  if (!pdfBytes) pdfBytes = await buildStyledFichaPdf(model);
  const base64 = global.Buffer.from(pdfBytes).toString('base64');
  const tempPdfPath = `${RNFS.CachesDirectoryPath}/${fileName}.pdf`;
  await RNFS.writeFile(tempPdfPath, base64, 'base64');
  return { path: normalizeFileUri(tempPdfPath), base64: null };
}

let pdfFontCss;
async function loadPdfFontCss() {
  if (pdfFontCss !== undefined) return pdfFontCss;
  pdfFontCss = '';
  if (Platform.OS !== 'android' || !RNFS.readFileAssets) return pdfFontCss;
  try {
    const [regular, bold] = await Promise.all([
      RNFS.readFileAssets('fonts/PlusJakartaSans-Regular.ttf', 'base64'),
      RNFS.readFileAssets('fonts/PlusJakartaSans-Bold.ttf', 'base64'),
    ]);
    pdfFontCss = `@font-face { font-family: Sismorcego; src: url(data:font/ttf;base64,${regular}); font-weight: 400; }
      @font-face { font-family: Sismorcego; src: url(data:font/ttf;base64,${bold}); font-weight: 700; }`;
  } catch { /* A ficha permanece legível com a fonte de sistema. */ }
  return pdfFontCss;
}

export async function sharePdf(filePath) {
  return FileShare.open({
    url: normalizeFileUri(filePath),
    type: 'application/pdf',
    title: 'Salvar ou compartilhar ficha',
    filename: String(filePath).split('/').pop(),
    failOnCancel: false,
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

  const fileName = path?.split('/').pop() || `Sismorcego_Ficha_${Date.now()}.pdf`;
  let filePath = path?.replace(/^file:\/\//, '');
  if (!filePath) {
    filePath = `${RNFS.CachesDirectoryPath}/${fileName}`;
    await RNFS.writeFile(filePath, await readAsBase64({ path, base64 }), 'base64');
  }
  if (Platform.OS === 'android' && NativeModules.SismorcegoDocuments?.savePdf) {
    return NativeModules.SismorcegoDocuments.savePdf(filePath, fileName);
  }
  const result = await sharePdf(filePath);
  return result?.success === false ? null : 'shared';
}
