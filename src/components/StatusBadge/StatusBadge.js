// src/components/StatusBadge/StatusBadge.js (corrigido)
import React from 'react';
import { View, Text } from 'react-native';
import { useTheme } from '../../hooks/useTheme'; // Corrigido: usar nosso hook personalizado
import styles from './styles';

const StatusBadge = ({ status = '@SISMORCEGO', variant = 'default' }) => {
  const { colors } = useTheme(); // Agora retorna diretamente { colors }

  const getVariantStyle = () => {
    switch (variant) {
      case 'success':
        return { backgroundColor: colors.success };
      case 'warning':
        return { backgroundColor: colors.warning };
      case 'error':
        return { backgroundColor: colors.error };
      default:
        return { backgroundColor: colors.primary };
    }
  };

  return (
    <View style={[styles.badge, getVariantStyle()]}>
      <Text style={styles.text}>{status}</Text>
    </View>
  );
};

export default StatusBadge;