// src/pages/Main/Painel.js
// Painel do coordenador: resumo, mapa de calor e contagem por período.
// Só aparece pra role === "coordenador" (ver AppTabs.js). Reaproveita o
// mesmo hook de dados da aba Buscar — sem consulta nova ao Firestore.
import React, { useMemo, useState } from "react";
import { View, StyleSheet } from "react-native";
import MapView, { Heatmap } from "react-native-maps";
import { ScrollScreen, ScreenHeader, Section, Card, Badge, SegmentedControl, EmptyState, Text } from "../../ui";
import { useTheme } from "../../theme/ThemeProvider";
import useHistoricoRegistros from "../../hooks/useHistoricoRegistros";
import useSpeakOnMount from "../../hooks/useSpeakOnMount";

const REGIAO_PADRAO = { latitude: -1.354986, longitude: -48.395724, latitudeDelta: 4, longitudeDelta: 4 };

const AGRUPAMENTO = [
  { value: "mes", label: "Mês" },
  { value: "dia", label: "Dia" },
];

const MESES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

const dataDoRegistro = (r) => {
  const iso = r.dataAgressao || r.dataMordedura || r.dataRegistro;
  const d = iso ? new Date(iso) : null;
  return d && !isNaN(d.getTime()) ? d : null;
};

const regiaoDosPontos = (pontos) => {
  if (!pontos.length) return REGIAO_PADRAO;
  const lats = pontos.map((p) => p.latitude);
  const lngs = pontos.map((p) => p.longitude);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs);
  const maxLng = Math.max(...lngs);
  return {
    latitude: (minLat + maxLat) / 2,
    longitude: (minLng + maxLng) / 2,
    latitudeDelta: Math.max(maxLat - minLat, 0.05) * 1.4,
    longitudeDelta: Math.max(maxLng - minLng, 0.05) * 1.4,
  };
};

export default function Painel() {
  const { spacing, colors, radius } = useTheme();
  useSpeakOnMount("Painel do coordenador. Resumo, mapa de calor e registros por período.");
  const { registros, loading } = useHistoricoRegistros();

  const [agrupamento, setAgrupamento] = useState("mes");

  const resumo = useMemo(() => {
    let humanos = 0;
    let caninoFelino = 0;
    let aves = 0;
    let producao = 0;

    for (const r of registros) {
      const tipo = r.tipoVitima || "humano";
      if (tipo === "humano") humanos += 1;
      else if (tipo === "caninoFelino") caninoFelino += 1;
      else if (tipo === "aves") aves += 1;
      else if (tipo === "producao") producao += 1;
    }

    return { total: registros.length, humanos, animais: caninoFelino + aves + producao, caninoFelino, aves, producao };
  }, [registros]);

  const pontos = useMemo(
    () =>
      registros
        .filter((r) => typeof r.location?.latitude === "number" && typeof r.location?.longitude === "number")
        .map((r) => ({ latitude: r.location.latitude, longitude: r.location.longitude, weight: 1 })),
    [registros]
  );
  const semLocalizacao = registros.length - pontos.length;

  const periodos = useMemo(() => {
    const contagem = new Map();

    for (const r of registros) {
      const d = dataDoRegistro(r);
      if (!d) continue;

      const chave =
        agrupamento === "mes"
          ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
          : `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      const rotulo =
        agrupamento === "mes"
          ? `${MESES[d.getMonth()]}/${d.getFullYear()}`
          : `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;

      contagem.set(chave, { rotulo, total: (contagem.get(chave)?.total || 0) + 1 });
    }

    return Array.from(contagem.entries())
      .sort(([a], [b]) => (a < b ? 1 : -1))
      .map(([chave, v]) => ({ chave, ...v }));
  }, [registros, agrupamento]);

  return (
    <ScrollScreen
      header={<ScreenHeader title="Painel" subtitle={loading ? undefined : `${resumo.total} registros no total`} />}
      contentContainerStyle={{ gap: spacing.xl }}
    >
      <Section title="Resumo">
        <View style={[styles.row, { gap: spacing.md }]}>
          <Card style={styles.card}>
            <Text variant="display">{resumo.total}</Text>
            <Text variant="caption" tone="muted">Total de registros</Text>
          </Card>
          <Card style={styles.card}>
            <Text variant="display">{resumo.humanos}</Text>
            <Text variant="caption" tone="muted">Casos humanos</Text>
          </Card>
          <Card style={styles.card}>
            <Text variant="display">{resumo.animais}</Text>
            <Text variant="caption" tone="muted">Casos em animais</Text>
          </Card>
        </View>
        <View style={[styles.row, { gap: spacing.sm, flexWrap: "wrap" }]}>
          <Badge label={`Canino/Felino: ${resumo.caninoFelino}`} tone="neutral" />
          <Badge label={`Aves: ${resumo.aves}`} tone="neutral" />
          <Badge label={`Produção: ${resumo.producao}`} tone="neutral" />
        </View>
      </Section>

      <Section title="Mapa de calor" description={semLocalizacao > 0 ? `${semLocalizacao} registro(s) sem localização não aparecem no mapa.` : undefined}>
        {pontos.length === 0 ? (
          <EmptyState icon="map" title="Nenhum ponto ainda" description="Registros com localização capturada aparecem aqui." />
        ) : (
          <MapView
            style={[styles.map, { borderRadius: radius.md, backgroundColor: colors.surfaceMuted }]}
            initialRegion={regiaoDosPontos(pontos)}
          >
            <Heatmap points={pontos} radius={40} opacity={0.8} />
          </MapView>
        )}
      </Section>

      <Section title="Registros por período">
        <SegmentedControl label="Agrupar por" options={AGRUPAMENTO} value={agrupamento} onChange={setAgrupamento} />
        {periodos.length === 0 ? (
          <EmptyState icon="bar-chart-2" title="Sem dados ainda" description="Os registros aparecem aqui, agrupados por período." />
        ) : (
          <View style={{ gap: spacing.sm }}>
            {periodos.map((p) => (
              <Card key={p.chave} style={styles.periodoRow}>
                <Text variant="bodyStrong">{p.rotulo}</Text>
                <Badge label={`${p.total} ${p.total === 1 ? "registro" : "registros"}`} tone="primary" />
              </Card>
            ))}
          </View>
        )}
      </Section>
    </ScrollScreen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row" },
  card: { flex: 1, alignItems: "center", gap: 2, paddingVertical: 16 },
  map: { height: 280 },
  periodoRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
});
