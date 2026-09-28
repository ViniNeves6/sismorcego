// src/pages/Extras/Configuracoes.js
import React, { useCallback } from 'react';
import { View, StyleSheet } from 'react-native';
import { ScrollScreen, ScreenHeader, Section, ListGroup, SwitchRow, Card, Text, Button, useToast } from '../../ui';
import { useTheme } from '../../theme/ThemeProvider';
import useAccessibility from '../../hooks/useAccessibility';
import useNotifications from '../../hooks/useNotifications';

const Configuracoes = ({ navigation }) => {
  const {
    fontScale,
    increaseFont,
    decreaseFont,
    highContrast,
    toggleContrast,
    textToSpeechEnabled,
    toggleTTS,
    speak,
  } = useAccessibility();
  const { notificationsEnabled, toggleNotifications } = useNotifications();
  const { spacing } = useTheme();
  const toast = useToast();

  // Fala só quando a leitura em voz alta está ativa.
  const say = useCallback(
    (msg) => {
      try {
        if (textToSpeechEnabled && typeof speak === 'function') speak(msg);
      } catch (e) {
        // evita crash de TTS
      }
    },
    [textToSpeechEnabled, speak]
  );

  const onToggleNotifications = (v) => {
    toggleNotifications(v);
    toast.show(v ? 'Notificações ativadas.' : 'Notificações desativadas.', { tone: 'info' });
    say(v ? 'Notificações ativadas' : 'Notificações desativadas');
  };

  const onToggleContrast = (v) => {
    toggleContrast(v);
    say(v ? 'Alto contraste ativado' : 'Alto contraste desativado');
  };

  const onToggleTTS = (v) => {
    toggleTTS(v);
    // Ao ativar, confirma em voz.
    if (v) say('Leitura em voz alta ativada');
  };

  const onIncreaseFont = () => {
    increaseFont();
    say('Aumentando tamanho do texto');
  };

  const onDecreaseFont = () => {
    decreaseFont();
    say('Diminuindo tamanho do texto');
  };

  const percent = Math.round(fontScale * 100);

  return (
    <ScrollScreen
      header={<ScreenHeader title="Configurações" onBack={() => navigation.goBack()} />}
      contentContainerStyle={{ gap: spacing.xl }}
    >
      <Section title="Acessibilidade">
        <ListGroup>
          <SwitchRow
            icon="sun"
            title="Alto contraste"
            subtitle="Fundo preto e destaques em amarelo"
            value={highContrast}
            onValueChange={onToggleContrast}
          />
          <SwitchRow
            icon="volume-2"
            title="Leitura em voz alta"
            subtitle="O app fala o conteúdo das telas"
            value={textToSpeechEnabled}
            onValueChange={onToggleTTS}
          />
        </ListGroup>

        <Card>
          <View style={{ gap: spacing.md }}>
            <View style={styles.between}>
              <Text variant="bodyStrong">Tamanho do texto</Text>
              <Text variant="bodyStrong" tone="primary" accessibilityLabel={`${percent} por cento`}>
                {percent}%
              </Text>
            </View>
            <Text variant="body" tone="muted">
              Assim o texto aparece nas telas do app.
            </Text>
            <View style={[styles.row, { gap: spacing.md }]}>
              <Button title="Diminuir" icon="minus" variant="secondary" onPress={onDecreaseFont} style={styles.half} />
              <Button title="Aumentar" icon="plus" variant="secondary" onPress={onIncreaseFont} style={styles.half} />
            </View>
          </View>
        </Card>
      </Section>

      <Section title="Avisos">
        <ListGroup>
          <SwitchRow
            icon="bell"
            title="Notificações"
            subtitle="Receber avisos do Sismorcego"
            value={notificationsEnabled}
            onValueChange={onToggleNotifications}
          />
        </ListGroup>
      </Section>
    </ScrollScreen>
  );
};

const styles = StyleSheet.create({
  between: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  row: { flexDirection: 'row' },
  half: { flex: 1 },
});

export default Configuracoes;
