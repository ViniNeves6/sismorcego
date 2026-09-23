// src/components/Profile/Profile.js
import React from 'react';
import { View, Image, Text, TouchableOpacity } from 'react-native';
import { launchCamera, launchImageLibrary } from 'react-native-image-picker';
import styles from './styles';

export default function Profile({ image, onChange, defaultImage }) {
  const handleSelect = (from) => {
    const picker = from === 'camera' ? launchCamera : launchImageLibrary;
    picker(
      { mediaType: 'photo', quality: 0.7, includeBase64: true }, // 👈 agora com base64
      (res) => {
        if (res?.assets?.[0]?.base64) {
          const base64Uri = `data:image/jpeg;base64,${res.assets[0].base64}`;
          onChange(base64Uri); // 👈 já manda em base64
        }
      }
    );
  };

  return (
    <View style={styles.container}>
      <Image
        source={image ? { uri: image } : defaultImage}
        style={styles.avatar}
      />
      <View style={styles.actions}>
        <TouchableOpacity style={styles.button} onPress={() => handleSelect('gallery')}>
          <Text style={styles.buttonText}>Galeria</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.button} onPress={() => handleSelect('camera')}>
          <Text style={styles.buttonText}>Câmera</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
