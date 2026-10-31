// src/pages/Extras/Duvidas.js
import React, { useState } from 'react';
import { ActivityIndicator, RefreshControl, View, StyleSheet } from 'react-native';
import { ScrollScreen, ScreenHeader, AccordionItem, EmptyState, Text } from '../../ui';
import { useTheme } from '../../theme/ThemeProvider';
import useAccessibility from '../../hooks/useAccessibility';
import useSpeakOnMount from '../../hooks/useSpeakOnMount';
import useDuvidas from '../../hooks/useDuvidas';

const ERROR_TEXT = {
  unavailable: 'O serviço de dúvidas está indisponível no momento.',
  permission: 'Sem permissão para acessar as dúvidas.',
  generic: 'Não foi possível carregar as dúvidas. Verifique sua conexão.',
};

export default function Duvidas({ navigation }) {
  const { spacing } = useTheme();
  const { textToSpeechEnabled, speak } = useAccessibility();
  useSpeakOnMount('Tela de dúvidas. Perguntas frequentes.');

  const { duvidas, loading, error, reload } = useDuvidas();

  const [expandedKey, setExpandedKey] = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  const toggle = (item) => {
    const opening = expandedKey !== item.key;
    setExpandedKey(opening ? item.key : null);
    if (opening && textToSpeechEnabled) speak(`Dúvida: ${item.titulo}. Resposta: ${item.resposta}`);
  };

  const refresh = async () => {
    setRefreshing(true);
    await reload();
    setRefreshing(false);
  };

  return (
    <ScrollScreen
      header={<ScreenHeader title="Dúvidas" onBack={() => navigation.goBack()} />}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}
    >
      {loading ? (
        <View style={styles.loading}>
          <ActivityIndicator size="large" />
          <Text variant="body" tone="muted">
            Carregando dúvidas…
          </Text>
        </View>
      ) : error ? (
        <EmptyState
          icon="wifi-off"
          title="Não foi possível carregar"
          description={ERROR_TEXT[error.kind]}
          actionLabel="Tentar de novo"
          onAction={reload}
        />
      ) : duvidas.length === 0 ? (
        <EmptyState
          icon="help-circle"
          title="Nenhuma dúvida ainda"
          description="As perguntas frequentes aparecem aqui."
        />
      ) : (
        <View style={{ gap: spacing.md }}>
          {duvidas.map((item) => (
            <AccordionItem
              key={item.key}
              title={item.titulo}
              expanded={expandedKey === item.key}
              onToggle={() => toggle(item)}
            >
              <Text variant="body">{item.resposta}</Text>
            </AccordionItem>
          ))}
        </View>
      )}
    </ScrollScreen>
  );
}

const styles = StyleSheet.create({
  loading: { alignItems: 'center', gap: 12, paddingTop: 32 },
});
