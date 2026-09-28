// src/ui/Avatar.js
import React, { useState } from 'react';
import { View, Image, StyleSheet } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';
import Text from './Text';

function initialsOf(name = '') {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '?';
  return (parts[0][0] + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase();
}

// `uri` (remota/arquivo) ou `source` (require local).
export default function Avatar({ uri, source, name, size = 56, style }) {
  const { colors } = useTheme();
  const [failed, setFailed] = useState(false);
  const box = { width: size, height: size, borderRadius: size / 2 };

  const imageSource = source ?? (uri ? { uri } : null);

  if (imageSource && !failed) {
    return (
      <Image
        source={imageSource}
        onError={() => setFailed(true)}
        accessibilityLabel={name ? `Foto de ${name}` : 'Foto de perfil'}
        style={[box, { backgroundColor: colors.surfaceMuted }, style]}
      />
    );
  }

  return (
    <View
      accessible
      accessibilityLabel={name ? `Iniciais de ${name}` : 'Sem foto de perfil'}
      style={[styles.center, box, { backgroundColor: colors.primarySoft }, style]}
    >
      <Text
        variant="heading"
        style={{ color: colors.onPrimarySoft, fontSize: Math.round(size * 0.36), lineHeight: Math.round(size * 0.44) }}
      >
        {initialsOf(name)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: 'center', justifyContent: 'center' },
});
