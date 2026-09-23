// src/navigation/CustomDrawerContent.js
import React from "react";
import {
  DrawerContentScrollView,
  DrawerItemList,
  DrawerItem,
} from "@react-navigation/drawer";
import { View, Text, StyleSheet } from "react-native";
import useAuth from "../hooks/useAuth";
import logger from "../utils/logger";

/**
 * Drawer customizado ajustado para modo de teste sem autenticação.
 * - Mantém estrutura original.
 * - Desativa o botão "Sair" quando o login está desabilitado.
 * - Evita erro mesmo que o hook retorne dados incompletos.
 */

export default function CustomDrawerContent(props) {
  // ✅ Chamar o hook UMA única vez e sempre no topo (sem condicional)
  const auth = useAuth();
  const user = auth?.user ?? null;
  const signOut = auth?.signOut;

  const isOfflineMode = !user || !user.email; // detecta modo sem login

  return (
    <DrawerContentScrollView {...props}>
      {/* Cabeçalho do Drawer */}
      <View style={styles.header}>
        <Text style={styles.title}>
          {isOfflineMode ? "Modo de Teste" : user.email}
        </Text>
      </View>

      {/* Lista padrão de itens */}
      <DrawerItemList {...props} />

      {/* Botão de Sair (oculto em modo de teste) */}
      {!isOfflineMode && !!signOut && (
        <DrawerItem
          label="Sair"
          onPress={async () => {
            try {
              await signOut();
              props.navigation.reset({
                index: 0,
                routes: [{ name: "AuthStack" }],
              });
            } catch (error) {
              logger.error("CustomDrawerContent: erro", error);
            }
          }}
        />
      )}
    </DrawerContentScrollView>
  );
}

const styles = StyleSheet.create({
  header: {
    padding: 16,
    borderBottomWidth: 1,
    borderColor: "#ccc",
  },
  title: {
    fontWeight: "bold",
    fontSize: 16,
  },
});
