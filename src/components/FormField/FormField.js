// src/components/FormField/FormField.js
import React, { useContext } from 'react';
import { View, Text, TextInput } from 'react-native';
import styles from './styles';
import { AccessibilityContext } from '../../hooks/useAccessibility'; // garante fonte escalável e contraste

export default function FormField({
  label,
  value,
  onChangeText,
  placeholder,
  error,
  keyboardType = 'default',
  editable = true,
  secureTextEntry = false,
  multiline = false,
  ...rest
}) {
  const { highContrast, fontScale } = useContext(AccessibilityContext);

  const dynamicLabel = {
    color: highContrast ? '#FFD700' : '#333',
    fontSize: 14 * fontScale,
    marginBottom: 4,
  };

  const dynamicInput = {
    backgroundColor: highContrast ? '#000' : '#FFF',
    color: highContrast ? '#FFD700' : '#000',
    borderColor: highContrast ? '#FFD700' : '#CCC',
    borderWidth: 1,
    borderRadius: 8,
    padding: 10,
    fontSize: 16 * fontScale,
    minHeight: multiline ? 80 : 45,
  };

  const dynamicError = {
    color: highContrast ? '#FF6961' : '#B00020',
    fontSize: 12 * fontScale,
    marginTop: 4,
  };

  return (
    <View style={styles.container}>
      {label ? <Text style={[styles.label, dynamicLabel]}>{label}</Text> : null}

      <TextInput
        style={[styles.input, dynamicInput]}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={highContrast ? '#FFD70099' : '#999'}
        keyboardType={keyboardType}
        editable={editable}
        secureTextEntry={secureTextEntry}
        multiline={multiline}
        {...rest}
      />

      {error ? <Text style={[styles.error, dynamicError]}>{error}</Text> : null}
    </View>
  );
}
