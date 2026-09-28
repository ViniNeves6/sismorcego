// src/pages/Main/Buscar.js
// Histórico: registros locais (fila offline) + nuvem, com busca, filtro e PDF.
import React, { useCallback, useDeferredValue, useMemo, useState } from "react";
import { ActivityIndicator, FlatList, RefreshControl, View, StyleSheet } from "react-native";
import {
  Screen,
  ScreenHeader,
  TextField,
  SegmentedControl,
  EmptyState,
  Text,
  useToast,
} from "../../ui";
import { useTheme } from "../../theme/ThemeProvider";
import useHistoricoRegistros from "../../hooks/useHistoricoRegistros";
import useSpeakOnMount from "../../hooks/useSpeakOnMount";
import { generateRegistroPdf, savePdf } from "../../services/registroPdf";
import logger from "../../utils/logger";
import RegistroCard from "./buscar/RegistroCard";
import PdfOptionsSheet from "./buscar/PdfOptionsSheet";
import PdfViewerModal from "./buscar/PdfViewerModal";

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

const SEARCHABLE = ["municipio", "nomeAgredido", "apelido", "nomeAcs"];

const keyExtractor = (r) => r.id;

export default function Buscar({ navigation }) {
  const { spacing } = useTheme();
  const toast = useToast();
  useSpeakOnMount("Tela de histórico. Registros locais e da nuvem.");

  const { registros, loading, refreshing, refresh } = useHistoricoRegistros();

  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("todos");
  const deferredQuery = useDeferredValue(query);

  const [selected, setSelected] = useState(null); // registro com a folha de opções aberta
  const [generating, setGenerating] = useState(false);
  const [pdf, setPdf] = useState(null); // { path, base64 } enquanto o visualizador está aberto

  // Derivado durante a renderização (sem efeito nem estado extra).
  const visiveis = useMemo(() => {
    const q = normalize(deferredQuery.trim());
    return registros.filter((r) => {
      const enviado = r.status === "synced";
      if (filter === "pendentes" && enviado) return false;
      if (filter === "enviados" && !enviado) return false;
      if (!q) return true;
      return SEARCHABLE.some((k) => normalize(r[k]).includes(q));
    });
  }, [registros, deferredQuery, filter]);

  const abrirOpcoes = useCallback((registro) => setSelected(registro), []);

  const gerar = async (registro, opts) => {
    try {
      setGenerating(true);
      const result = await generateRegistroPdf(registro, opts);
      setSelected(null);
      setPdf(result);
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
      setPdf(null);
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

  const renderItem = useCallback(({ item }) => <RegistroCard registro={item} onOpen={abrirOpcoes} />, [abrirOpcoes]);

  const filtrando = query.trim().length > 0 || filter !== "todos";

  const empty = loading ? (
    <View style={styles.loading}>
      <ActivityIndicator size="large" />
      <Text variant="body" tone="muted">
        Carregando registros…
      </Text>
    </View>
  ) : filtrando ? (
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
      <ScreenHeader title="Buscar" subtitle={subtitle} />

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
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}
        keyboardShouldPersistTaps="handled"
        initialNumToRender={10}
        windowSize={7}
      />

      <PdfOptionsSheet
        registro={selected}
        generating={generating}
        onClose={() => setSelected(null)}
        onSelect={gerar}
      />

      <PdfViewerModal pdf={pdf} onClose={() => setPdf(null)} onDownload={baixar} onError={falhaNoVisualizador} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  list: { flexGrow: 1 },
  loading: { alignItems: "center", gap: 12, paddingTop: 48 },
});
