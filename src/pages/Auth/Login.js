// src/pages/Auth/Login.js
import React, { useState } from "react";
import { View, Text, ScrollView, Alert, Image } from "react-native";
import CustomInput from "../../components/Input/CustomInput";
import CustomButton from "../../components/Button/CustomButton";
import TextButton from "../../components/TextButton/TextButton";
import styles from "./styles";
import useAuth from "../../hooks/useAuth";
import logger from "../../utils/logger";

const Login = ({ navigation }) => {
  const { signIn } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const validateEmail = (value) => /\S+@\S+\.\S+/.test(value);

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert("Atenção", "Preencha todos os campos.");
      return;
    }
    if (!validateEmail(email)) {
      Alert.alert("Erro", "Digite um e-mail válido.");
      return;
    }

    try {
      setLoading(true);
      await signIn(email.trim(), password);
      // ✅ Não precisa navegar manualmente.
      // O RootNavigation muda sozinho quando "user" vira não-null.
    } catch (error) {
      logger.error("Login: falha no login", error);
      let mensagem = "Não foi possível fazer login.";
      if (error?.code === "auth/user-not-found") mensagem = "Usuário não encontrado.";
      else if (error?.code === "auth/wrong-password") mensagem = "Senha incorreta.";
      else if (error?.code === "auth/invalid-email") mensagem = "E-mail inválido.";
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

      <Text style={styles.title}>LOGIN</Text>

      <CustomInput
        label="Email"
        value={email}
        onChangeText={setEmail}
        placeholder="seuemail@gmail.com"
        keyboardType="email-address"
        autoCapitalize="none"
      />

      <CustomInput
        label="Senha"
        value={password}
        onChangeText={setPassword}
        placeholder="Digite sua senha"
        secureTextEntry
        showPasswordToggle
      />

      <CustomButton
        title={loading ? "Entrando..." : "ENTRAR"}
        onPress={handleLogin}
        loading={loading}
        disabled={loading}
        style={styles.loginButton}
      />

      <TextButton
        title="Esqueci minha senha"
        onPress={() => navigation.navigate("EsqueciSenha")}
        style={styles.forgotPassword}
      />

      <TextButton
        title="Não tem conta? Criar agora"
        onPress={() => navigation.navigate("Cadastro")}
        style={styles.forgotPassword}
      />
    </ScrollView>
  );
};

export default Login;
