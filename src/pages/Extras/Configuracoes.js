// src/pages/Extras/Configuracoes.js
import React, { useCallback } from 'react';
import { View, Text, StyleSheet, Switch, TouchableOpacity } from 'react-native';
import Header from '../../components/Header/Header';
import useAccessibility from '../../hooks/useAccessibility';
import useNotifications from '../../hooks/useNotifications';

const Configuracoes = () => {
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

  // wrapper seguro para falar só quando TTS estiver ativo
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

  // estilos de switch dinâmicos
  const switchProps = highContrast
    ? {
        trackColor: { false: '#444', true: '#FFD700' },
        thumbColor: '#FFD700',
        ios_backgroundColor: '#444',
      }
    : {
        trackColor: { false: '#767577', true: '#81b0ff' },
        thumbColor: textToSpeechEnabled ? '#6200ee' : '#f4f3f4',
        ios_backgroundColor: '#767577',
      };

  // handlers com anúncio por voz (quando TTS ligado)
  const onToggleNotifications = (v) => {
    toggleNotifications(v);
    say(v ? 'Notificações ativadas' : 'Notificações desativadas');
  };

  const onToggleContrast = (v) => {
    toggleContrast(v);
    say(v ? 'Alto contraste ativado' : 'Alto contraste desativado');
  };

  const onToggleTTS = (v) => {
    toggleTTS(v);
    // se acabou de ativar, já confirma em voz
    if (v) say('Texto falado ativado');
  };

  const onIncreaseFont = () => {
    increaseFont();
    say('Aumentando tamanho da fonte');
  };

  const onDecreaseFont = () => {
    decreaseFont();
    say('Diminuindo tamanho da fonte');
  };

  return (
    <View style={[styles.container, highContrast && styles.highContrast]}>
      <Header title="Configurações" showBackButton />
      <View style={styles.content}>
        {/* Notificações */}
        <View style={styles.item}>
          <Text
            style={[
              styles.label,
              { fontSize: 16 * fontScale },
              highContrast && styles.highContrastText,
            ]}
            accessibilityRole="text"
          >
            Notificações
          </Text>
          <Switch
            value={notificationsEnabled}
            onValueChange={onToggleNotifications}
            accessibilityRole="switch"
            accessibilityLabel="Alternar notificações"
            accessibilityState={{ checked: notificationsEnabled }}
            {...switchProps}
          />
        </View>

        {/* Fonte */}
        <View style={styles.item}>
          <Text
            style={[
              styles.label,
              { fontSize: 16 * fontScale },
              highContrast && styles.highContrastText,
            ]}
            accessibilityRole="text"
          >
            Tamanho da Fonte
          </Text>
          <View style={styles.fontButtons}>
            <TouchableOpacity
              style={[styles.btn, highContrast && styles.highContrastBtn]}
              onPress={onDecreaseFont}
              accessibilityRole="button"
              accessibilityLabel="Diminuir tamanho da fonte"
            >
              <Text
                style={[
                  styles.btnText,
                  highContrast && styles.highContrastBtnText,
                ]}
              >
                A-
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.btn, highContrast && styles.highContrastBtn]}
              onPress={onIncreaseFont}
              accessibilityRole="button"
              accessibilityLabel="Aumentar tamanho da fonte"
            >
              <Text
                style={[
                  styles.btnText,
                  highContrast && styles.highContrastBtnText,
                ]}
              >
                A+
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Indicador simples do fontScale atual */}
        <View style={styles.metaRow}>
          <Text
            style={[
              styles.metaText,
              { fontSize: 12 * fontScale },
              highContrast && styles.highContrastText,
            ]}
          >
            Tamanho atual: {fontScale.toFixed(2)}x
          </Text>
        </View>

        {/* Contraste */}
        <View style={styles.item}>
          <Text
            style={[
              styles.label,
              { fontSize: 16 * fontScale },
              highContrast && styles.highContrastText,
            ]}
            accessibilityRole="text"
          >
            Contraste Alto
          </Text>
          <Switch
            value={highContrast}
            onValueChange={onToggleContrast}
            accessibilityRole="switch"
            accessibilityLabel="Alternar alto contraste"
            accessibilityState={{ checked: highContrast }}
            {...switchProps}
          />
        </View>

        {/* Texto Falado */}
        <View style={styles.item}>
          <Text
            style={[
              styles.label,
              { fontSize: 16 * fontScale },
              highContrast && styles.highContrastText,
            ]}
            accessibilityRole="text"
          >
            Texto Falado
          </Text>
          <Switch
            value={textToSpeechEnabled}
            onValueChange={onToggleTTS}
            accessibilityRole="switch"
            accessibilityLabel="Alternar texto falado"
            accessibilityState={{ checked: textToSpeechEnabled }}
            {...switchProps}
          />
        </View>

        {/* Botão de teste TTS */}
        {textToSpeechEnabled && (
          <TouchableOpacity
            style={[styles.ttsButton, highContrast && styles.highContrastCta]}
            onPress={() =>
              say('Estas são as configurações do aplicativo.')
            }
            accessibilityRole="button"
            accessibilityLabel="Ler configurações em voz alta"
          >
            <Text
              style={[
                styles.btnText,
                highContrast && styles.highContrastCtaText,
              ]}
            >
              🔊 Ler Configurações
            </Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  highContrast: { backgroundColor: '#000' },
  content: { flex: 1, padding: 20 },

  item: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },

  label: { color: '#333', fontWeight: 'bold' },
  highContrastText: { color: '#FFD700' },

  fontButtons: { flexDirection: 'row' },
  btn: {
    backgroundColor: '#6200ee',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    marginLeft: 8,
  },
  btnText: { color: '#fff', fontWeight: 'bold' },

  // Em alto contraste, aumente a diferença de luminância (ouro no fundo preto)
  highContrastBtn: { backgroundColor: '#FFD700' },
  highContrastBtnText: { color: '#000', fontWeight: 'bold' },

  metaRow: { marginTop: -10, marginBottom: 10 },
  metaText: { color: '#666' },

  ttsButton: {
    marginTop: 20,
    backgroundColor: '#00796B',
    padding: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  highContrastCta: { backgroundColor: '#FFD700' },
  highContrastCtaText: { color: '#000', fontWeight: 'bold' },
});

export default Configuracoes;
