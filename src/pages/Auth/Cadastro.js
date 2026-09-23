// src/pages/Auth/Cadastro.js
import React, { useState } from "react";
import { View, Text, ScrollView, Alert, Image } from "react-native";
import CustomInput from "../../components/Input/CustomInput";
import CustomButton from "../../components/Button/CustomButton";
import TextButton from "../../components/TextButton/TextButton";
import styles from "./styles";
import useAuth from "../../hooks/useAuth";
import logger from "../../utils/logger";

const Cadastro = ({ navigation }) => {
  const { signUp } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const validateEmail = (value) => /\S+@\S+\.\S+/.test(value);
  const validatePassword = (value) => /^(?=.*[A-Za-z])(?=.*\d)[A-Za-z\d]{6,}$/.test(value);

  const handleSignUp = async () => {
    if (loading) return;

    if (!email || !password || !confirmPassword) {
      Alert.alert("AtenÃ§Ã£o", "Preencha todos os campos.");
      return;
    }
    if (!validateEmail(email)) {
      Alert.alert("Erro", "Digite um e-mail vÃ¡lido.");
      return;
    }
    if (!validatePassword(password)) {
      Alert.alert("Erro", "A senha deve ter no mÃ­nimo 6 caracteres e conter letras e nÃºmeros.");
      return;
    }
    if (password !== confirmPassword) {
      Alert.alert("Erro", "As senhas nÃ£o conferem.");
      return;
    }

    try {
      setLoading(true);
      await signUp(email.trim(), password);

      Alert.alert("Conta criada", "Agora vocÃª pode fazer login.");
      navigation.navigate("Login");
    } catch (error) {
      logger.error("Cadastro: falha ao cadastrar", error);
      let mensagem = "NÃ£o foi possÃ­vel criar a conta.";
      if (error?.code === "auth/email-already-in-use") mensagem = "Este e-mail jÃ¡ estÃ¡ cadastrado.";
      else if (error?.code === "auth/weak-password") mensagem = "A senha deve ter no mÃ­nimo 6 caracteres.";
      else if (error?.code === "auth/invalid-email") mensagem = "E-mail invÃ¡lido.";
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

      <Text style={styles.title}>CRIAR CONTA</Text>

      <CustomInput
        label="Email"
        value={email}
        onChangeText={setEmail}
        placeholder="seuemail@gmail.com"
        keyboardType="email-address"
        autoCapitalize="none"
        autoComplete="email"
        textContentType="emailAddress"
      />

      <CustomInput
        label="Senha"
        value={password}
        onChangeText={setPassword}
        placeholder="Digite sua senha"
        secureTextEntry
      />

      <CustomInput
        label="Confirmar Senha"
        value={confirmPassword}
        onChangeText={setConfirmPassword}
        placeholder="Repita sua senha"
        secureTextEntry
      />

      <CustomButton
        title={loading ? "Cadastrando..." : "CADASTRAR"}
        onPress={handleSignUp}
        loading={loading}
        disabled={loading}
        style={styles.loginButton}
      />

      <TextButton
        title="JÃ¡ tem conta? Entrar"
        onPress={() => navigation.navigate("Login")}
        style={styles.forgotPassword}
      />
    </ScrollView>
  );
};

export default Cadastro;
