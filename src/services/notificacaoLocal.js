// src/services/notificacaoLocal.js
// Canal e exibição da notificação local (gerada no aparelho, não é push).
import notifee, { AndroidImportance } from "@notifee/react-native";

export const CANAL_NOTIFICACOES_ID = "registros";

export const garantirCanalNotificacoes = () =>
  notifee.createChannel({
    id: CANAL_NOTIFICACOES_ID,
    name: "Novos registros",
    importance: AndroidImportance.DEFAULT,
  });

export async function exibirNotificacaoRegistrosNovos(registrosNovos) {
  if (!registrosNovos?.length) return;

  const [primeiro] = registrosNovos;
  const titulo = registrosNovos.length === 1 ? "Novo registro" : `${registrosNovos.length} novos registros`;
  const corpo =
    registrosNovos.length === 1
      ? `${primeiro.nomeAcs || "Um ACS"} registrou uma ocorrência em ${primeiro.municipio || "local não informado"}.`
      : "Toque para ver os registros recentes.";

  await notifee.displayNotification({
    title: titulo,
    body: corpo,
    android: { channelId: CANAL_NOTIFICACOES_ID, pressAction: { id: "default" } },
  });
}
