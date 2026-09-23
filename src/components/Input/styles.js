// src/components/Input/styles.js
import { StyleSheet } from "react-native";

const styles = StyleSheet.create({
  container: {
    width: "100%",
    marginBottom: 15,
  },
  label: {
    marginBottom: 5,
    fontWeight: "bold",
    color: "#333",
  },
  labelHC: {
    color: "#FFD700",
  },
  input: {
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 8,
    padding: 12,
    color: "#111",
    width: "100%",     // <- garante que ocupa toda a largura
  },
  inputWrapper: {
    position: "relative",
    width: "100%",
  },
  inputWithToggle: {
    paddingRight: 90,
  },
  inputHC: {
    borderColor: "#FFD700",
    color: "#FFD700",
  },
  toggleButton: {
    position: "absolute",
    right: 12,
    top: 0,
    bottom: 0,
    justifyContent: "center",
  },
  toggleText: {
    color: "#5E3B8E",
    fontWeight: "700",
    fontSize: 13,
  },
  toggleTextHC: {
    color: "#FFD700",
  },
});

export default styles;
