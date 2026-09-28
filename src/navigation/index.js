// src/navigation/index.js
import React, { useMemo } from "react";
import { View, Image, StatusBar, StyleSheet } from "react-native";
import { NavigationContainer } from "@react-navigation/native";
import AppTabs from "./AppTabs";
import AuthStack from "./AuthStack";
import useAuth from "../hooks/useAuth";
import { useTheme, makeNavigationTheme } from "../theme/ThemeProvider";

// Enquanto o Firebase restaura a sessão: marca sobre o violeta da identidade.
function Splash({ color, tint }) {
  return (
    <View style={[styles.splash, { backgroundColor: color }]}>
      <Image
        source={require("../assets/images/Logomarca.png")}
        style={[styles.splashMark, { tintColor: tint }]}
        resizeMode="contain"
        accessibilityLabel="Sismorcego"
      />
    </View>
  );
}

export default function RootNavigation() {
  const { user, loading } = useAuth();
  const theme = useTheme();
  const navTheme = useMemo(() => makeNavigationTheme(theme), [theme]);

  if (loading) return <Splash color={theme.colors.brandDeep} tint={theme.colors.onBrand} />;

  return (
    <NavigationContainer theme={navTheme}>
      {user ? (
        <>
          <StatusBar barStyle={theme.colors.statusBar} backgroundColor="transparent" translucent />
          <AppTabs />
        </>
      ) : (
        <AuthStack />
      )}
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  splash: { flex: 1, alignItems: "center", justifyContent: "center" },
  splashMark: { width: 120, height: 95 },
});
