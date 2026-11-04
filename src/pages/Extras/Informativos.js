// src/pages/Extras/Informativos.js
// Material educativo (infográficos) sobre morcegos e raiva.
import React from 'react';
import { Image, View, useWindowDimensions } from 'react-native';
import { ScrollScreen, ScreenHeader, Card, Text } from '../../ui';
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
  const { width: windowWidth } = useWindowDimensions();
  useSpeakOnMount('Tela de informativos. Material educativo sobre morcegos e raiva.');

  // Largura real disponível dentro do Card (tela com padding + padding do
  // próprio Card, dos dois lados). Passamos altura em pixel, calculada a
  // partir daí — o par width:'100%' + aspectRatio direto no Image não
  // calcula a altura de forma confiável no Android.
  const imageWidth = windowWidth - spacing.lg * 4;

  return (
    <ScrollScreen
      header={<ScreenHeader title="Informativos" onBack={() => navigation.goBack()} />}
      contentContainerStyle={{ gap: spacing.xl }}
    >
      {INFORMATIVOS.map((item) => (
        <Card key={item.titulo}>
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
          </View>
        </Card>
      ))}
    </ScrollScreen>
  );
}
