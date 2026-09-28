// src/pages/Auth/Login.js
import React, { useRef, useState } from "react";
import { View, StyleSheet } from "react-native";
import { Button, TextField, SwitchRow, Text, useToast } from "../../ui";
import AuthLayout from "./AuthLayout";
import useAuth from "../../hooks/useAuth";
import { useTheme } from "../../theme/ThemeProvider";
import logger from "../../utils/logger";

const EMAIL_RE = /\S+@\S+\.\S+/;

const loginErrorMessage = (code) => {
  switch (code) {
    case "auth/user-not-found":
      return "Usuário não encontrado.";
    case "auth/wrong-password":
      return "Senha incorreta.";
    case "auth/invalid-credential":
      return "E-mail ou senha incorretos.";
    case "auth/invalid-email":
      return "E-mail inválido.";
    case "auth/too-many-requests":
      return "Muitas tentativas. Aguarde um pouco e tente de novo.";
    case "auth/not-admin":
      return "Essa conta não tem acesso de administrador.";
    default:
      return "Não foi possível entrar. Verifique sua conexão e tente novamente.";
  }
};

const styles = StyleSheet.create({
  center: { textAlign: "center" },
});

export default function Login({ navigation }) {
  const { signIn } = useAuth();
  const toast = useToast();
  const { spacing } = useTheme();
  const passwordRef = useRef(null);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loginAsAdmin, setLoginAsAdmin] = useState(false);
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);

  const validate = () => {
    const next = {};
    if (!email.trim()) next.email = "Digite seu e-mail.";
    else if (!EMAIL_RE.test(email)) next.email = "Digite um e-mail válido.";
    if (!password) next.password = "Digite sua senha.";
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleLogin = async () => {
    if (loading || !validate()) return;

    try {
      setLoading(true);
      await signIn(email.trim(), password, { requireAdmin: loginAsAdmin });
      // Sem navegação manual: RootNavigation troca de stack quando "user" existe.
    } catch (error) {
      logger.error("Login: falha no login", error);
      toast.show(loginErrorMessage(error?.code), { tone: "danger" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout title="Entrar" subtitle="Acesse com o e-mail da sua conta.">
      <View style={{ gap: spacing.lg }}>
        <TextField
          label="E-mail"
          value={email}
          onChangeText={setEmail}
          error={errors.email}
          placeholder="nome@email.com"
          leadingIcon="mail"
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="email"
          textContentType="emailAddress"
          returnKeyType="next"
          onSubmitEditing={() => passwordRef.current?.focus()}
        />

        <TextField
          ref={passwordRef}
          label="Senha"
          value={password}
          onChangeText={setPassword}
          error={errors.password}
          placeholder="Digite sua senha"
          leadingIcon="lock"
          secureTextEntry
          autoCapitalize="none"
          autoComplete="current-password"
          textContentType="password"
          returnKeyType="go"
          onSubmitEditing={handleLogin}
        />
      </View>

      <SwitchRow
        icon="shield"
        title="Entrar como administrador"
        subtitle="Acesso de coordenador, com visão de todos os registros."
        value={loginAsAdmin}
        onValueChange={setLoginAsAdmin}
      />

      <View style={{ gap: spacing.sm }}>
        <Button title="Entrar" onPress={handleLogin} loading={loading} />
        <Button
          title="Esqueci minha senha"
          variant="ghost"
          onPress={() => navigation.navigate("EsqueciSenha")}
        />
      </View>

      <View style={{ gap: spacing.sm, marginTop: spacing.sm }}>
        <Text variant="body" tone="muted" style={styles.center}>
          Ainda não tem conta?
        </Text>
        <Button title="Criar conta" variant="secondary" onPress={() => navigation.navigate("Cadastro")} />
      </View>
    </AuthLayout>
  );
}
