// src/pages/Extras/Sobre.js
import React from 'react';
import { Image, Linking, View, useWindowDimensions } from 'react-native';
import { ScrollScreen, ScreenHeader, Section, Card, Text, ListGroup, ListRow, Icon, useToast } from '../../ui';
import { useTheme } from '../../theme/ThemeProvider';
import useSpeakOnMount from '../../hooks/useSpeakOnMount';
import logger from '../../utils/logger';

// Proporção padrão pra todo card de evento (recorta com resizeMode="cover"),
// assim a altura fica sempre consistente independente da imagem de origem.
const EVENTO_ASPECT_RATIO = 16 / 9;

const EVENTOS = [
  {
    titulo: 'DRA - Curuçá 2024',
    imagem: require('../../assets/images/DRA.png'),
  },
];

const REDES = [
  { nome: 'Instagram', icon: 'instagram', url: 'https://www.instagram.com/saudeunica_amazoniabr/?app=desktop' },
  { nome: 'Twitter/X', icon: 'twitter', url: 'https://x.com/saudeamazoniabr?app=desktop' },
  { nome: 'YouTube', icon: 'youtube', url: 'https://www.youtube.com/@SaudeUnicaAmazoniaBR?app=desktop' },
];

export default function Sobre({ navigation }) {
  const { spacing, radius, colors } = useTheme();
  const { width: windowWidth } = useWindowDimensions();
  const toast = useToast();
  useSpeakOnMount('Tela Sobre. Informações e eventos relacionados ao projeto.');

  // Ver Informativos.js: width:'100%' + aspectRatio no Image não calcula a
  // altura de forma confiável no Android, então usamos pixels explícitos.
  const imageWidth = windowWidth - spacing.lg * 4;

  const abrirLink = async (url) => {
    try {
      await Linking.openURL(url);
    } catch (err) {
      logger.error('Sobre: erro', err);
      toast.show('Não foi possível abrir o link.', { tone: 'danger' });
    }
  };

  return (
    <ScrollScreen
      header={<ScreenHeader title="Sobre o projeto" onBack={() => navigation.goBack()} />}
      contentContainerStyle={{ gap: spacing.xl }}
    >
      <Section title="Eventos">
        {EVENTOS.map((evento) => (
          <Card key={evento.titulo}>
            <View style={{ gap: spacing.md }}>
              <Image
                source={evento.imagem}
                resizeMode="cover"
                accessibilityLabel={evento.titulo}
                style={{
                  width: imageWidth,
                  height: imageWidth / EVENTO_ASPECT_RATIO,
                  borderRadius: radius.md,
                  backgroundColor: colors.surfaceMuted,
                }}
              />
              <Text variant="bodyStrong">{evento.titulo}</Text>
            </View>
          </Card>
        ))}
      </Section>

      <Section title="Redes sociais">
        <ListGroup>
          {REDES.map((rede) => (
            <ListRow
              key={rede.nome}
              icon={rede.icon}
              title={rede.nome}
              onPress={() => abrirLink(rede.url)}
              trailing={<Icon name="external-link" size="md" color={colors.inkSubtle} />}
            />
          ))}
        </ListGroup>
      </Section>
    </ScrollScreen>
  );
}
