// src/components/Button/CustomButton.js
import React from "react";
import { TouchableOpacity, Text } from "react-native";
import useAccessibility from "../../hooks/useAccessibility";
import styles from "./styles";

export default function CustomButton({ title, onPress, style, disabled }) {
  const { fontScale, highContrast } = useAccessibility();

  return (
    <TouchableOpacity
      style={[
        styles.button,
        highContrast && styles.buttonHC,
        disabled && styles.disabled,
        style,
      ]}
      onPress={onPress}
      activeOpacity={0.8}
      accessibilityRole="button"
      accessibilityLabel={title}
      disabled={disabled}
    >
      <Text
        style={[
          styles.text,
          { fontSize: 16 * fontScale },
          highContrast && styles.textHC,
        ]}
      >
        {title}
      </Text>
    </TouchableOpacity>
  );
}
