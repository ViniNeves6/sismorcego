import React from 'react';
import { View } from 'react-native-web';

export default function LinearGradient({ colors = [], start, end, style, children, ...rest }) {
  const angle = start && end ? 135 : 180;
  return (
    <View {...rest} style={[style, { backgroundImage: `linear-gradient(${angle}deg, ${colors.join(', ')})` }]}>
      {children}
    </View>
  );
}
