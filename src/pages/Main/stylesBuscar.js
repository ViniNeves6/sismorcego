// src/pages/Main/stylesBuscar.js
import { StyleSheet } from "react-native";

export default StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#f9f9f9",
  },
  screenHC: {
    backgroundColor: "#000", // fundo preto
  },

  container: {
    flex: 1,
    padding: 16,
  },

  pageTitle: {
    fontSize: 22,
    fontWeight: "bold",
    textAlign: "center",
    marginVertical: 20,
    color: "#1A1A1A",
  },
  pageTitleHC: {
    color: "#FFD700", // amarelo no contraste alto
  },

  card: {
    backgroundColor: "#fff",
    padding: 16,
    borderRadius: 10,
    marginBottom: 12,
    elevation: 2,
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 4,
  },
  cardHC: {
    backgroundColor: "#222",
    borderColor: "#FFD700",
    borderWidth: 2,
  },

  title: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#333",
  },
  titleHC: {
    color: "#FFD700",
  },

  subtitle: {
    fontSize: 14,
    color: "#666",
    marginTop: 4,
  },
  subtitleHC: {
    color: "#FFD700",
  },

  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  centeredText: {
    fontSize: 16,
    color: "#333",
  },
  centeredTextHC: {
    color: "#FFD700",
  },
});
