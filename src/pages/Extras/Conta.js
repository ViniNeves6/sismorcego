// src/pages/Extras/Conta.js
import React, { useState, useEffect } from 'react';
import { View, ScrollView, Alert, Text, DeviceEventEmitter } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Header from '../../components/Header/Header';
import CustomInput from '../../components/Input/CustomInput';
import CustomButton from '../../components/Button/CustomButton';
import Profile from '../../components/Profile/Profile';
import useAuth from '../../hooks/useAuth';
import useAccessibility from '../../hooks/useAccessibility';
import logger from '../../utils/logger';
import styles from './stylesConta';

export default function Conta() {
  const { user, updateUser } = useAuth();
  const { fontScale, highContrast, textToSpeechEnabled, speak } = useAccessibility();

  const [nome, setNome] = useState(user?.displayName || '');
  const [email, setEmail] = useState(user?.email || '');
  const [senha, setSenha] = useState('');
  const [confirmaSenha, setConfirmaSenha] = useState('');
  const [foto, setFoto] = useState(null);

  // ðŸ“Œ Carregar foto local (ou do Firebase, se existir)
  useEffect(() => {
    const carregarFoto = async () => {
      const saved = await AsyncStorage.getItem('profilePhoto');
      if (saved) {
        setFoto(saved);
      } else if (user?.photoURL) {
        setFoto(user.photoURL);
      }
    };
    carregarFoto();
  }, [user]);

  // ðŸ“Œ Salvar foto local sempre que mudar
  useEffect(() => {
    if (foto) {
      AsyncStorage.setItem('profilePhoto', foto);
      DeviceEventEmitter.emit('profilePhoto:changed', foto);
    }
  }, [foto]);

  // Narrador ao abrir tela
  useEffect(() => {
    if (textToSpeechEnabled) {
      speak('Tela de conta. VocÃª pode atualizar suas informaÃ§Ãµes pessoais.');
    }
  }, [textToSpeechEnabled, speak]);

  const salvar = async () => {
    if (senha && senha !== confirmaSenha) {
      Alert.alert('Erro', 'As senhas nÃ£o conferem');
      if (textToSpeechEnabled) speak('Erro. As senhas nÃ£o conferem.');
      return;
    }
    try {
      // ðŸ”¥ Atualiza no Firebase
      await updateUser({ nome, email, senha });

      // ðŸ”¥ Foto fica apenas local
      if (foto) {
        await AsyncStorage.setItem('profilePhoto', foto);
        DeviceEventEmitter.emit('profilePhoto:changed', foto);
      }

      Alert.alert('Sucesso', 'Dados atualizados!');
      if (textToSpeechEnabled) speak('Seus dados foram atualizados com sucesso.');
    } catch (e) {
      Alert.alert('Erro', e.message || 'NÃ£o foi possÃ­vel atualizar');
      logger.error('Conta: erro ao atualizar', e);
      if (textToSpeechEnabled) speak(`Erro. ${e.message}`);
    }
  };

  return (
    <View style={[styles.page, highContrast && styles.pageHC]}>
      <Header profilePhoto={foto} />

      <ScrollView
        style={styles.container}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        <Text
          style={[
            styles.titulo,
            { fontSize: 22 * fontScale },
            highContrast && styles.tituloHC,
          ]}
        >
          Conta
        </Text>

        {/* Foto com botÃµes jÃ¡ embutidos */}
        <Profile
          image={foto}
          onChange={setFoto}
          defaultImage={require('../../assets/images/default-profile.png')}
        />

        <CustomInput label="Nome de UsuÃ¡rio" value={nome} onChangeText={setNome} />
        <CustomInput label="E-mail" value={email} onChangeText={setEmail} keyboardType="email-address" />
        <CustomInput label="Nova Senha" value={senha} onChangeText={setSenha} secureTextEntry />
        <CustomInput label="Confirmar Senha" value={confirmaSenha} onChangeText={setConfirmaSenha} secureTextEntry />

        <CustomButton title="ATUALIZAR" onPress={salvar} />
      </ScrollView>
    </View>
  );
}

