// src/pages/Extras/Creditos.js
import React, { useCallback, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { ScrollScreen, ScreenHeader, AccordionItem, Avatar, Text } from '../../ui';
import { useTheme } from '../../theme/ThemeProvider';
import useAccessibility from '../../hooks/useAccessibility';
import useSpeakOnMount from '../../hooks/useSpeakOnMount';

const CREDITOS_POR_EIXO = {
  Tecnologia: [
    { nome: 'Pedro Dimas', funcao: 'Bolsista', imagem: require('../../assets/images/pedro.png') },
    { nome: 'André Vinicius', funcao: 'Bolsista', imagem: require('../../assets/images/andre.png') },
    { nome: 'Paulo Pontes', funcao: 'Orientador', imagem: require('../../assets/images/paulo.png') },
    { nome: 'Marcos Seruffo', funcao: 'Orientador', imagem: require('../../assets/images/seruffo.png') },
  ],
  'Tradução do Conhecimento': [],
  'Campo/Laboratório': [],
  'Determinantes sociais': [],
};

const EIXOS = Object.keys(CREDITOS_POR_EIXO);

export default function Creditos({ navigation }) {
  const { spacing } = useTheme();
  const { textToSpeechEnabled, speak } = useAccessibility();
  useSpeakOnMount('Tela de Créditos. Toque em um eixo para ver os participantes.');

  const [abertos, setAbertos] = useState({});

  const toggleEixo = useCallback(
    (eixo) => {
      const opening = !abertos[eixo];
      setAbertos((prev) => ({ ...prev, [eixo]: opening }));

      if (textToSpeechEnabled) {
        speak(
          opening
            ? `Eixo ${eixo} expandido. ${CREDITOS_POR_EIXO[eixo].length} participantes exibidos.`
            : `Eixo ${eixo} recolhido.`
        );
      }
    },
    [abertos, speak, textToSpeechEnabled]
  );

  return (
    <ScrollScreen header={<ScreenHeader title="Créditos" onBack={() => navigation.goBack()} />}>
      <View style={{ gap: spacing.md }}>
        {EIXOS.map((eixo) => {
          const pessoas = CREDITOS_POR_EIXO[eixo];
          return (
            <AccordionItem
              key={eixo}
              title={eixo}
              subtitle={pessoas.length === 0 ? 'Sem participantes informados' : `${pessoas.length} participantes`}
              expanded={Boolean(abertos[eixo])}
              onToggle={() => toggleEixo(eixo)}
            >
              {pessoas.length === 0 ? (
                <Text variant="body" tone="muted">
                  Os participantes deste eixo ainda não foram informados.
                </Text>
              ) : null}
              {pessoas.map((pessoa) => (
                <View key={pessoa.nome} accessible accessibilityLabel={`${pessoa.nome}, ${pessoa.funcao}`} style={[styles.person, { gap: spacing.md }]}>
                  <Avatar source={pessoa.imagem} name={pessoa.nome} size={48} />
                  <View style={styles.personText}>
                    <Text variant="bodyStrong">{pessoa.nome}</Text>
                    <Text variant="caption" tone="muted">
                      {pessoa.funcao}
                    </Text>
                  </View>
                </View>
              ))}
            </AccordionItem>
          );
        })}
      </View>
    </ScrollScreen>
  );
}

const styles = StyleSheet.create({
  person: { flexDirection: 'row', alignItems: 'center' },
  personText: { flex: 1, gap: 2 },
});
