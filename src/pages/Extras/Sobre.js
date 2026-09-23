// src/pages/Extras/Sobre.js
import React, { useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Image,
  TouchableOpacity,
  Linking,
  Alert,
} from 'react-native';
import Header from '../../components/Header/Header';
import useAccessibility from '../../hooks/useAccessibility';
import logger from '../../utils/logger';

// Ícones e links
const socialLinks = [
  {
    nome: 'Instagram',
    imagem: require('../../assets/images/instagram.png'),
    url: 'https://www.instagram.com/saudeunica_amazoniabr/?app=desktop',
  },
  {
    nome: 'Twitter/X',
    imagem: require('../../assets/images/twitter.png'),
    url: 'https://x.com/saudeamazoniabr?app=desktop',
  },
  {
    nome: 'Youtube',
    imagem: require('../../assets/images/youtube.png'),
    url: 'https://www.youtube.com/@SaudeUnicaAmazoniaBR?app=desktop',
  },
];

export default function Sobre() {
  const { fontScale, highContrast, textToSpeechEnabled, speak } = useAccessibility();

  useEffect(() => {
    if (textToSpeechEnabled) {
      speak('Tela Sobre. Informações e eventos relacionados ao projeto.');
    }
  }, [textToSpeechEnabled, speak]);

  const eventos = [
    {
      titulo: 'I Seminário interno: Análise de risco da raiva na Amazônia',
      imagem: require('../../assets/images/programacao.png'),
    },
    {
      titulo: 'DRA - Curuçá 2024',
      imagem: require('../../assets/images/DRA.png'),
    },
  ];

  const abrirLink = async (url) => {
    try {
      await Linking.openURL(url);
    } catch (err) {
      logger.error('Sobre: erro', err);
      Alert.alert('Erro', 'Não foi possível abrir o link.');
    }
  };

  return (
    <View style={[styles.container, highContrast && styles.containerHC]}>
      <Header title="Sobre" />

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        <Text
          style={[
            styles.titulo,
            { fontSize: 24 * fontScale },
            highContrast && styles.tituloHC,
          ]}
        >
          Sobre
        </Text>

        {eventos.map((evento, index) => (
          <View
            key={index}
            style={[styles.containerFeed, highContrast && styles.containerFeedHC]}
          >
            <Image source={evento.imagem} style={styles.imgFeed} />
            <Text
              style={[
                styles.textoFeed,
                { fontSize: 18 * fontScale },
                highContrast && styles.textoFeedHC,
              ]}
            >
              {evento.titulo}
            </Text>
          </View>
        ))}

        {/* Redes Sociais */}
        <Text
          style={[
            styles.subtitulo,
            { fontSize: 20 * fontScale },
            highContrast && styles.tituloHC,
          ]}
        >
          Redes Sociais
        </Text>

        <View style={styles.redesContainer}>
          {socialLinks.map((rede, index) => (
            <TouchableOpacity
              key={index}
              onPress={() => abrirLink(rede.url)}
              accessibilityLabel={`Abrir ${rede.nome}`}
              style={styles.iconWrapper}
            >
              <Image
                source={rede.imagem}
                style={[
                  styles.socialIcon,
                  highContrast && styles.goldTint, // estilo extraído
                ]}
              />
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFF' },
  containerHC: { backgroundColor: '#000' },

  scroll: { alignItems: 'center', paddingBottom: 80 },

  titulo: {
    fontWeight: 'bold',
    padding: 30,
    textAlign: 'center',
    color: 'black',
  },
  tituloHC: { color: '#FFD700' },

  subtitulo: {
    fontWeight: 'bold',
    marginTop: 20,
    marginBottom: 10,
    color: 'black',
  },

  containerFeed: {
    marginBottom: 30,
    width: '90%',
    borderRadius: 15,
    backgroundColor: '#f2f2f2',
    overflow: 'hidden',
  },
  containerFeedHC: {
    backgroundColor: '#222',
    borderWidth: 2,
    borderColor: '#FFD700',
  },

  imgFeed: {
    height: 200,
    width: '100%',
    borderTopLeftRadius: 15,
    borderTopRightRadius: 15,
  },

  textoFeed: { padding: 12, fontSize: 18, color: 'black' },
  textoFeedHC: { color: '#FFD700' },

  redesContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    marginTop: 15,
  },

  iconWrapper: {
    margin: 15,
    alignItems: 'center',
  },

  socialIcon: {
    width: 50,
    height: 50,
    resizeMode: 'contain',
  },

  goldTint: {
    tintColor: '#FFD700', // removido do inline
  },
});

