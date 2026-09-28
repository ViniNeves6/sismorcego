// src/pages/Extras/Sobre.js
import React from 'react';
import { Image, Linking, View, StyleSheet } from 'react-native';
import { ScrollScreen, ScreenHeader, Section, Card, Text, ListGroup, ListRow, Icon, useToast } from '../../ui';
import { useTheme } from '../../theme/ThemeProvider';
import useSpeakOnMount from '../../hooks/useSpeakOnMount';
import logger from '../../utils/logger';

const EVENTOS = [
  {
    titulo: 'I Seminário interno: Análise de risco da raiva na Amazônia',
    imagem: require('../../assets/images/programacao.png'),
    aspectRatio: 16 / 9,
  },
  {
    titulo: 'DRA - Curuçá 2024',
    imagem: require('../../assets/images/DRA.png'),
    aspectRatio: 3 / 2,
  },
];

const REDES = [
  { nome: 'Instagram', icon: 'instagram', url: 'https://www.instagram.com/saudeunica_amazoniabr/?app=desktop' },
  { nome: 'Twitter/X', icon: 'twitter', url: 'https://x.com/saudeamazoniabr?app=desktop' },
  { nome: 'YouTube', icon: 'youtube', url: 'https://www.youtube.com/@SaudeUnicaAmazoniaBR?app=desktop' },
];

export default function Sobre({ navigation }) {
  const { spacing, radius, colors } = useTheme();
  const toast = useToast();
  useSpeakOnMount('Tela Sobre. Informações e eventos relacionados ao projeto.');

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
                style={[
                  styles.image,
                  { aspectRatio: evento.aspectRatio, borderRadius: radius.md, backgroundColor: colors.surfaceMuted },
                ]}
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

const styles = StyleSheet.create({
  image: { width: '100%' },
});
