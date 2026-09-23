// src/pages/Extras/Duvidas.js
import React, { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  Text,
  TouchableOpacity,
  LayoutAnimation,
  Platform,
  UIManager,
  TextInput,
  Alert,
} from 'react-native';
import Header from '../../components/Header/Header';
import useAccessibility from '../../hooks/useAccessibility';
import logger from '../../utils/logger';

// Firebase
import { db, auth } from '../../services/firebase';
import {
  collection,
  addDoc,
  getDocs,
  getDocsFromServer,
  query,
  orderBy,
  serverTimestamp,
} from 'firebase/firestore';

// Ativar animacao no Android
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

export default function Duvidas() {
  const [expandedId, setExpandedId] = useState(null);
  const [duvidas, setDuvidas] = useState([]);
  const [novaDuvida, setNovaDuvida] = useState('');
  const [adicionando, setAdicionando] = useState(false);

  const { fontScale, highContrast, textToSpeechEnabled, speak } = useAccessibility();

  useEffect(() => {
    if (textToSpeechEnabled) {
      speak('Tela de duvidas. Voce pode visualizar duvidas ou adicionar uma nova.');
    }
    carregarDuvidas();
  }, [textToSpeechEnabled, speak]);

  // Buscar duvidas do Firestore
  const carregarDuvidas = async () => {
    if (!db) {
      setDuvidas([]);
      Alert.alert('Aviso', 'Servico de duvidas indisponivel no momento.');
      return;
    }

    try {
      let snap;
      try {
        const q = query(collection(db, 'duvidas'), orderBy('createdAt', 'desc'));
        snap = await getDocsFromServer(q);
      } catch {
        // fallback para documentos sem createdAt/index
        snap = await getDocsFromServer(collection(db, 'duvidas'));
      }

      const lista = snap.docs
        .map((doc) => ({ id: doc.id, ...doc.data() }))
        .map((item) => ({
          ...item,
          titulo: item.titulo || item.pergunta || item.duvida || 'Sem titulo',
          resposta: item.resposta || item.respostaTexto || item.answer || 'Sem resposta ainda.',
          _key: `duvidas:${item.id}`,
        }))
        .filter((item) => Boolean(item.titulo))
        .sort((a, b) => {
          const aSec = a?.createdAt?.seconds || 0;
          const bSec = b?.createdAt?.seconds || 0;
          return bSec - aSec;
        });

      setDuvidas(lista);
    } catch (err) {
      logger.error('Duvidas: erro', err);
      if (err?.code === 'permission-denied') {
        try {
          const snapCache = await getDocs(collection(db, 'duvidas'));
          const listaCache = snapCache.docs
            .map((doc) => ({ id: doc.id, ...doc.data() }))
            .map((item) => ({
              ...item,
              titulo: item.titulo || item.pergunta || item.duvida || 'Sem titulo',
              resposta: item.resposta || item.respostaTexto || item.answer || 'Sem resposta ainda.',
              _key: `duvidas:${item.id}`,
            }));
          setDuvidas(listaCache);
          if (listaCache.length > 0) return;
        } catch (cacheErr) {
          logger.error('Duvidas: cache fallback erro', cacheErr);
        }
        Alert.alert('Erro', 'Sem permissao para ler as duvidas no Firestore.');
        return;
      }
      Alert.alert('Erro', 'Nao foi possivel carregar as duvidas.');
    }
  };

  const toggleExpand = (id, titulo, resposta) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpandedId(expandedId === id ? null : id);

    if (textToSpeechEnabled) {
      speak(`Duvida: ${titulo}. Resposta: ${resposta}`);
    }
  };

  // Adicionar duvida no Firestore
  const adicionarDuvida = async () => {
    if (!novaDuvida.trim()) return;

    if (!db) {
      Alert.alert('Erro', 'Servico de duvidas indisponivel no momento.');
      return;
    }

    try {
      const user = auth?.currentUser;
      await addDoc(collection(db, 'duvidas'), {
        titulo: novaDuvida,
        resposta: 'Duvida registrada, resposta em breve.',
        userId: user?.uid || 'anon',
        createdAt: serverTimestamp(),
      });

      setNovaDuvida('');
      setAdicionando(false);
      carregarDuvidas();

      if (textToSpeechEnabled) {
        speak('Sua duvida foi adicionada com sucesso.');
      }
    } catch (err) {
      logger.error('Duvidas: erro', err);
      if (err?.code === 'permission-denied') {
        Alert.alert('Erro', 'Sem permissao para salvar duvidas no Firestore.');
        return;
      }
      Alert.alert('Erro', 'Nao foi possivel salvar sua duvida.');
    }
  };

  return (
    <View style={[styles.container, highContrast && styles.containerHC]}>
      <Header />
      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={styles.Formulario}>
          <Text
            style={[
              styles.Titulo,
              { fontSize: 24 * fontScale },
              highContrast && styles.textoHC,
            ]}
          >
            Duvidas
          </Text>

          {!adicionando ? (
            <TouchableOpacity
              style={[styles.BotaoAdd, highContrast && styles.BotaoHC]}
              onPress={() => setAdicionando(true)}
            >
              <Text style={[styles.BtnTexto, highContrast && styles.textoHC]}>
                + Adicionar Duvida
              </Text>
            </TouchableOpacity>
          ) : (
            <View style={styles.FormAdd}>
              <TextInput
                style={[
                  styles.InputArea,
                  { fontSize: 14 * fontScale },
                  highContrast && styles.InputAreaHC,
                ]}
                placeholder="Digite sua duvida"
                placeholderTextColor={highContrast ? '#FFD700' : '#666'}
                multiline
                value={novaDuvida}
                onChangeText={setNovaDuvida}
              />

              <View style={styles.ButtonRow}>
                <TouchableOpacity
                  style={[styles.BotaoForm, styles.btnSuccess]}
                  onPress={adicionarDuvida}
                >
                  <Text style={styles.BtnTexto}>Enviar</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.BotaoForm, styles.btnDanger]}
                  onPress={() => setAdicionando(false)}
                >
                  <Text style={styles.BtnTexto}>Cancelar</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {duvidas.map((duvida) => (
            <View key={duvida._key || duvida.id}>
              <TouchableOpacity
                style={[styles.Botao, highContrast && styles.BotaoHC]}
                onPress={() =>
                  toggleExpand(
                    duvida._key || duvida.id,
                    duvida.titulo || 'Sem titulo',
                    duvida.resposta || 'Sem resposta ainda.'
                  )
                }
              >
                <View style={styles.BtnArea}>
                  <Text
                    style={[
                      styles.BtnTexto,
                      { fontSize: 18 * fontScale },
                      highContrast && styles.textoHC,
                    ]}
                  >
                    {duvida.titulo || 'Sem titulo'}
                  </Text>
                </View>
              </TouchableOpacity>
              {expandedId === (duvida._key || duvida.id) && (
                <View style={[styles.Resposta, highContrast && styles.RespostaHC]}>
                  <Text
                    style={[
                      styles.RespostaTexto,
                      { fontSize: 16 * fontScale },
                      highContrast && styles.textoHC,
                    ]}
                  >
                    {duvida.resposta || 'Sem resposta ainda.'}
                  </Text>
                </View>
              )}
            </View>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  containerHC: { backgroundColor: '#000' },

  Formulario: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-start',
    marginBottom: 100,
  },
  Titulo: {
    fontWeight: 'bold',
    padding: 30,
    color: 'black',
  },
  textoHC: { color: '#FFD700' },

  Botao: {
    width: 350,
    height: 60,
    borderWidth: 1,
    borderTopLeftRadius: 20,
    borderBottomRightRadius: 20,
    backgroundColor: '#8301d6',
    marginTop: 15,
  },
  BotaoAdd: {
    width: 350,
    height: 60,
    borderWidth: 1,
    borderRadius: 12,
    backgroundColor: '#5E3B8E',
    marginBottom: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  BotaoHC: {
    backgroundColor: '#222',
    borderColor: '#FFD700',
    borderWidth: 2,
  },
  BtnArea: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'flex-start',
    alignItems: 'center',
    marginLeft: 15,
  },
  BtnTexto: { fontWeight: 'bold', color: 'white' },

  Resposta: {
    backgroundColor: '#e4d7f7',
    padding: 10,
    marginBottom: 8,
    marginTop: -12,
    borderBottomLeftRadius: 10,
    borderBottomRightRadius: 10,
    width: 350,
  },
  RespostaHC: {
    backgroundColor: '#111',
    borderColor: '#FFD700',
    borderWidth: 1,
  },
  RespostaTexto: { color: 'black' },

  FormAdd: { width: 350, marginBottom: 20 },
  InputArea: {
    borderWidth: 1,
    borderColor: '#C4C4C4',
    borderRadius: 12,
    padding: 12,
    backgroundColor: '#FFF',
    marginBottom: 10,
    height: 80,
    textAlignVertical: 'top',
  },
  InputAreaHC: {
    backgroundColor: '#000',
    borderColor: '#FFD700',
    color: '#FFD700',
  },
  ButtonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: 350,
  },
  BotaoForm: {
    height: 50,
    width: '48%',
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  btnSuccess: { backgroundColor: '#5cb85c' },
  btnDanger: { backgroundColor: '#d9534f' },
});
