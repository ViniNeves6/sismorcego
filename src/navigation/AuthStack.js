// src/navigation/AuthStack.js
import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import Login from '../pages/Auth/Login';
import Cadastro from '../pages/Auth/Cadastro';
import EsqueciSenha from '../pages/Auth/EsqueciSenha';
import { useTheme } from '../theme/ThemeProvider';

const Stack = createNativeStackNavigator();

export default function AuthStack() {
  const { colors } = useTheme();

  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.canvas },
        animation: 'slide_from_right',
      }}
    >
      <Stack.Screen name="Login" component={Login} />
      <Stack.Screen name="Cadastro" component={Cadastro} />
      <Stack.Screen name="EsqueciSenha" component={EsqueciSenha} />
    </Stack.Navigator>
  );
}
