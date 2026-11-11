import React from 'react';
import { View } from 'react-native-web';

const angleOf = (start, end) => {
  if (!start || !end) return 180;
  const dx = (end.x ?? 0) - (start.x ?? 0), dy = (end.y ?? 1) - (start.y ?? 0);
  return Math.round((Math.atan2(dx, -dy) * 180) / Math.PI);
};
export default function LinearGradient({ colors = [], locations, start, end, style, children, ...rest }) {
  const stops = colors.map((c, i) => (locations?.[i] != null ? `${c} ${locations[i] * 100}%` : c)).join(', ');
  return <View {...rest} style={[style, { backgroundImage: `linear-gradient(${angleOf(start, end)}deg, ${stops})` }]}>{children}</View>;
}
