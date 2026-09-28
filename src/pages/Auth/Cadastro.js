// src/pages/Auth/Cadastro.js
import React, { useRef, useState } from "react";
import { View } from "react-native";
import { Button, TextField, useToast } from "../../ui";
import AuthLayout from "./AuthLayout";
import useAuth from "../../hooks/useAuth";
import { useTheme } from "../../theme/ThemeProvider";
import logger from "../../utils/logger";

const EMAIL_RE = /\S+@\S+\.\S+/;
// Mínimo 6 caracteres, com ao menos uma letra e um número (símbolos permitidos).
const PASSWORD_RE = /^(?=.*[A-Za-z])(?=.*\d).{6,}$/;

const signUpErrorMessage = (code) => {
  switch (code) {
    case "auth/email-already-in-use":
      return "Este e-mail já está cadastrado.";
    case "auth/weak-password":
      return "A senha deve ter no mínimo 6 caracteres.";
    case "auth/invalid-email":
      return "E-mail inválido.";
    default:
      return "Não foi possível criar a conta. Verifique sua conexão e tente novamente.";
  }
};

export default function Cadastro({ navigation }) {
  const { signUp } = useAuth();
  const toast = useToast();
  const { spacing } = useTheme();
  const passwordRef = useRef(null);
  const confirmRef = useRef(null);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);

  const validate = () => {
    const next = {};
    if (!email.trim()) next.email = "Digite seu e-mail.";
    else if (!EMAIL_RE.test(email)) next.email = "Digite um e-mail válido.";

    if (!password) next.password = "Crie uma senha.";
    else if (!PASSWORD_RE.test(password)) next.password = "Use ao menos 6 caracteres, com letras e números.";

    if (!confirmPassword) next.confirmPassword = "Repita a senha.";
    else if (password !== confirmPassword) next.confirmPassword = "As senhas não conferem.";

    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSignUp = async () => {
    if (loading || !validate()) return;

    try {
      setLoading(true);
      await signUp(email.trim(), password);
      toast.show("Conta criada. Agora você pode entrar.", { tone: "success" });
      navigation.navigate("Login");
    } catch (error) {
      logger.error("Cadastro: falha ao cadastrar", error);
      toast.show(signUpErrorMessage(error?.code), { tone: "danger" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout
      title="Criar conta"
      subtitle="Use um e-mail que você acessa. A senha precisa de letras e números."
      onBack={() => navigation.goBack()}
    >
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
          placeholder="Mínimo de 6 caracteres"
          leadingIcon="lock"
          secureTextEntry
          autoCapitalize="none"
          autoComplete="new-password"
          textContentType="newPassword"
          returnKeyType="next"
          onSubmitEditing={() => confirmRef.current?.focus()}
        />

        <TextField
          ref={confirmRef}
          label="Confirmar senha"
          value={confirmPassword}
          onChangeText={setConfirmPassword}
          error={errors.confirmPassword}
          placeholder="Repita a senha"
          leadingIcon="lock"
          secureTextEntry
          autoCapitalize="none"
          autoComplete="new-password"
          textContentType="newPassword"
          returnKeyType="go"
          onSubmitEditing={handleSignUp}
        />
      </View>

      <View style={{ gap: spacing.sm }}>
        <Button title="Criar conta" onPress={handleSignUp} loading={loading} />
        <Button title="Já tenho conta" variant="ghost" onPress={() => navigation.navigate("Login")} />
      </View>
    </AuthLayout>
  );
}
