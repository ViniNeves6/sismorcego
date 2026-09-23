// src/hooks/useRegistro.js
import Share from "react-native-share";
import RNHTMLtoPDF from "react-native-html-to-pdf";
import { collection, getDocs } from "firebase/firestore";

import { db as firestoreDB } from "../services/firebase";
import logger from "../utils/logger";
import useAuth from "./useAuth";
import { buscarRegistrosLocais } from "../database/registro";

/**
 * Hook responsÃ¡vel por listar registros (Firestore quando logado, senÃ£o SQLite),
 * gerar e compartilhar PDF.
 *
 * CorreÃ§Ã£o 3/12 (endurecer dados locais):
 * - Quando estiver sem login/Firestore, o "Buscar" deve listar do SQLite.
 * - PDF usa campos normalizados (nomeACS, tratamento, etc).
 */

const escapeHtml = (value) => {
  const s = value === null || value === undefined ? "" : String(value);
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
};

const formatArray = (arr) => {
  if (!Array.isArray(arr) || arr.length === 0) return "-";
  return arr.map((x) => String(x)).join(", ");
};

export default function useRegistro() {
  const { user } = useAuth() || {};

  /**
   * Lista registros:
   * - Se houver usuÃ¡rio logado e Firestore disponÃ­vel: busca do Firestore
   * - Caso contrÃ¡rio: busca do SQLite local
   */
  const listarRegistros = async () => {
    try {
      const hasFirestore = !!(user && user.uid && firestoreDB);

      if (hasFirestore) {
        const querySnap = await getDocs(collection(firestoreDB, "registros", user.uid, "itens"));
        return querySnap.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));
      }

      // Fallback local (SQLite) â€” essencial para "Buscar" no modo offline/teste
      const locais = await buscarRegistrosLocais();
      return locais.map((r) => ({
        id: String(r.id),
        ...r,
      }));
    } catch (error) {
      logger.error("useRegistro: listarRegistros failed", error);
      // Tenta fallback local se Firestore falhar
      try {
        const locais = await buscarRegistrosLocais();
        return locais.map((r) => ({ id: String(r.id), ...r }));
      } catch (e) {
        logger.error("useRegistro: listarRegistros fallback failed", e);
        return [];
      }
    }
  };

  /**
   * Gera um PDF com os dados do registro.
   * Suporta tanto o formato vindo do Firestore quanto o do SQLite.
   */
  const gerarPDF = async (registro) => {
    if (!registro) {
      logger.warn("useRegistro: gerarPDF sem registro");
      return null;
    }

    // NormalizaÃ§Ã£o de campos (Firestore x SQLite)
    const nomeACS = registro.nomeACS ?? registro.nomeAcs ?? "-";
    const nomeAgredido = registro.nomeAgredido ?? "-";
    const municipio = registro.municipio ?? "-";
    const endereco = registro.endereco ?? "-";
    const local = registro.local ?? "-";
    const sexo = registro.sexo ?? "-";
    const tratamento = registro.tratamento ?? registro.tratamentoAntirrabico ?? "-";
    const dataRegistro = registro.dataRegistro ?? "-";
    const dataAgressao = registro.dataAgressao ?? "-";

    // Arrays (SQLite salva como array no domÃ­nio; Firestore pode vir como string)
    const animais = Array.isArray(registro.animais) ? formatArray(registro.animais) : registro.animalAgredido ?? "-";
    const fontesLuz = Array.isArray(registro.fontesLuz) ? formatArray(registro.fontesLuz) : registro.fonteLuz ?? "-";
    const circunstancias = Array.isArray(registro.circunstancias)
      ? formatArray(registro.circunstancias)
      : registro.circunstancia ?? "-";

    const latitude = registro.location?.latitude ?? "-";
    const longitude = registro.location?.longitude ?? "-";

    const htmlContent = `
      <h1 style="text-align:center;">Ficha Cadastral</h1>
      <p><b>Nome do ACS:</b> ${escapeHtml(nomeACS)}</p>
      <p><b>Data do Registro:</b> ${escapeHtml(dataRegistro)}</p>
      <p><b>Nome do Agredido:</b> ${escapeHtml(nomeAgredido)}</p>
      <p><b>Sexo:</b> ${escapeHtml(sexo)}</p>
      <p><b>Tratamento antirrÃ¡bico:</b> ${escapeHtml(tratamento)}</p>
      <p><b>Data da agressÃ£o:</b> ${escapeHtml(dataAgressao)}</p>
      <p><b>MunicÃ­pio da agressÃ£o:</b> ${escapeHtml(municipio)}</p>
      <p><b>EndereÃ§o da agressÃ£o:</b> ${escapeHtml(endereco)}</p>
      <p><b>Local da agressÃ£o:</b> ${escapeHtml(local)}</p>
      <p><b>Animal agredido no local:</b> ${escapeHtml(animais)}</p>
      <p><b>Fonte de luz:</b> ${escapeHtml(fontesLuz)}</p>
      <p><b>CircunstÃ¢ncia:</b> ${escapeHtml(circunstancias)}</p>
      <p><b>Latitude:</b> ${escapeHtml(latitude)}</p>
      <p><b>Longitude:</b> ${escapeHtml(longitude)}</p>
    `;

    try {
      const safeMunicipio = String(municipio || "Registro").replace(/[^\w-]+/g, "_");
      const safeData = String(dataRegistro || "SemData").replace(/[^\w-]+/g, "_");

      const file = await RNHTMLtoPDF.convert({
        html: htmlContent,
        fileName: `Ficha_${safeMunicipio}_${safeData}`,
        directory: "docs",
      });

      if (!file?.filePath) throw new Error("Caminho do PDF nÃ£o retornado");
      return file.filePath;
    } catch (error) {
      logger.error("useRegistro: gerarPDF failed", error);
      return null;
    }
  };

  /**
   * Compartilha o PDF gerado via intent nativo.
   */
  const compartilharPDF = async (filePath) => {
    if (!filePath) {
      logger.warn("useRegistro: compartilharPDF sem arquivo");
      return;
    }

    try {
      await Share.open({
        url: `file://${filePath}`,
        type: "application/pdf",
        failOnCancel: false,
      });
    } catch (error) {
      logger.error("useRegistro: compartilharPDF failed", error);
    }
  };

  return { listarRegistros, gerarPDF, compartilharPDF };
}
