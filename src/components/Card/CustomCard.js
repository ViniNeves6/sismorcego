// src/components/Card/CustomCard.js (corrigido)
import React from 'react';
import { View, Text } from 'react-native';
import { useTheme } from '../../hooks/useTheme'; // Corrigido: usar nosso hook personalizado
import styles from './styles';

const CustomCard = ({ title, children, style, titleStyle }) => {
  const { colors } = useTheme(); // Agora retorna diretamente { colors, theme }

  return (
    <View style={[styles.card, { backgroundColor: colors.card }, style]}>
      {title && (
        <Text style={[styles.title, { color: colors.text }, titleStyle]}>
          {title}
        </Text>
      )}
      <View style={styles.content}>
        {children}
      </View>
    </View>
  );
};

export default CustomCard;