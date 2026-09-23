// src/navigation/AppTabs.js
import React from 'react';
import { Image, StyleSheet } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context'; // ✅
import useAccessibility from '../hooks/useAccessibility';

import NovoRegistro from '../pages/Main/NovoRegistro';
import Buscar from '../pages/Main/Buscar';

// Extras
import Conta from '../pages/Extras/Conta';
import Configuracoes from '../pages/Extras/Configuracoes';
import Sobre from '../pages/Extras/Sobre';
import Duvidas from '../pages/Extras/Duvidas';
import Creditos from '../pages/Extras/Creditos';

const Tab = createBottomTabNavigator();

function TabIcon({ source, focused, highContrast }) {
  return (
    <Image
      source={source}
      style={[
        styles.icon,
        focused
          ? (highContrast ? styles.iconFocusedHC : styles.iconFocused)
          : (highContrast ? styles.iconUnfocusedHC : styles.iconUnfocused),
      ]}
    />
  );
}

const tabIcons = {
  Buscar: require('../assets/images/Pesquisar.png'),
  NovoRegistro: require('../assets/images/Inserir.png'),
};

const BuscarIcon = ({ focused }) => {
  const { highContrast } = useAccessibility();
  return <TabIcon source={tabIcons.Buscar} focused={focused} highContrast={highContrast} />;
};

const NovoRegistroIcon = ({ focused }) => {
  const { highContrast } = useAccessibility();
  return <TabIcon source={tabIcons.NovoRegistro} focused={focused} highContrast={highContrast} />;
};

export default function AppTabs() {
  const { highContrast } = useAccessibility();
  const insets = useSafeAreaInsets(); // ✅ pega as safe areas (top/bottom/notch)

  return (
    <Tab.Navigator
      initialRouteName="NovoRegistro"
      screenOptions={{
        headerShown: false,
        tabBarHideOnKeyboard: true,
        tabBarStyle: [
          styles.tabBar,
          {
            paddingBottom: insets.bottom, // ✅ agora respeita a área segura inferior
            height: 64 + insets.bottom,   // garante espaço extra
          },
          highContrast && { backgroundColor: '#000', borderTopColor: '#FFD700' },
        ],
        tabBarShowLabel: false,
        sceneContainerStyle: { backgroundColor: highContrast ? '#000' : '#FFF3E0' },
        safeAreaInsets: { bottom: 0 }, // 👈 evita duplicar padding no Android/iOS
      }}
    >
      {/* Extras ocultos */}
      <Tab.Screen name="Conta" component={Conta} options={{ tabBarButton: () => null }} />

      <Tab.Screen
        name="Buscar"
        component={Buscar}
        options={{
          tabBarItemStyle: styles.tabItemHalf,
          tabBarIcon: BuscarIcon,
        }}
      />

      <Tab.Screen
        name="Configurações"
        component={Configuracoes}
        options={{ tabBarItemStyle: styles.tabItemZero, tabBarButton: () => null }}
      />
      <Tab.Screen name="Sobre" component={Sobre} options={{ tabBarButton: () => null }} />
      <Tab.Screen name="Dúvidas" component={Duvidas} options={{ tabBarButton: () => null }} />

      <Tab.Screen
        name="NovoRegistro"
        component={NovoRegistro}
        options={{ tabBarIcon: NovoRegistroIcon }}
      />

      <Tab.Screen name="Créditos" component={Creditos} options={{ tabBarButton: () => null }} />
    </Tab.Navigator>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    backgroundColor: '#300355',
    borderTopColor: '#6407b2',
    borderTopWidth: 2,
    height: 60,
  },
  icon: {
    width: 70,
    height: 70,
    marginTop: 20,
  },
  iconFocused: { tintColor: '#FFF' },
  iconUnfocused: { tintColor: '#CCC' },
  iconFocusedHC: { tintColor: '#FFD700' },
  iconUnfocusedHC: { tintColor: '#AAAAAA' },

  tabItemHalf: { flex: 0.5 },
  tabItemZero: { flex: 0 },
});