// src/pages/Auth/Cadastro.js
import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { Animated, BackHandler, Easing, Keyboard, View } from "react-native";
import { Avatar, Button, Text, TextField, useToast } from "../../ui";
import AuthLayout from "./AuthLayout";
import useAuth from "../../hooks/useAuth";
import { useTheme } from "../../theme/ThemeProvider";
import logger from "../../utils/logger";
import { validateRegistration } from '../../services/accountProfile';
import { pickRegistroPhoto } from '../../services/deviceCapture';
import useReduceMotion from '../../ui/useReduceMotion';

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
  const reduceMotion = useReduceMotion();
  const scrollRef = useRef(null);
  const submittingRef = useRef(false);
  const pickingRef = useRef(false);
  const transitionRef = useRef(false);
  const progress = useRef(new Animated.Value(1)).current;
  const passwordRef = useRef(null);
  const confirmRef = useRef(null);

  const [step, setStep] = useState('credentials');
  const [transition, setTransition] = useState(null);
  const [email, setEmail] = useState("");
  const [name, setName] = useState('');
  const [photoUri, setPhotoUri] = useState(null);
  const [pickingPhoto, setPickingPhoto] = useState(false);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);

  useLayoutEffect(() => {
    if (!transition) return;
    let active = true;
    const finish = () => {
      transitionRef.current = false;
      setTransition(null);
    };
    if (reduceMotion) {
      setStep(transition.target);
      scrollRef.current?.scrollTo({ y: 0, animated: false });
      progress.setValue(1);
      finish();
      return;
    }
    const exiting = transition.phase === 'exit';
    if (!exiting) scrollRef.current?.scrollTo({ y: 0, animated: false });
    const animation = Animated.timing(progress, {
      toValue: exiting ? 0 : 1,
      duration: exiting ? 80 : 140,
      easing: Easing.out(Easing.ease),
      useNativeDriver: true,
    });
    animation.start(({ finished }) => {
      if (!active) return;
      if (!finished) { progress.setValue(1); finish(); return; }
      if (exiting) {
        setStep(transition.target);
        setTransition({ ...transition, phase: 'enter' });
      } else finish();
    });
    return () => { active = false; animation.stop(); };
  }, [transition, reduceMotion, progress]);

  const changeStep = useCallback(target => {
    if (submittingRef.current || pickingRef.current || transitionRef.current || target === step) return;
    Keyboard.dismiss();
    transitionRef.current = true;
    setTransition({ target, phase: 'exit' });
  }, [step]);
  const handleBack = useCallback(() => {
    if (submittingRef.current || pickingRef.current || transitionRef.current) return;
    if (step === 'profile') changeStep('credentials');
    else navigation.goBack();
  }, [step, changeStep, navigation]);

  useEffect(() => {
    if (step !== 'profile' && !transition) return;
    const listener = BackHandler.addEventListener('hardwareBackPress', () => {
      handleBack();
      return true;
    });
    return () => listener.remove();
  }, [step, transition, handleBack]);

  const handleContinue = () => {
    if (transitionRef.current) return;
    const next = validateRegistration({ name, email, password, confirmPassword });
    delete next.name;
    setErrors(next);
    if (!Object.keys(next).length) changeStep('profile');
  };

  const validate = () => {
    const next = validateRegistration({ name, email, password, confirmPassword });

    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSignUp = async () => {
    if (step !== 'profile' || submittingRef.current || pickingRef.current || transitionRef.current || !validate()) return;

    try {
      submittingRef.current = true;
      setLoading(true);
      await signUp(email.trim(), password, { name: name.trim(), photoUri });
      // O Firebase já autentica a nova conta; a raiz abre o app automaticamente.
      toast.show("Conta criada com sucesso.", { tone: "success" });
    } catch (error) {
      logger.error("Cadastro: falha ao cadastrar", error);
      toast.show(error?.code === 'auth/profile-incomplete' ? error.message : signUpErrorMessage(error?.code), { tone: "danger" });
    } finally {
      submittingRef.current = false;
      setLoading(false);
    }
  };

  const selectPhoto = async source => {
    if (pickingRef.current || submittingRef.current || transitionRef.current) return;
    pickingRef.current = true;
    setPickingPhoto(true);
    try {
      const photo = await pickRegistroPhoto(source);
      if (photo) setPhotoUri(photo.localUri || photo.uri);
    } catch (error) { toast.show(error.message, { tone: 'danger' }); }
    finally { pickingRef.current = false; setPickingPhoto(false); }
  };

  return (
    <AuthLayout
      title="Criar conta"
      subtitle={step === 'credentials'
        ? 'Use um e-mail que você acessa. A senha precisa de letras e números.'
        : 'Escolha uma foto, se quiser, e informe seu nome de usuário.'}
      onBack={handleBack}
      scrollRef={scrollRef}
    >
      <Animated.View testID="registration-step" pointerEvents={transition ? 'none' : 'auto'}
        style={{ gap: spacing.lg, opacity: progress, transform: [{ translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [6, 0] }) }] }}>
      {step === 'profile' ? <>
        <View style={{ gap: spacing.lg, alignItems: 'center' }}>
          <Text variant="label">Foto de perfil (opcional)</Text>
          <Avatar name={name} uri={photoUri} size={144} />
          <View style={{ flexDirection: 'row', gap: spacing.sm, width: '100%' }}>
            <Button title="Câmera" icon="camera" variant="secondary" style={{ flex: 1 }} disabled={pickingPhoto || loading} onPress={() => selectPhoto('camera')} />
            <Button title="Galeria" icon="image" variant="secondary" style={{ flex: 1 }} disabled={pickingPhoto || loading} onPress={() => selectPhoto('gallery')} />
          </View>
          {photoUri && <Button title="Remover foto" variant="ghost" disabled={pickingPhoto || loading} onPress={() => setPhotoUri(null)} />}
        </View>
        <TextField label="Nome de usuário" value={name} onChangeText={setName} error={errors.name}
          leadingIcon="user" autoCapitalize="words" autoComplete="name" textContentType="name" maxLength={80}
          editable={!loading} returnKeyType="go" onSubmitEditing={handleSignUp} />
        <View style={{ gap: spacing.sm }}>
          <Button title="Criar conta" onPress={handleSignUp} loading={loading} disabled={pickingPhoto} />
          <Button title="Voltar" variant="ghost" disabled={pickingPhoto || loading} onPress={handleBack} />
        </View>
      </> : <>
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
          onSubmitEditing={handleContinue}
        />
        <View style={{ gap: spacing.sm }}>
          <Button title="Continuar" onPress={handleContinue} />
          <Button title="Já tenho conta" variant="ghost" onPress={() => navigation.navigate("Login")} />
        </View>
      </>}
      </Animated.View>
    </AuthLayout>
  );
}
