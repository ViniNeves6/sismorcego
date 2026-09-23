// src/components/Button/styles.js
import { StyleSheet } from "react-native";

export default StyleSheet.create({
  button: {
    paddingHorizontal: 40,
    height: 50,
    borderWidth: 0,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 0,
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    margin: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 5,
    backgroundColor: "#6200ee", // padrão roxo
  },

  // Alto contraste
  buttonHC: {
    backgroundColor: "#000",
    borderWidth: 2,
    borderColor: "#FFD700",
    shadowColor: "#FFD700", // brilho amarelo no lugar do preto
  },

  text: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "bold",
    textTransform: "uppercase",
  },

  textHC: {
    color: "#FFD700",
  },
  disabled: { opacity: 0.6 },
});
