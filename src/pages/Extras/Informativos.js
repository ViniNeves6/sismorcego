// src/pages/Extras/Informativos.js
// Material educativo (infográficos) sobre morcegos e raiva.
import React from 'react';
import { Image, View, StyleSheet } from 'react-native';
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
  useSpeakOnMount('Tela de informativos. Material educativo sobre morcegos e raiva.');

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
              style={[
                styles.image,
                { aspectRatio: item.aspectRatio, borderRadius: radius.md, backgroundColor: colors.surfaceMuted },
              ]}
            />
          </View>
        </Card>
      ))}
    </ScrollScreen>
  );
}

const styles = StyleSheet.create({
  image: { width: '100%' },
});
