import React from 'react';
import { Text } from 'react-native-web';
import glyphs from '../../node_modules/react-native-vector-icons/glyphmaps/Feather.json';

export default function Feather({ name, size = 24, color = '#000', style, ...rest }) {
  return (
    <Text
      {...rest}
      selectable={false}
      style={[{ fontFamily: 'Feather', fontSize: size, color, fontWeight: 'normal', fontStyle: 'normal', lineHeight: size }, style]}
    >
      {String.fromCharCode(glyphs[name] ?? 0x2b1c)}
    </Text>
  );
}
