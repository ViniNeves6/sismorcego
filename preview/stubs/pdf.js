import React from 'react';
import { View, Text } from 'react-native-web';

export default function Pdf({ style }) {
  return (
    <View style={[style, { alignItems: 'center', justifyContent: 'center', gap: 8 }]}>
      <Text style={{ fontSize: 56 }}>📄</Text>
      <Text style={{ fontSize: 15, color: '#666' }}>Visualizador de PDF (prévia)</Text>
    </View>
  );
}
