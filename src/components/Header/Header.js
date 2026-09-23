import React, { useEffect, useState } from 'react';
import { Image, TouchableOpacity, Text, StyleSheet, DeviceEventEmitter } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import styles from './styles';
import useAccessibility from '../../hooks/useAccessibility';
import logger from '../../utils/logger';

export default function Header({ profilePhoto = null }) {
  const navigation = useNavigation();
  const { fontScale, highContrast, textToSpeechEnabled, speak } = useAccessibility();

  const [localPhoto, setLocalPhoto] = useState(null);

  // Carrega foto local
  useEffect(() => {
    AsyncStorage.getItem('profilePhoto').then((saved) => {
      if (saved) setLocalPhoto(saved);
    });
  }, []);

  // Reage a atualizacao de foto emitida pela tela de Conta
  useEffect(() => {
    const sub = DeviceEventEmitter.addListener('profilePhoto:changed', (nextPhoto) => {
      setLocalPhoto(nextPhoto || null);
    });
    return () => sub.remove();
  }, []);

  // Narrador automatico do Header
  useEffect(() => {
    if (textToSpeechEnabled) {
      speak('Cabecalho. Voce esta no aplicativo Sismorcego.');
    }
  }, [textToSpeechEnabled, speak]);

  const openDrawerSafely = () => {
    try {
      if (typeof navigation.openDrawer === 'function') {
        navigation.openDrawer();
        return;
      }

      let parent = navigation.getParent ? navigation.getParent() : null;
      while (parent) {
        if (typeof parent.openDrawer === 'function') {
          parent.openDrawer();
          return;
        }
        if (typeof parent.getParent !== 'function') break;
        parent = parent.getParent();
      }

      logger.warn('Header: drawer indisponivel');
    } catch (err) {
      logger.error('Header: erro', err);
    }
  };

  const effectivePhoto = profilePhoto || localPhoto;

  return (
    <SafeAreaView
      edges={['top', 'left', 'right']}
      style={[styles.container, highContrast && localStyles.containerHC]}
    >
      <Image
        source={require('../../assets/images/Logomarca.png')}
        style={[
          styles.logo,
          { tintColor: highContrast ? '#FFD700' : undefined },
        ]}
        resizeMode="contain"
      />

      <Text
        style={[
          styles.title,
          { fontSize: 20 * fontScale },
          highContrast && localStyles.titleHC,
        ]}
      >
        SISMORCEGO
      </Text>

      <TouchableOpacity
        onPress={openDrawerSafely}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        activeOpacity={0.7}
      >
        <Image
          source={
            effectivePhoto
              ? { uri: effectivePhoto }
              : require('../../assets/images/default-profile.png')
          }
          style={styles.profile}
        />
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const localStyles = StyleSheet.create({
  containerHC: {
    backgroundColor: '#000',
    borderBottomColor: '#FFD700',
    borderBottomWidth: 2,
  },
  titleHC: { color: '#FFD700' },
});
