// src/components/Input/CustomInput.js
import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity } from 'react-native';
import useAccessibility from '../../hooks/useAccessibility';
import styles from './styles';

export default function CustomInput({
  label,
  value,
  onChangeText,
  secureTextEntry,
  showPasswordToggle = false,
  ...props
}) {
  const { fontScale, highContrast } = useAccessibility();
  const [showPassword, setShowPassword] = useState(false);
  const withToggle = Boolean(secureTextEntry && showPasswordToggle);
  const shouldMask = Boolean(secureTextEntry && !showPassword);

  return (
    <View style={styles.container}>
      {/* Rótulo opcional */}
      {label ? (
        <Text
          style={[
            styles.label,
            { fontSize: 14 * fontScale },
            highContrast && styles.labelHC,
          ]}
        >
          {label}
        </Text>
      ) : null}

      {/* Campo de texto */}
      <View style={styles.inputWrapper}>
        <TextInput
          style={[
            styles.input,
            withToggle && styles.inputWithToggle,
            { fontSize: 16 * fontScale },
            highContrast && styles.inputHC,
          ]}
          placeholderTextColor={highContrast ? '#FFD700' : '#888'}
          value={value}
          onChangeText={onChangeText}
          secureTextEntry={shouldMask}
          autoCapitalize="none"
          autoCorrect={false}
          {...props}
        />

        {withToggle ? (
          <TouchableOpacity
            style={styles.toggleButton}
            onPress={() => setShowPassword((prev) => !prev)}
            accessibilityRole="button"
            accessibilityLabel={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
          >
            <Text style={[styles.toggleText, highContrast && styles.toggleTextHC]}>
              {showPassword ? 'Ocultar' : 'Mostrar'}
            </Text>
          </TouchableOpacity>
        ) : null}
      </View>
    </View>
  );
}
