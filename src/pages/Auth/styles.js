// src/pages/Auth/styles.js
import { StyleSheet } from "react-native";

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    padding: 20,
    justifyContent: "center",
    alignItems: "stretch", // Inputs e botões ocupam 100%
  },
  logoContainer: {
    alignItems: "center",
    marginBottom: 30,
    width: "100%",
  },
  logo: {
    width: 180,
    height: 180,
  },
  title: {
    fontSize: 26,
    fontWeight: "bold",
    marginBottom: 20,
    textAlign: "center",
    width: "100%",
  },
  loginButton: {
    marginTop: 20,
    marginBottom: 15,
    width: "100%",
    maxWidth: 300, // deixa responsivo
    alignSelf: "center",
  },
  forgotPassword: {
    marginTop: 10,
    marginBottom: 15,
    alignItems: "center",
  },
  createButton: {
    marginTop: 10,
    marginBottom: 20,
    width: "100%",
    maxWidth: 300,
    alignSelf: "center",
  },
  createButtonText: {
    fontSize: 16,
    fontWeight: "bold",
  },
  version: {
    textAlign: "right",
    color: "#666",
    marginTop: 10,
    width: "100%",
  },
});

export default styles;
