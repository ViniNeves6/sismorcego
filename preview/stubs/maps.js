import React from 'react';
import { View, Text } from 'react-native-web';

export default function MapView({ style }) {
  return (
    <View
      style={[
        style,
        { backgroundColor: '#dfe8d8', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', backgroundImage: 'linear-gradient(90deg,#ffffff55 1px,transparent 1px),linear-gradient(#ffffff55 1px,transparent 1px)', backgroundSize: '28px 28px' },
      ]}
    >
      <Text style={{ fontSize: 28 }}>📍</Text>
      <Text style={{ fontSize: 12, color: '#3b4a37' }}>Mapa (prévia)</Text>
    </View>
  );
}
export const Marker = () => null;
