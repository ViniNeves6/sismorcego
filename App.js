// App.js
import React, { useEffect } from "react";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { AuthProvider } from "./src/hooks/useAuth";
import { AccessibilityProvider } from "./src/hooks/useAccessibility";
import { ThemeProvider } from "./src/theme/ThemeProvider";
import { ToastProvider } from "./src/ui";
import RootNavigation from "./src/navigation";
import { initDB } from "./src/database/db";

export default function App() {
  useEffect(() => {
    initDB();
  }, []);

  return (
    <SafeAreaProvider>
      <AuthProvider>
        <AccessibilityProvider>
          <ThemeProvider>
            <ToastProvider>
              <RootNavigation />
            </ToastProvider>
          </ThemeProvider>
        </AccessibilityProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
}
