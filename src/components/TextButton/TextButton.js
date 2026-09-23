// textButton.js
import React from "react";
import { TouchableOpacity, Text } from "react-native";
import styles from "./styles";

export default function TextButton({ title, onPress }) {
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.6}>
      <Text style={styles.text}>{title}</Text>
    </TouchableOpacity>
  );
}
