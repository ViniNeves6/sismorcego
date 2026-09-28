// src/pages/Extras/Duvidas.js
import React, { useState } from 'react';
import { ActivityIndicator, RefreshControl, View, StyleSheet } from 'react-native';
import {
  ScrollScreen,
  ScreenHeader,
  Button,
  TextField,
  Card,
  AccordionItem,
  EmptyState,
  Text,
  useToast,
} from '../../ui';
import { useTheme } from '../../theme/ThemeProvider';
import useAccessibility from '../../hooks/useAccessibility';
import useSpeakOnMount from '../../hooks/useSpeakOnMount';
import useDuvidas from '../../hooks/useDuvidas';

const ERROR_TEXT = {
  unavailable: 'O serviço de dúvidas está indisponível no momento.',
  permission: 'Sem permissão para acessar as dúvidas.',
  generic: 'Não foi possível carregar as dúvidas. Verifique sua conexão.',
};

const SAVE_ERROR_TEXT = {
  unavailable: 'O serviço de dúvidas está indisponível no momento.',
  permission: 'Sem permissão para salvar dúvidas.',
  generic: 'Não foi possível salvar sua dúvida.',
};

export default function Duvidas({ navigation }) {
  const { spacing } = useTheme();
  const toast = useToast();
  const { textToSpeechEnabled, speak } = useAccessibility();
  useSpeakOnMount('Tela de dúvidas. Você pode ver as dúvidas ou adicionar uma nova.');

  const { duvidas, loading, error, reload, add } = useDuvidas();

  const [expandedKey, setExpandedKey] = useState(null);
  const [adicionando, setAdicionando] = useState(false);
  const [novaDuvida, setNovaDuvida] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const toggle = (item) => {
    const opening = expandedKey !== item.key;
    setExpandedKey(opening ? item.key : null);
    if (opening && textToSpeechEnabled) speak(`Dúvida: ${item.titulo}. Resposta: ${item.resposta}`);
  };

  const enviar = async () => {
    const texto = novaDuvida.trim();
    if (!texto || enviando) return;

    try {
      setEnviando(true);
      await add(texto);
      setNovaDuvida('');
      setAdicionando(false);
      toast.show('Dúvida enviada.', { tone: 'success' });
      if (textToSpeechEnabled) speak('Sua dúvida foi adicionada com sucesso.');
    } catch (err) {
      toast.show(SAVE_ERROR_TEXT[err?.kind] || SAVE_ERROR_TEXT.generic, { tone: 'danger' });
    } finally {
      setEnviando(false);
    }
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
      {adicionando ? (
        <Card>
          <View style={{ gap: spacing.md }}>
            <TextField
              label="Sua dúvida"
              value={novaDuvida}
              onChangeText={setNovaDuvida}
              placeholder="Escreva sua pergunta"
              multiline
            />
            <View style={[styles.row, { gap: spacing.md }]}>
              <Button title="Cancelar" variant="secondary" onPress={() => setAdicionando(false)} style={styles.half} />
              <Button title="Enviar" onPress={enviar} loading={enviando} disabled={!novaDuvida.trim()} style={styles.half} />
            </View>
          </View>
        </Card>
      ) : (
        <Button title="Nova dúvida" icon="plus" variant="secondary" onPress={() => setAdicionando(true)} />
      )}

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
          description="Envie a primeira pergunta e ela aparece aqui com a resposta."
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
  row: { flexDirection: 'row' },
  half: { flex: 1 },
  loading: { alignItems: 'center', gap: 12, paddingTop: 32 },
});
