// src/pages/Main/buscar/RegistroCard.js
import React, { memo } from "react";
import { View, StyleSheet } from "react-native";
import { Card, Text, Badge, Icon, IconButton } from "../../../ui";
import { useTheme } from "../../../theme/ThemeProvider";
import { formatarDataCurta } from "../../../services/registroPdf";

// status da fila: pending | syncing | failed | synced
const STATUS = {
  synced: { label: "Enviado", tone: "success", icon: "check-circle" },
  syncing: { label: "Enviando", tone: "primary", icon: "upload-cloud" },
  failed: { label: "Falha no envio", tone: "danger", icon: "alert-circle" },
  pending: { label: "Pendente", tone: "warning", icon: "clock" },
};

export const statusOf = (registro) => STATUS[registro?.status] || STATUS.pending;

// Resumo curto do "quem/o quê" foi mordido, por tipo de vítima.
// Registros antigos (sem tipoVitima) mostram o nome direto, como sempre foi.
const resumoVitima = (registro) => {
  const tipo = registro.tipoVitima;
  const d = registro.detalhes || {};

  if (!tipo) return registro.nomeAgredido || "Vítima não identificada";
  if (tipo === "humano") return d.nomeAgredido || "Vítima não identificada";
  if (tipo === "caninoFelino") return d.especie === "felina" ? "Felino" : "Canino";
  if (tipo === "aves") return "Ave";
  if (tipo === "producao") return "Animal de produção";
  return "Registro";
};

function RegistroCard({ registro, onOpen, onDelete, isAdmin }) {
  const { spacing, colors } = useTheme();
  const status = statusOf(registro);
  const municipio = registro.municipio || "Sem município";
  const dataAgressao = formatarDataCurta(registro.dataAgressao || registro.dataMordedura || registro.dataRegistro);
  const hasPhoto = Boolean(registro.photoUriLocal || registro.photoBase64);
  const origem = registro._origin === "cloud" ? "Na nuvem" : "Só no aparelho";
  const nomeAcs = isAdmin ? registro.nomeAcs || "ACS não identificado" : null;
  const vitima = resumoVitima(registro);

  return (
    <Card
      onPress={() => onOpen(registro)}
      accessibilityLabel={`${vitima}, em ${municipio}, ${dataAgressao}${nomeAcs ? `, de ${nomeAcs}` : ""}. ${status.label}. Abrir opções de PDF`}
    >
      <View style={{ gap: spacing.sm }}>
        <View style={styles.top}>
          <View style={styles.title}>
            <Text variant="heading" numberOfLines={1}>
              {vitima}
            </Text>
            <Text variant="caption" tone="muted" numberOfLines={1}>
              {municipio}
            </Text>
          </View>
          <View style={[styles.actions, { gap: spacing.xs }]}>
            {isAdmin && onDelete ? (
              <IconButton icon="trash-2" label="Excluir registro" tone="danger" onPress={() => onDelete(registro)} />
            ) : null}
            <Icon name="file-text" size="md" color={colors.inkSubtle} />
          </View>
        </View>

        <Text variant="caption" tone="muted">
          Agressão em {dataAgressao} · {origem}
        </Text>

        {nomeAcs ? (
          <Text variant="caption" tone="muted">
            ACS: {nomeAcs}
          </Text>
        ) : null}

        <View style={[styles.badges, { gap: spacing.sm }]}>
          <Badge label={status.label} tone={status.tone} icon={status.icon} />
          {hasPhoto ? <Badge label="Com foto" tone="neutral" icon="camera" /> : null}
        </View>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  top: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  title: { flex: 1 },
  actions: { flexDirection: "row", alignItems: "center" },
  badges: { flexDirection: "row", flexWrap: "wrap" },
});

export default memo(RegistroCard);
