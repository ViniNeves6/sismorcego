import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import Login from '../pages/Auth/Login';
import Cadastro from '../pages/Auth/Cadastro';
import EsqueciSenha from '../pages/Auth/EsqueciSenha';

const Stack = createNativeStackNavigator();

export default function AuthStack() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,   // 🔹 remove o cabeçalho para todas as telas desse stack
      }}
    >
      <Stack.Screen name="Login" component={Login} />
      <Stack.Screen name="Cadastro" component={Cadastro} />
      <Stack.Screen name="EsqueciSenha" component={EsqueciSenha} />
    </Stack.Navigator>
  );
}
