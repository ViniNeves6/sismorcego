// src/pages/Extras/Creditos.js
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Image,
  TouchableOpacity,
  LayoutAnimation,
  Platform,
  UIManager,
} from 'react-native';
import Header from '../../components/Header/Header';
import useAccessibility from '../../hooks/useAccessibility';

// Necessário no Android para habilitar animações
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

export default function Creditos() {
  const { fontScale, highContrast, textToSpeechEnabled, speak } = useAccessibility();
  const [eixosAtivos, setEixosAtivos] = useState({}); // objeto com flags por eixo

  useEffect(() => {
    if (textToSpeechEnabled) {
      speak('Tela de Créditos. Toque em um eixo para visualizar os participantes.');
    }
    // não forçamos stop do TTS aqui para evitar cortar falas correntes do app
  }, [textToSpeechEnabled, speak]);

  // Memoiza para evitar recriar estrutura a cada render
  const creditosPorEixo = useMemo(
    () => ({
      Tecnologia: [
        { nome: 'Pedro Dimas', funcao: 'Bolsista', imagem: require('../../assets/images/pedro.png') },
        { nome: 'André Vinicius', funcao: 'Bolsista', imagem: require('../../assets/images/andre.png') },
        { nome: 'Paulo Pontes', funcao: 'Orientador', imagem: require('../../assets/images/paulo.png') },
        { nome: 'Marcos Seruffo', funcao: 'Orientador', imagem: require('../../assets/images/seruffo.png') },
      ],
      'Tradução do Conhecimento': [
        { nome: 'Eixo sem dados de participantes', funcao: 'Informação indisponível', imagem: require('../../assets/images/default-profile.png') },
      ],
      'Campo/Laboratorio': [
        { nome: 'Eixo sem dados de participantes', funcao: 'Informação indisponível', imagem: require('../../assets/images/default-profile.png') },
      ],
      'Determinantes sociais': [
        { nome: 'Eixo sem dados de participantes', funcao: 'Informação indisponível', imagem: require('../../assets/images/default-profile.png') },
      ],
    }),
    []
  );

  const toggleEixo = useCallback(
    (eixo) => {
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      setEixosAtivos((prev) => {
        const novoEstado = !prev[eixo];
        const qtd = creditosPorEixo[eixo]?.length ?? 0;

        if (textToSpeechEnabled) {
          if (novoEstado) {
            speak(`Eixo ${eixo} expandido. ${qtd} participantes exibidos.`);
          } else {
            speak(`Eixo ${eixo} recolhido.`);
          }
        }

        return {
          ...prev,
          [eixo]: novoEstado,
        };
      });
    },
    [creditosPorEixo, speak, textToSpeechEnabled]
  );

  return (
    <View style={[styles.container, highContrast && styles.containerHC]}>
      <Header title="Créditos" />

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        <Text
          style={[
            styles.titulo,
            { fontSize: 24 * fontScale },
            highContrast && styles.tituloHC,
          ]}
          accessibilityRole="header"
          accessibilityLabel="Créditos"
        >
          Créditos
        </Text>

        {Object.keys(creditosPorEixo).map((eixo) => (
          <View key={eixo} style={styles.eixoContainer}>
            {/* Botão do eixo */}
            <TouchableOpacity
              style={[
                styles.botaoEixo,
                eixosAtivos[eixo] && styles.botaoEixoAtivo,
                highContrast && styles.botaoEixoHC,
              ]}
              onPress={() => toggleEixo(eixo)}
              accessibilityRole="button"
              accessibilityLabel={`Eixo ${eixo}. ${eixosAtivos[eixo] ? 'Recolher' : 'Expandir'}.`}
            >
              <Text
                style={[
                  styles.botaoEixoTexto,
                  highContrast && styles.botaoEixoTextoHC,
                  { fontSize: 18 * fontScale },
                ]}
              >
                {eixo}
              </Text>
            </TouchableOpacity>

            {/* Cards aparecem se o eixo está ativo */}
            {eixosAtivos[eixo] &&
              creditosPorEixo[eixo].map((pessoa, index) => (
                <View
                  key={`${eixo}-${index}`}
                  style={[styles.itemContainer, highContrast && styles.itemContainerHC]}
                  accessible
                  accessibilityLabel={`${pessoa.nome}, ${pessoa.funcao}`}
                >
                  <Image source={pessoa.imagem} style={styles.img} />
                  <View style={styles.textContainer}>
                    <Text
                      style={[
                        styles.nome,
                        { fontSize: 18 * fontScale },
                        highContrast && styles.nomeHC,
                      ]}
                    >
                      Nome: {pessoa.nome}
                    </Text>
                    <Text
                      style={[
                        styles.funcao,
                        { fontSize: 16 * fontScale },
                        highContrast && styles.funcaoHC,
                      ]}
                    >
                      Cargo: {pessoa.funcao}
                    </Text>
                  </View>
                </View>
              ))}
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFF' },
  containerHC: { backgroundColor: '#000' },

  scroll: {
    alignItems: 'center',
    paddingBottom: 80,
  },

  titulo: {
    fontWeight: 'bold',
    padding: 30,
    color: '#000',
  },
  tituloHC: { color: '#FFD700' },

  eixoContainer: {
    width: '90%',
    marginBottom: 15,
    alignItems: 'center',
  },

  botaoEixo: {
    backgroundColor: '#6200ee',
    paddingVertical: 15,
    borderRadius: 12,
    marginBottom: 8,
    width: '100%',
    alignItems: 'center',
  },
  botaoEixoAtivo: {
    backgroundColor: '#3700b3',
  },
  botaoEixoHC: {
    backgroundColor: '#222',
    borderColor: '#FFD700',
    borderWidth: 2,
  },
  botaoEixoTexto: {
    color: 'white',
    fontWeight: 'bold',
  },
  botaoEixoTextoHC: {
    color: '#FFD700',
  },

  itemContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#8301d6',
    borderTopLeftRadius: 50,
    borderBottomLeftRadius: 50,
    borderBottomRightRadius: 50,
    padding: 10,
    marginBottom: 12,
    width: '100%',
  },
  itemContainerHC: {
    backgroundColor: '#222',
    borderColor: '#FFD700',
    borderWidth: 2,
  },

  img: {
    height: 80,
    width: 80,
    borderRadius: 40,
    marginRight: 15,
  },

  textContainer: { flex: 1 },

  nome: { fontWeight: 'bold', color: 'white', marginBottom: 5 },
  nomeHC: { color: '#FFD700' },

  funcao: { color: 'white' },
  funcaoHC: { color: '#FFD700' },
});
