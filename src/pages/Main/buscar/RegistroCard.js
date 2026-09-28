// src/pages/Main/buscar/RegistroCard.js
import React, { memo } from "react";
import { View, StyleSheet } from "react-native";
import { Card, Text, Badge, Icon } from "../../../ui";
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

function RegistroCard({ registro, onOpen }) {
  const { spacing, colors } = useTheme();
  const status = statusOf(registro);
  const municipio = registro.municipio || "Sem município";
  const dataAgressao = formatarDataCurta(registro.dataAgressao || registro.dataRegistro);
  const hasPhoto = Boolean(registro.photoUriLocal || registro.photoBase64);
  const origem = registro._origin === "cloud" ? "Na nuvem" : "Só no aparelho";

  return (
    <Card
      onPress={() => onOpen(registro)}
      accessibilityLabel={`Registro em ${municipio}, ${dataAgressao}. ${status.label}. Abrir opções de PDF`}
    >
      <View style={{ gap: spacing.sm }}>
        <View style={styles.top}>
          <Text variant="heading" numberOfLines={1} style={styles.title}>
            {municipio}
          </Text>
          <Icon name="file-text" size="md" color={colors.inkSubtle} />
        </View>

        <Text variant="caption" tone="muted">
          Agressão em {dataAgressao} · {origem}
        </Text>

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
  badges: { flexDirection: "row", flexWrap: "wrap" },
});

export default memo(RegistroCard);
