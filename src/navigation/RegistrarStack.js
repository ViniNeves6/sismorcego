// src/navigation/RegistrarStack.js
// Aba "Registrar": tela comum (data/município/tipo) + uma tela por tipo
// de vítima. Ver docs/superpowers/specs/2026-09-28-registro-por-tipo-vitima-design.md
import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import NovoRegistro from '../pages/Main/NovoRegistro';
import RegistroHumano from '../pages/Main/registro/RegistroHumano';
import RegistroCaninoFelino from '../pages/Main/registro/RegistroCaninoFelino';
import RegistroAves from '../pages/Main/registro/RegistroAves';
import RegistroProducao from '../pages/Main/registro/RegistroProducao';
import { useTheme } from '../theme/ThemeProvider';

const Stack = createNativeStackNavigator();

export default function RegistrarStack() {
  const { colors } = useTheme();

  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.canvas },
        animation: 'slide_from_right',
      }}
    >
      <Stack.Screen name="NovoRegistro" component={NovoRegistro} />
      <Stack.Screen name="RegistroHumano" component={RegistroHumano} />
      <Stack.Screen name="RegistroCaninoFelino" component={RegistroCaninoFelino} />
      <Stack.Screen name="RegistroAves" component={RegistroAves} />
      <Stack.Screen name="RegistroProducao" component={RegistroProducao} />
    </Stack.Navigator>
  );
}
