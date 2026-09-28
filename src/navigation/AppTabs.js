// src/navigation/AppTabs.js
// Quatro destinos com rótulo sempre visível. Ícones vetoriais (Feather).
import React from 'react';
import { StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import RegistrarStack from './RegistrarStack';
import Buscar from '../pages/Main/Buscar';
import Notificacoes from '../pages/Main/Notificacoes';
import Painel from '../pages/Main/Painel';
import Conta from '../pages/Extras/Conta';
import MoreStack from './MoreStack';
import { Icon } from '../ui';
import { useTheme } from '../theme/ThemeProvider';
import useAuth from '../hooks/useAuth';
import useCoordenadorNotifications from '../hooks/useCoordenadorNotifications';

const Tab = createBottomTabNavigator();

const tabIcon = (name) => ({ color }) => <Icon name={name} size={24} color={color} />;

export default function AppTabs() {
  const { colors, type } = useTheme();
  const insets = useSafeAreaInsets();
  const { role } = useAuth();
  const { naoLidas } = useCoordenadorNotifications();
  const isCoordenador = role === 'coordenador';

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
      <Tab.Screen name="Registrar" component={RegistrarStack} options={{ tabBarIcon: tabIcon('plus-circle') }} />
      <Tab.Screen name="Buscar" component={Buscar} options={{ tabBarIcon: tabIcon('search') }} />
      {isCoordenador ? (
        <Tab.Screen
          name="Notificacoes"
          component={Notificacoes}
          options={{
            title: 'Notificações',
            tabBarIcon: tabIcon('bell'),
            tabBarBadge: naoLidas > 0 ? naoLidas : undefined,
          }}
        />
      ) : null}
      {isCoordenador ? (
        <Tab.Screen name="Painel" component={Painel} options={{ tabBarIcon: tabIcon('bar-chart-2') }} />
      ) : null}
      <Tab.Screen name="Conta" component={Conta} options={{ tabBarIcon: tabIcon('user') }} />
      <Tab.Screen name="Mais" component={MoreStack} options={{ tabBarIcon: tabIcon('menu') }} />
    </Tab.Navigator>
  );
}
