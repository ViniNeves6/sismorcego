// src/navigation/AppTabs.js
// Quatro destinos com rótulo sempre visível. Ícones vetoriais (Feather).
import React from 'react';
import { StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import NovoRegistro from '../pages/Main/NovoRegistro';
import Buscar from '../pages/Main/Buscar';
import Conta from '../pages/Extras/Conta';
import MoreStack from './MoreStack';
import { Icon } from '../ui';
import { useTheme } from '../theme/ThemeProvider';

const Tab = createBottomTabNavigator();

const tabIcon = (name) => ({ color }) => <Icon name={name} size={24} color={color} />;

export default function AppTabs() {
  const { colors, type } = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <Tab.Navigator
      initialRouteName="Registrar"
      screenOptions={{
        headerShown: false,
        tabBarHideOnKeyboard: true,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.inkMuted,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.line,
          borderTopWidth: StyleSheet.hairlineWidth,
          // Altura explícita: ícone + rótulo cabem sem encolher (o rótulo era cortado).
          height: 60 + insets.bottom,
          paddingTop: 6,
          paddingBottom: insets.bottom,
        },
        // lineHeight explícito: o rótulo não é cortado e não cresce demais com texto ampliado.
        tabBarLabelStyle: { fontSize: Math.min(type.caption.fontSize - 1, 14), lineHeight: 16, fontWeight: '600' },
        sceneStyle: { backgroundColor: colors.canvas },
      }}
    >
      <Tab.Screen name="Registrar" component={NovoRegistro} options={{ tabBarIcon: tabIcon('plus-circle') }} />
      <Tab.Screen name="Buscar" component={Buscar} options={{ tabBarIcon: tabIcon('search') }} />
      <Tab.Screen name="Conta" component={Conta} options={{ tabBarIcon: tabIcon('user') }} />
      <Tab.Screen name="Mais" component={MoreStack} options={{ tabBarIcon: tabIcon('menu') }} />
    </Tab.Navigator>
  );
}
