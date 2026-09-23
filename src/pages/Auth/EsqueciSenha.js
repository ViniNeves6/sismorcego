// src/pages/Auth/EsqueciSenha.js
import React, { useState } from "react";
import {
  View,
  Text,
  ScrollView,
  Alert,
  Image,
  ActivityIndicator,
  StyleSheet,
} from "react-native";
import CustomInput from "../../components/Input/CustomInput";
import CustomButton from "../../components/Button/CustomButton";
import TextButton from "../../components/TextButton/TextButton";
import styles from "./styles";
import useAuth from "../../hooks/useAuth";
import logger from "../../utils/logger";

const EsqueciSenha = ({ navigation }) => {
  const { resetPassword } = useAuth();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);

  const validateEmail = (value) => /\S+@\S+\.\S+/.test(value);

  const handleReset = async () => {
    if (!email) {
      Alert.alert("AtenÃ§Ã£o", "Digite o email para redefinir a senha.");
      return;
    }
    if (!validateEmail(email)) {
      Alert.alert("Erro", "Digite um e-mail vÃ¡lido.");
      return;
    }

    try {
      setLoading(true);
      await resetPassword(email.trim());
      Alert.alert("Sucesso", "Um link para redefinir sua senha foi enviado para o seu e-mail.");
      navigation.navigate("Login");
    } catch (error) {
      logger.error("EsqueciSenha: falha ao solicitar reset", error);
      let mensagem = "NÃ£o foi possÃ­vel enviar o e-mail.";
      if (error?.code === "auth/user-not-found") mensagem = "Este e-mail nÃ£o estÃ¡ cadastrado.";
      else if (error?.code === "auth/invalid-email") mensagem = "Formato de e-mail invÃ¡lido.";
      Alert.alert("Erro", mensagem);
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.logoContainer}>
        <Image
          source={require("../../assets/images/Logo.png")}
          style={styles.logo}
          resizeMode="contain"
        />
      </View>

      <Text style={styles.title}>RECUPERAR SENHA</Text>

      <CustomInput
        label="Email"
        value={email}
        onChangeText={setEmail}
        placeholder="seuemail@gmail.com"
        keyboardType="email-address"
        autoCapitalize="none"
      />

      <CustomButton
        title={loading ? "Enviando..." : "ENVIAR"}
        onPress={handleReset}
        loading={loading}
        disabled={loading}
        style={styles.loginButton}
      />

      {loading && (
        <View style={localStyles.loadingContainer}>
          <ActivityIndicator size="large" />
          <Text style={localStyles.loadingText}>Processando solicitaÃ§Ã£o...</Text>
        </View>
      )}

      <TextButton
        title="Voltar para Login"
        onPress={() => navigation.navigate("Login")}
        style={styles.forgotPassword}
      />
    </ScrollView>
  );
};

const localStyles = StyleSheet.create({
  loadingContainer: { marginTop: 10 },
  loadingText: { textAlign: "center", marginTop: 5 },
});

export default EsqueciSenha;
