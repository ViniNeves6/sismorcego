// src/pages/Auth/EsqueciSenha.js
import React, { useState } from "react";
import { View } from "react-native";
import { Button, TextField, useToast } from "../../ui";
import AuthLayout from "./AuthLayout";
import useAuth from "../../hooks/useAuth";
import { useTheme } from "../../theme/ThemeProvider";
import logger from "../../utils/logger";

const EMAIL_RE = /\S+@\S+\.\S+/;

const resetErrorMessage = (code) => {
  switch (code) {
    case "auth/user-not-found":
      return "Este e-mail não está cadastrado.";
    case "auth/invalid-email":
      return "Formato de e-mail inválido.";
    default:
      return "Não foi possível enviar o e-mail. Verifique sua conexão e tente novamente.";
  }
};

export default function EsqueciSenha({ navigation }) {
  const { resetPassword } = useAuth();
  const toast = useToast();
  const { spacing } = useTheme();

  const [email, setEmail] = useState("");
  const [error, setError] = useState();
  const [loading, setLoading] = useState(false);

  const handleReset = async () => {
    if (loading) return;

    if (!email.trim()) return setError("Digite o e-mail da sua conta.");
    if (!EMAIL_RE.test(email)) return setError("Digite um e-mail válido.");
    setError(undefined);

    try {
      setLoading(true);
      await resetPassword(email.trim());
      toast.show("Enviamos um link para redefinir sua senha.", { tone: "success" });
      navigation.navigate("Login");
    } catch (err) {
      logger.error("EsqueciSenha: falha ao solicitar reset", err);
      toast.show(resetErrorMessage(err?.code), { tone: "danger" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout
      title="Redefinir senha"
      subtitle="Informe o e-mail da conta. Enviaremos um link para criar uma nova senha."
      onBack={() => navigation.goBack()}
    >
      <TextField
        label="E-mail"
        value={email}
        onChangeText={setEmail}
        error={error}
        placeholder="nome@email.com"
        leadingIcon="mail"
        keyboardType="email-address"
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="email"
        textContentType="emailAddress"
        returnKeyType="send"
        onSubmitEditing={handleReset}
      />

      <View style={{ gap: spacing.sm }}>
        <Button title="Enviar link" onPress={handleReset} loading={loading} />
        <Button title="Voltar para o login" variant="ghost" onPress={() => navigation.navigate("Login")} />
      </View>
    </AuthLayout>
  );
}
