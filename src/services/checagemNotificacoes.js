// src/services/checagemNotificacoes.js
// Um único ponto de checagem, chamado tanto pelo app aberto (hook) quanto
// pela tarefa headless de segundo plano (index.js) — mesma lógica nos dois casos.
import { buscarRegistrosNovos, registrarNotificacoes } from "./notificacoes";
import { exibirNotificacaoRegistrosNovos } from "./notificacaoLocal";
import logger from "../utils/logger";

export async function executarChecagemNotificacoes(coordenadorUid) {
  if (!coordenadorUid) return;

  try {
    const novos = await buscarRegistrosNovos();
    if (novos.length === 0) return;

    await registrarNotificacoes(coordenadorUid, novos);
    await exibirNotificacaoRegistrosNovos(novos);
  } catch (e) {
    logger.warn("checagemNotificacoes: falha ao checar registros novos", e);
  }
}
