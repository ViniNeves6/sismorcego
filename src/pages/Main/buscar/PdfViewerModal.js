// src/pages/Main/buscar/PdfViewerModal.js
import React, { useMemo } from "react";
import { ActivityIndicator, Modal, StyleSheet, View } from "react-native";
import Pdf from "react-native-pdf";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import { IconButton, Text } from "../../../ui";
import { useTheme } from "../../../theme/ThemeProvider";
import logger from "../../../utils/logger";

export default function PdfViewerModal({ pdf, onClose, onDownload, onError }) {
  const { colors, spacing } = useTheme();

  const source = useMemo(() => {
    if (!pdf) return null;
    if (pdf.path) return { uri: encodeURI(pdf.path), cache: false };
    if (pdf.base64) return { uri: `data:application/pdf;base64,${pdf.base64}` };
    return null;
  }, [pdf]);

  return (
    <Modal visible={Boolean(pdf)} animationType="slide" onRequestClose={onClose}>
      <SafeAreaProvider>
        <SafeAreaView style={[styles.fill, { backgroundColor: colors.canvas }]}>
          <View
            style={[
              styles.header,
              { borderBottomColor: colors.line, paddingHorizontal: spacing.sm, paddingVertical: spacing.xs },
            ]}
          >
            <IconButton icon="x" label="Fechar" onPress={onClose} />
            <Text variant="heading" accessibilityRole="header" style={styles.title}>
              Ficha em PDF
            </Text>
            <IconButton icon="download" label="Baixar ou compartilhar PDF" tone="primary" onPress={onDownload} />
          </View>

          {source ? (
            <Pdf
              source={source}
              style={[styles.fill, { backgroundColor: colors.surfaceMuted }]}
              onLoadComplete={(pages) => logger.log(`📄 PDF carregado: ${pages} página(s)`)}
              onError={(e) => {
                logger.error("❌ Erro no Pdf viewer:", e);
                onError();
              }}
              enableAntialiasing
              useAndroidHardwareAcceleration
              trustAllCerts={false}
            />
          ) : (
            <View style={[styles.fill, styles.center]}>
              <ActivityIndicator size="large" color={colors.primary} />
            </View>
          )}
        </SafeAreaView>
      </SafeAreaProvider>
    </Modal>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  center: { alignItems: "center", justifyContent: "center" },
  header: { flexDirection: "row", alignItems: "center", borderBottomWidth: StyleSheet.hairlineWidth },
  title: { flex: 1, textAlign: "center" },
});
