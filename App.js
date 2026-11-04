// App.js
import React, { useEffect } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, UIManager } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider } from './src/hooks/useAuth';
import { AccessibilityProvider } from './src/hooks/useAccessibility';
import { ThemeProvider } from './src/theme/ThemeProvider';
import { ToastProvider } from './src/ui';
import RootNavigation from './src/navigation';
import { initDB } from './src/database/db';
import useKeyboardVisible from './src/hooks/useKeyboardVisible';

if (Platform.OS === 'android' && !global.nativeFabricUIManager && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

export default function App() {
  const keyboardVisible = useKeyboardVisible();
  useEffect(() => {
    initDB();
  }, []);

  return (
    <SafeAreaProvider>
      <KeyboardAvoidingView testID="app-keyboard-viewport" style={styles.fill}
        behavior="padding" enabled={Platform.OS === 'ios' || keyboardVisible}>
        <AuthProvider>
          <AccessibilityProvider>
            <ThemeProvider>
              <ToastProvider>
                <RootNavigation />
              </ToastProvider>
            </ThemeProvider>
          </AccessibilityProvider>
        </AuthProvider>
      </KeyboardAvoidingView>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({ fill: { flex: 1 } });
