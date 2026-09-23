// src/navigation/AppDrawer.js
import React, { useEffect } from 'react';
import { createDrawerNavigator } from '@react-navigation/drawer';
import { SafeAreaView } from 'react-native-safe-area-context';
import { DrawerContentScrollView, DrawerItem } from '@react-navigation/drawer';
import { View, StyleSheet } from 'react-native';
import AppTabs from './AppTabs';
import useAuth from '../hooks/useAuth';
import useAccessibility from '../hooks/useAccessibility';
import logger from '../utils/logger';

const Drawer = createDrawerNavigator();

// ✅ Componente definido FORA do AppDrawer (topo do arquivo)
function CustomDrawerContent(props) {
  const auth = useAuth?.();
  const user = auth?.user ?? null;
  const signOut = auth?.signOut;
  const { highContrast, fontScale, textToSpeechEnabled, speak } = useAccessibility();

  useEffect(() => {
    if (textToSpeechEnabled) {
      speak('Menu lateral aberto. Escolha uma opção de navegação.');
    }
  }, [textToSpeechEnabled, speak]);

  const labelStyle = [
    styles.itemLabel,
    highContrast && styles.itemLabelHC,
    { fontSize: 16 * fontScale },
  ];

  const go = (screen) => {
    // Navega para a rota "Início" (AppTabs) e seleciona a aba/tela interna
    props.navigation.navigate('Início', { screen });
  };

  const showLogout = !!user && typeof signOut === 'function';

  const handleSignOut = () => {
    try {
      if (showLogout) signOut();
    } catch (e) {
      // Evita crash em modo de teste sem auth
      logger.error('AppDrawer: erro', e);
    }
  };

  return (
    <SafeAreaView
      style={[styles.safeArea, highContrast && styles.safeAreaHC]}
      edges={['top', 'bottom']}
    >
      <DrawerContentScrollView {...props} contentContainerStyle={styles.scrollView}>
        <DrawerItem
          label="Início"
          onPress={() => go('NovoRegistro')}
          labelStyle={labelStyle}
          accessibilityLabel="Ir para Início"
        />
        <DrawerItem
          label="Conta"
          onPress={() => go('Conta')}
          labelStyle={labelStyle}
          accessibilityLabel="Ir para Conta"
        />
        <DrawerItem
          label="Configurações"
          onPress={() => go('Configurações')}
          labelStyle={labelStyle}
          accessibilityLabel="Ir para Configurações"
        />
        <DrawerItem
          label="Sobre"
          onPress={() => go('Sobre')}
          labelStyle={labelStyle}
          accessibilityLabel="Ir para Sobre"
        />
        <DrawerItem
          label="Dúvidas"
          onPress={() => go('Dúvidas')}
          labelStyle={labelStyle}
          accessibilityLabel="Ir para Dúvidas"
        />
        <DrawerItem
          label="Créditos"
          onPress={() => go('Créditos')}
          labelStyle={labelStyle}
          accessibilityLabel="Ir para Créditos"
        />

        <View style={styles.footer}>
          {showLogout && (
            <DrawerItem
              label="Sair"
              labelStyle={[
                styles.logoutLabel,
                highContrast && styles.logoutLabelHC,
                { fontSize: 16 * fontScale },
              ]}
              onPress={handleSignOut}
              accessibilityLabel="Encerrar sessão"
            />
          )}
        </View>
      </DrawerContentScrollView>
    </SafeAreaView>
  );
}

export default function AppDrawer() {
  const { highContrast } = useAccessibility();

  return (
    <Drawer.Navigator
      screenOptions={{
        headerShown: false,
        drawerPosition: 'right',
        // drawerStyle deve receber um objeto, não array
        drawerStyle: highContrast ? styles.drawerHC : styles.drawer,
      }}
      // ✅ Passa a referência direta do componente (sem arrow inline)
      drawerContent={CustomDrawerContent}
    >
      <Drawer.Screen name="Início" component={AppTabs} />
    </Drawer.Navigator>
  );
}

const styles = StyleSheet.create({
  scrollView: { flex: 1 },
  footer: {
    marginTop: 'auto',
    borderTopWidth: 1,
    borderTopColor: '#ccc',
  },
  logoutLabel: { color: 'red', fontWeight: 'bold' },
  logoutLabelHC: { color: '#FFD700' },
  itemLabel: { color: '#222' },
  itemLabelHC: { color: '#FFD700' },

  drawer: {},
  drawerHC: {
    backgroundColor: '#000',
    borderColor: '#FFD700',
    borderWidth: 2,
  },
  safeArea: { flex: 1 },
  safeAreaHC: { backgroundColor: '#000' },
});
