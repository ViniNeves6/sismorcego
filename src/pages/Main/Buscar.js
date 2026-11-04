// src/pages/Main/Buscar.js
// Histórico: registros locais (fila offline) + nuvem, com busca, filtro e PDF.
import React, { useCallback, useDeferredValue, useMemo, useRef, useState } from "react";
import { FlatList, RefreshControl, View, StyleSheet } from "react-native";
import {
  Screen,
  ScreenHeader,
  TextField,
  SegmentedControl,
  EmptyState,
  Text,
  useToast,
  BottomSheet,
  Button,
} from "../../ui";
import { useTheme } from "../../theme/ThemeProvider";
import useAuth from "../../hooks/useAuth";
import useHistoricoRegistros from "../../hooks/useHistoricoRegistros";
import useSpeakOnMount from "../../hooks/useSpeakOnMount";
import { generateRegistroPdf, savePdf } from "../../services/registroPdf";
import { excluirRegistro } from "../../services/historico";
import logger from "../../utils/logger";
import RegistroCard from "./buscar/RegistroCard";
import PdfOptionsSheet from "./buscar/PdfOptionsSheet";
import PdfViewerModal from "./buscar/PdfViewerModal";
import { canModifyRecord } from '../../services/recordLifecycle';

const FILTERS = [
  { value: "todos", label: "Todos" },
  { value: "pendentes", label: "Pendentes" },
  { value: "enviados", label: "Enviados" },
];

// Sem acento e minúsculo, para busca tolerante.
const normalize = (v) =>
  String(v ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();

// Legado (sem tipoVitima) tem nomeAgredido/apelido no topo; registros novos
// guardam isso em detalhes.* (só existe pro tipo "humano").
const SEARCHABLE = ["municipio", "nomeAgredido", "apelido", "nomeAcs"];
const SEARCHABLE_DETALHES = ["nomeAgredido", "apelido"];

const keyExtractor = (r) => r.id;

export default function Buscar({ navigation }) {
  const { spacing } = useTheme();
  const toast = useToast();
  const { role, user } = useAuth();
  const isAdmin = role === "coordenador";
  useSpeakOnMount(
    isAdmin ? "Tela de histórico. Registros de todos os ACS." : "Tela de histórico. Registros locais e da nuvem."
  );

  const { registros, loading, refreshing, refresh } = useHistoricoRegistros();

  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("todos");
  const deferredQuery = useDeferredValue(query);

  const [selected, setSelected] = useState(null); // registro com a folha de opções aberta
  const [generating, setGenerating] = useState(false);
  const [pdf, setPdf] = useState(null); // { path, base64 } enquanto o visualizador está aberto
  const pendingPdf = useRef(null);
  const [cancellationRecord, setCancellationRecord] = useState(null);
  const [cancellationReason, setCancellationReason] = useState('');
  const [cancelling, setCancelling] = useState(false);

  // Derivado durante a renderização (sem efeito nem estado extra).
  const visiveis = useMemo(() => {
    const q = normalize(deferredQuery.trim());
    return registros.filter((r) => {
      const enviado = r.status === "synced";
      if (filter === "pendentes" && enviado) return false;
      if (filter === "enviados" && !enviado) return false;
      if (!q) return true;
      if (SEARCHABLE.some((k) => normalize(r[k]).includes(q))) return true;
      return SEARCHABLE_DETALHES.some((k) => normalize(r.detalhes?.[k]).includes(q));
    });
  }, [registros, deferredQuery, filter]);

  const abrirOpcoes = useCallback((registro) => setSelected(registro), []);

  const confirmarExclusao = useCallback(
    (registro) => {
      if (!canModifyRecord(registro, user?.uid)) return;
      setCancellationReason(''); setCancellationRecord(registro);
    },
    [user?.uid]
  );

  const gerar = async (registro, opts) => {
    try {
      setGenerating(true);
      const result = await generateRegistroPdf(registro, opts);
      pendingPdf.current = result;
      setSelected(null);
    } catch (error) {
      logger.warn("Erro ao gerar PDF:", error);
      toast.show("Não foi possível gerar o PDF.", { tone: "danger" });
    } finally {
      setGenerating(false);
    }
  };

  const baixar = async () => {
    const current = pdf;
    try {
      const result = await savePdf(current);
      if (result) setPdf(null);
      if (result === "saved") toast.show("PDF salvo no local escolhido.", { tone: "success" });
    } catch (error) {
      logger.error("Erro ao salvar/compartilhar PDF:", error);
      setPdf(null);
      toast.show("Não foi possível salvar o PDF.", { tone: "danger" });
    }
  };

  const falhaNoVisualizador = () => {
    setPdf(null);
    toast.show("Falha ao abrir o PDF.", { tone: "danger" });
  };

  const renderItem = useCallback(
    ({ item }) => <RegistroCard registro={item} onOpen={abrirOpcoes} onDelete={confirmarExclusao} isAdmin={isAdmin}
      canCancel={canModifyRecord(item, user?.uid)} />,
    [abrirOpcoes, confirmarExclusao, isAdmin, user?.uid]
  );

  const filtrando = query.trim().length > 0 || filter !== "todos";

  const empty = loading ? null : filtrando ? (
    <EmptyState
      icon="search"
      title="Nenhum resultado"
      description="Tente outro termo ou remova o filtro."
      actionLabel="Limpar busca"
      onAction={() => {
        setQuery("");
        setFilter("todos");
      }}
    />
  ) : (
    <EmptyState
      icon="file-text"
      title="Nenhum registro ainda"
      description="Os registros que você salvar aparecem aqui, mesmo sem internet."
      actionLabel="Novo registro"
      onAction={() => navigation.navigate("Registrar")}
    />
  );

  const subtitle = loading
    ? undefined
    : `${registros.length} ${registros.length === 1 ? "registro" : "registros"}`;

  return (
    <Screen>
      <ScreenHeader title={isAdmin ? "Buscar (todos os ACS)" : "Buscar"} subtitle={subtitle} />

      <View style={{ paddingHorizontal: spacing.lg, paddingBottom: spacing.md, gap: spacing.md }}>
        <TextField
          value={query}
          onChangeText={setQuery}
          placeholder="Município, nome ou apelido"
          accessibilityLabel="Buscar registros"
          leadingIcon="search"
          returnKeyType="search"
          autoCorrect={false}
          clearButtonMode="while-editing"
        />
        <SegmentedControl label="Filtrar por envio" options={FILTERS} value={filter} onChange={setFilter} />
      </View>

      <FlatList
        data={visiveis}
        keyExtractor={keyExtractor}
        renderItem={renderItem}
        ListEmptyComponent={empty}
        contentContainerStyle={[styles.list, { padding: spacing.lg, gap: spacing.md }]}
        refreshControl={<RefreshControl refreshing={Boolean(loading || refreshing)} onRefresh={refresh} />}
        keyboardShouldPersistTaps="handled"
        initialNumToRender={10}
        windowSize={7}
      />

      <PdfOptionsSheet
        registro={selected}
        generating={generating}
        onClose={() => setSelected(null)}
        onSelect={gerar}
        onExited={() => { if (pendingPdf.current) { setPdf(pendingPdf.current); pendingPdf.current = null; } }}
      />

      <PdfViewerModal pdf={pdf} onClose={() => setPdf(null)} onDownload={baixar} onError={falhaNoVisualizador} />
      <BottomSheet visible={Boolean(cancellationRecord)} title="Cancelar ocorrência"
        onClose={() => { if (!cancelling) setCancellationRecord(null); }}>
        <View style={{ padding: spacing.lg, gap: spacing.md }}>
          <Text>A ocorrência será preservada no histórico. Informe a justificativa.</Text>
          <TextField label="Motivo do cancelamento" value={cancellationReason} onChangeText={setCancellationReason} maxLength={1000} editable={!cancelling} />
          <Button title="Confirmar cancelamento" variant="danger" loading={cancelling} onPress={async () => {
            if (cancelling || !canModifyRecord(cancellationRecord, user?.uid)) return;
            setCancelling(true);
            try {
              await excluirRegistro(cancellationRecord, cancellationReason);
              setCancellationRecord(null); toast.show('Ocorrência cancelada.', { tone: 'success' }); await refresh();
            } catch (error) { toast.show(error.message || 'Não foi possível cancelar a ocorrência.', { tone: 'danger' }); }
            finally { setCancelling(false); }
          }} />
        </View>
      </BottomSheet>
    </Screen>
  );
}

const styles = StyleSheet.create({
  list: { flexGrow: 1 },
});
