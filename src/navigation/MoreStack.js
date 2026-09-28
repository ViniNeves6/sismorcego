// src/navigation/MoreStack.js
// Aba "Mais": menu + telas secundárias (substitui o antigo drawer).
import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import Mais from '../pages/Extras/Mais';
import Configuracoes from '../pages/Extras/Configuracoes';
import Sobre from '../pages/Extras/Sobre';
import Duvidas from '../pages/Extras/Duvidas';
import Creditos from '../pages/Extras/Creditos';
import { useTheme } from '../theme/ThemeProvider';

const Stack = createNativeStackNavigator();

export default function MoreStack() {
  const { colors } = useTheme();

  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.canvas },
        animation: 'slide_from_right',
      }}
    >
      <Stack.Screen name="MaisInicio" component={Mais} />
      <Stack.Screen name="Configuracoes" component={Configuracoes} />
      <Stack.Screen name="Duvidas" component={Duvidas} />
      <Stack.Screen name="Sobre" component={Sobre} />
      <Stack.Screen name="Creditos" component={Creditos} />
    </Stack.Navigator>
  );
}
