// src/navigation/index.js
import React from "react";
import { NavigationContainer, DefaultTheme, DarkTheme } from "@react-navigation/native";
import AppDrawer from "./AppDrawer";
import AuthStack from "./AuthStack";
import useAuth from "../hooks/useAuth";
import useAccessibility from "../hooks/useAccessibility";

export default function RootNavigation() {
  const { user, loading } = useAuth();

  const { highContrast } = useAccessibility();
  const theme = highContrast ? DarkTheme : DefaultTheme;

  if (loading) return null;

  return (
    <NavigationContainer theme={theme}>
      {user ? <AppDrawer /> : <AuthStack />}
    </NavigationContainer>
  );
}