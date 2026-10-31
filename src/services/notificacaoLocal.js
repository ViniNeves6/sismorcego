// src/services/notificacaoLocal.js
// Canal e exibição da notificação local (gerada no aparelho, não é push).
import notifee, { AndroidImportance } from "@notifee/react-native";
import { PRIVATE_PUSH_BODY, PRIVATE_PUSH_TITLE } from './alertContract';

export const CANAL_NOTIFICACOES_ID = "registros";

export const garantirCanalNotificacoes = () =>
  notifee.createChannel({
    id: CANAL_NOTIFICACOES_ID,
    name: "Novos registros",
    importance: AndroidImportance.DEFAULT,
  });

export async function exibirNotificacaoRegistrosNovos(registrosNovos) {
  if (!registrosNovos?.length) return;

  await notifee.displayNotification({
    title: PRIVATE_PUSH_TITLE,
    body: PRIVATE_PUSH_BODY,
    android: { channelId: CANAL_NOTIFICACOES_ID, pressAction: { id: "default" } },
  });
}
