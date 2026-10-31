// src/pages/Extras/Informativos.js
// Material educativo (infográficos) sobre morcegos e raiva.
import React, { useState } from 'react';
import { Image, Modal, Pressable, View, StyleSheet, useWindowDimensions } from 'react-native';
import { ScrollScreen, ScreenHeader, Card, Text, IconButton } from '../../ui';
import { useTheme } from '../../theme/ThemeProvider';
import useSpeakOnMount from '../../hooks/useSpeakOnMount';

const INFORMATIVOS = [
  {
    titulo: 'Diversidade de morcegos',
    imagem: require('../../assets/images/InfoDiversidadeMorcegos.jpg'),
    aspectRatio: 1600 / 1131,
  },
  {
    titulo: 'A doença raiva',
    imagem: require('../../assets/images/InfoDoencaRaiva.jpg'),
    aspectRatio: 1600 / 2114,
  },
];

export default function Informativos({ navigation }) {
  const { spacing, radius, colors } = useTheme();
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  useSpeakOnMount('Tela de informativos. Material educativo sobre morcegos e raiva. Toque numa imagem pra ampliar.');

  const [aberto, setAberto] = useState(null);

  // Largura real disponível dentro do Card (tela com padding + padding do
  // próprio Card, dos dois lados). Passamos altura em pixel, calculada a
  // partir daí — o par width:'100%' + aspectRatio direto no Image não
  // calcula a altura de forma confiável no Android.
  const imageWidth = windowWidth - spacing.lg * 4;

  // Tela cheia: encaixa pela maior dimensão (retrato ou paisagem) dentro da
  // janela, com uma margem pra não colar nas bordas.
  const fullWidth = windowWidth - spacing.lg * 2;
  const fullHeight = windowHeight - spacing.xl * 4;
  const fullSize = (ratio) => {
    let w = fullWidth;
    let h = w / ratio;
    if (h > fullHeight) {
      h = fullHeight;
      w = h * ratio;
    }
    return { width: w, height: h };
  };

  return (
    <ScrollScreen
      header={<ScreenHeader title="Informativos" onBack={() => navigation.goBack()} />}
      contentContainerStyle={{ gap: spacing.xl }}
    >
      {INFORMATIVOS.map((item) => (
        <Card key={item.titulo} onPress={() => setAberto(item)} accessibilityLabel={`Ampliar: ${item.titulo}`}>
          <View style={{ gap: spacing.md }}>
            <Text variant="bodyStrong">{item.titulo}</Text>
            <Image
              source={item.imagem}
              resizeMode="contain"
              accessibilityLabel={item.titulo}
              style={{
                width: imageWidth,
                height: imageWidth / item.aspectRatio,
                borderRadius: radius.md,
                backgroundColor: colors.surfaceMuted,
              }}
            />
            <Text variant="caption" tone="muted">Toque pra ampliar</Text>
          </View>
        </Card>
      ))}

      <Modal visible={!!aberto} transparent animationType="fade" onRequestClose={() => setAberto(null)}>
        <Pressable style={styles.backdrop} onPress={() => setAberto(null)}>
          {aberto ? (
            <Image
              source={aberto.imagem}
              resizeMode="contain"
              accessibilityLabel={aberto.titulo}
              style={fullSize(aberto.aspectRatio)}
            />
          ) : null}
          <View style={[styles.closeButton, { top: spacing.xl }]}>
            <IconButton icon="x" label="Fechar" onPress={() => setAberto(null)} tone="onBrand" />
          </View>
        </Pressable>
      </Modal>
    </ScrollScreen>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.92)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeButton: { position: 'absolute', right: 16 },
});
