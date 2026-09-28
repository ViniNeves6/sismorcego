// src/pages/Main/buscar/PdfOptionsSheet.js
import React from "react";
import { ActivityIndicator, View } from "react-native";
import { BottomSheet, ListGroup, ListRow, Text } from "../../../ui";
import { useTheme } from "../../../theme/ThemeProvider";

const OPTIONS = [
  {
    key: "completo",
    icon: "file-text",
    title: "Ficha completa",
    subtitle: "Com nomes e localização",
    opts: { includeNames: true, includeLocation: true },
  },
  {
    key: "sem-localizacao",
    icon: "map-pin",
    title: "Sem localização",
    subtitle: "Oculta latitude e longitude",
    opts: { includeNames: true, includeLocation: false },
  },
  {
    key: "sem-nomes",
    icon: "user-x",
    title: "Sem nomes",
    subtitle: "Oculta o nome do ACS e da pessoa agredida",
    opts: { includeNames: false, includeLocation: true },
  },
];

export default function PdfOptionsSheet({ registro, generating, onClose, onSelect }) {
  const { colors, spacing } = useTheme();

  return (
    <BottomSheet visible={Boolean(registro)} onClose={generating ? () => {} : onClose} title="Gerar ficha em PDF">
      <View style={{ padding: spacing.xl, paddingTop: spacing.sm, gap: spacing.lg }}>
        <Text variant="body" tone="muted">
          A ficha pode conter dados pessoais. Escolha o que incluir antes de gerar ou compartilhar.
        </Text>

        <ListGroup>
          {OPTIONS.map((o) => (
            <ListRow
              key={o.key}
              icon={o.icon}
              title={o.title}
              subtitle={o.subtitle}
              onPress={generating ? undefined : () => onSelect(registro, o.opts)}
              trailing={generating ? <ActivityIndicator color={colors.primary} /> : undefined}
            />
          ))}
        </ListGroup>
      </View>
    </BottomSheet>
  );
}
