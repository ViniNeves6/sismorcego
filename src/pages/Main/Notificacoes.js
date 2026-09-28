// src/pages/Main/Notificacoes.js
// Feed de "novos registros" pro coordenador — só aparece nesse papel (ver AppTabs.js).
import React, { useEffect, useState } from "react";
import { ActivityIndicator, View, StyleSheet } from "react-native";
import { collection, doc, getDoc, onSnapshot, orderBy, query } from "firebase/firestore";
import { Screen, ScreenHeader, ListGroup, ListRow, Badge, EmptyState, Text, useToast } from "../../ui";
import { useTheme } from "../../theme/ThemeProvider";
import useAuth from "../../hooks/useAuth";
import useSpeakOnMount from "../../hooks/useSpeakOnMount";
import { db } from "../../services/firebase";
import { marcarNotificacaoComoLida } from "../../services/notificacoes";
import { formatarDataCurta } from "../../services/registroPdf";
import { generateRegistroPdf, savePdf } from "../../services/registroPdf";
import PdfOptionsSheet from "./buscar/PdfOptionsSheet";
import PdfViewerModal from "./buscar/PdfViewerModal";
import logger from "../../utils/logger";

export default function Notificacoes() {
  const { spacing } = useTheme();
  const toast = useToast();
  const { user } = useAuth();
  useSpeakOnMount("Notificações. Novos registros enviados pelos ACS.");

  const [itens, setItens] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [generating, setGenerating] = useState(false);
  const [pdf, setPdf] = useState(null);

  useEffect(() => {
    if (!db || !user) {
      setItens([]);
      setLoading(false);
      return;
    }
    const q = query(collection(db, "usuarios", user.uid, "notificacoes"), orderBy("createdAt", "desc"));
    const unsub = onSnapshot(
      q,
      (snap) => {
        setItens(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
        setLoading(false);
      },
      (error) => {
        logger.warn("Notificacoes: falha ao ouvir feed", error);
        setLoading(false);
      }
    );
    return () => unsub();
  }, [user]);

  const abrirNotificacao = async (notif) => {
    try {
      if (!notif.lida) await marcarNotificacaoComoLida(user.uid, notif.id);

      if (!notif.uidAcs || !notif.registroId) {
        toast.show("Esse registro não tem dados suficientes pra abrir.", { tone: "warning" });
        return;
      }

      const ref = doc(db, "registros", notif.uidAcs, "itens", String(notif.registroId));
      const snap = await getDoc(ref);
      if (!snap.exists()) {
        toast.show("Esse registro não existe mais.", { tone: "warning" });
        return;
      }
      setSelected({ id: snap.id, ...snap.data(), _origin: "cloud" });
    } catch (error) {
      logger.warn("Notificacoes: falha ao abrir registro", error);
      toast.show("Não foi possível abrir o registro.", { tone: "danger" });
    }
  };

  const gerar = async (registro, opts) => {
    try {
      setGenerating(true);
      const result = await generateRegistroPdf(registro, opts);
      setSelected(null);
      setPdf(result);
    } catch (error) {
      logger.warn("Notificacoes: erro ao gerar PDF:", error);
      toast.show("Não foi possível gerar o PDF.", { tone: "danger" });
    } finally {
      setGenerating(false);
    }
  };

  const baixar = async () => {
    const current = pdf;
    try {
      const result = await savePdf(current);
      setPdf(null);
      if (result === "saved") toast.show("PDF salvo no local escolhido.", { tone: "success" });
    } catch (error) {
      logger.error("Notificacoes: erro ao salvar/compartilhar PDF:", error);
      setPdf(null);
      toast.show("Não foi possível salvar o PDF.", { tone: "danger" });
    }
  };

  const naoLidas = itens.filter((i) => !i.lida).length;
  const subtitle = loading ? undefined : `${itens.length} ${itens.length === 1 ? "registro" : "registros"}`;

  return (
    <Screen>
      <ScreenHeader title="Notificações" subtitle={subtitle} />

      <View style={{ flex: 1, paddingHorizontal: spacing.lg, paddingTop: spacing.md, gap: spacing.md }}>
        {loading ? (
          <View style={styles.loading}>
            <ActivityIndicator size="large" />
            <Text variant="body" tone="muted">
              Carregando notificações…
            </Text>
          </View>
        ) : itens.length === 0 ? (
          <EmptyState
            icon="bell"
            title="Nenhuma notificação"
            description="Quando um ACS enviar um novo registro, ele aparece aqui."
          />
        ) : (
          <ListGroup>
            {itens.map((item) => (
              <ListRow
                key={item.id}
                icon="file-text"
                title={item.nomeAcs || "ACS não identificado"}
                subtitle={`${item.municipio || "Município não informado"} · ${formatarDataCurta(item.createdAt)}`}
                onPress={() => abrirNotificacao(item)}
                trailing={!item.lida ? <Badge label="Novo" tone="primary" /> : null}
              />
            ))}
          </ListGroup>
        )}
      </View>

      <PdfOptionsSheet registro={selected} generating={generating} onClose={() => setSelected(null)} onSelect={gerar} />

      <PdfViewerModal
        pdf={pdf}
        onClose={() => setPdf(null)}
        onDownload={baixar}
        onError={() => {
          setPdf(null);
          toast.show("Falha ao abrir o PDF.", { tone: "danger" });
        }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  loading: { alignItems: "center", gap: 12, paddingTop: 48 },
});
