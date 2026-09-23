// App.js
import React, { useEffect } from "react";
import { AuthProvider } from "./src/hooks/useAuth";
import { AccessibilityProvider } from "./src/hooks/useAccessibility";
import RootNavigation from "./src/navigation";
import { initDB } from "./src/database/db";
import { SafeAreaProvider } from "react-native-safe-area-context"; // ✅

export default function App() {
  useEffect(() => {
    initDB();
  }, []);

  return (
    <SafeAreaProvider>
      <AuthProvider>
        <AccessibilityProvider>
          <RootNavigation />
        </AccessibilityProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
}
