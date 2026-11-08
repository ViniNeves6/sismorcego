import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, BackHandler, StatusBar, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Pressable, ScrollView, Text, TextInput, View } from '../../ui/AccessibleNative';
import MainScreenHeader from '../../ui/MainScreenHeader';
import AnimatedScreenTransition from '../../ui/AnimatedScreenTransition';
import { ArrowLeftIcon, ChevronRightIcon, EyeIcon, EyeOffIcon, LockIcon, ReporterBadgeIcon } from '../../ui/SismorcegoIcons';
import useAuth from '../../hooks/useAuth';
import useSpeakOnMount from '../../hooks/useSpeakOnMount';
import useAccessibility from '../../hooks/useAccessibility';

const messages = {
  checking: ['Conectando ao Sismorcego', 'Aguarde enquanto o acesso à avaliação é verificado.'],
  expired: ['Período de avaliação encerrado', 'A equipe pode prorrogar o prazo. O acesso será verificado novamente de forma automática.'],
  suspended: ['Avaliação suspensa', 'Aguarde a reativação pela equipe. O acesso será verificado novamente de forma automática.'],
  'not-started': ['Avaliação ainda não iniciada', 'O aplicativo liberará o acesso automaticamente quando o período começar.'],
  offline: ['Conecte-se à internet', 'É necessário verificar o período de avaliação para acessar o aplicativo. Seus registros salvos continuam neste aparelho.'],
  blocked: ['Avaliação indisponível', 'O acesso precisa ser revisado pela equipe. A verificação será repetida automaticamente.'],
  unavailable: ['Não foi possível conectar', 'O acesso à avaliação está temporariamente indisponível. O aplicativo tentará novamente automaticamente.'],
};
const loginCopy = {
  choose: ['Como você vai usar o Sismorcego?', 'Escolha seu perfil para entrar na versão de treinamento.'],
  coordinator: ['Entrar como coordenador', 'Use o e-mail e a senha da coordenação.'],
};
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function loginErrorMessage(code) {
  if (/invalid-credential|wrong-password|user-not-found|invalid-login/.test(code)) return 'E-mail ou senha incorretos.';
  if (/invalid-email/.test(code)) return 'E-mail inválido.';
  if (/too-many-requests/.test(code)) return 'Muitas tentativas. Aguarde um pouco e tente de novo.';
  if (/network|offline|timeout/.test(code)) return 'Sem conexão com a internet. Conecte-se e tente novamente.';
  if (/operation-not-allowed|admin-restricted-operation/.test(code)) return 'O acesso de ACS ainda não foi liberado pela equipe.';
  if (/not-coordinator/.test(code)) return 'Esta conta não tem acesso de coordenador.';
  if (/session-ended/.test(code)) return 'Sua sessão terminou. Entre novamente.';
  if (/user-disabled/.test(code)) return 'Esta conta está desativada.';
  return 'Não foi possível entrar. Tente novamente.';
}

function RoleOption({ title, description, icon, onPress, busy, disabled }) {
  return <Pressable accessibilityRole="button" accessibilityLabel={`${title}. ${description}`}
    accessibilityState={{ disabled, busy }} disabled={disabled} onPress={onPress}
    style={({ pressed }) => [styles.option, pressed && styles.optionPressed, disabled && !busy && styles.optionDisabled]}>
    <View style={styles.optionIcon}>{icon}</View>
    <View style={styles.optionText}>
      <Text style={styles.optionTitle}>{title}</Text>
      <Text style={styles.optionBody}>{description}</Text>
    </View>
    {busy ? <ActivityIndicator color="#6824D6" accessibilityLabel="Entrando" /> : <ChevronRightIcon size={18} />}
  </Pressable>;
}

function ChooseRole({ onAcs, onCoordinator, busy, error }) {
  return <>
    <RoleOption title="Sou ACS" description="Entrar direto para registrar ocorrências." busy={busy}
      disabled={busy} onPress={onAcs} icon={<ReporterBadgeIcon size={22} />} />
    <RoleOption title="Sou coordenador" description="Entrar com e-mail e senha." disabled={busy}
      onPress={onCoordinator} icon={<LockIcon size={20} />} />
    {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
  </>;
}

function CoordinatorForm({ onBack, onSubmit, busy, error }) {
  const passwordRef = useRef(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [focused, setFocused] = useState(null);
  const [fieldErrors, setFieldErrors] = useState({});
  const submit = () => {
    if (busy) return;
    const next = {};
    if (!EMAIL_RE.test(email.trim())) next.email = 'Digite um e-mail válido.';
    if (!password) next.password = 'Digite a senha.';
    setFieldErrors(next);
    if (!Object.keys(next).length) onSubmit(email.trim(), password);
  };
  return <>
    <View>
      <Text style={styles.label}>E-mail</Text>
      <TextInput value={email} onChangeText={value => { setEmail(value); if (fieldErrors.email) setFieldErrors(p => ({ ...p, email: null })); }}
        accessibilityLabel="E-mail" placeholder="nome@email.com" placeholderTextColor="#8A80A0"
        keyboardType="email-address" autoCapitalize="none" autoCorrect={false} autoComplete="email" textContentType="emailAddress"
        returnKeyType="next" blurOnSubmit={false} onSubmitEditing={() => passwordRef.current?.focus()} editable={!busy}
        onFocus={() => setFocused('email')} onBlur={() => setFocused(null)}
        style={[styles.input, focused === 'email' && styles.inputFocused, fieldErrors.email && styles.inputError]} />
      {fieldErrors.email ? <Text style={styles.fieldError}>{fieldErrors.email}</Text> : null}
    </View>
    <View>
      <Text style={styles.label}>Senha</Text>
      <View style={styles.passwordWrap}>
        <TextInput ref={passwordRef} value={password} onChangeText={value => { setPassword(value); if (fieldErrors.password) setFieldErrors(p => ({ ...p, password: null })); }}
          accessibilityLabel="Senha" placeholder="Digite a senha" placeholderTextColor="#8A80A0"
          secureTextEntry={!showPassword} autoCapitalize="none" autoCorrect={false} autoComplete="current-password" textContentType="password"
          returnKeyType="go" onSubmitEditing={submit} editable={!busy}
          onFocus={() => setFocused('password')} onBlur={() => setFocused(null)}
          style={[styles.input, styles.passwordInput, focused === 'password' && styles.inputFocused, fieldErrors.password && styles.inputError]} />
        <Pressable accessibilityRole="button" accessibilityLabel={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
          onPress={() => setShowPassword(value => !value)} style={styles.eye} hitSlop={8}>
          {showPassword ? <EyeOffIcon /> : <EyeIcon />}
        </Pressable>
      </View>
      {fieldErrors.password ? <Text style={styles.fieldError}>{fieldErrors.password}</Text> : null}
    </View>
    {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
    <Pressable accessibilityRole="button" accessibilityLabel="Entrar" accessibilityState={{ busy, disabled: busy }} disabled={busy}
      onPress={submit} style={({ pressed }) => [styles.action, pressed && styles.pressed]}>
      {busy ? <ActivityIndicator color="#FFFFFF" accessibilityLabel="Entrando" /> : <Text style={styles.actionText}>Entrar</Text>}
    </Pressable>
    <Pressable accessibilityRole="button" accessibilityLabel="Voltar para a escolha de perfil" disabled={busy} onPress={onBack}
      style={({ pressed }) => [styles.secondary, pressed && styles.pressed]}>
      <ArrowLeftIcon size={16} />
      <Text style={styles.secondaryText}>Voltar</Text>
    </Pressable>
  </>;
}

// Training access: ACS enters directly (anonymous account per device);
// Coordenador signs in with the coordination e-mail and password. Every other
// status is automatic and only offers a retry or a way back to profile choice.
export default function EvaluationSetupScreen() {
  const { highContrast } = useAccessibility();
  const { evaluation, retrySession, signInAcs, signIn, signOut } = useAuth();
  const [step, setStep] = useState('choose');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const mounted = useRef(true);
  useEffect(() => () => { mounted.current = false; }, []);
  const signedOut = evaluation?.status === 'signed-out';
  const status = signedOut ? 'signed-out' : messages[evaluation?.status] ? evaluation.status : 'unavailable';
  const [title, message] = signedOut ? loginCopy[step] : messages[status];
  const shownError = error || (signedOut && evaluation?.reason ? loginErrorMessage(evaluation.reason) : '');
  useSpeakOnMount(`${title}. ${message}`);

  useEffect(() => {
    if (!signedOut || step !== 'coordinator') return undefined;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => { if (!busy) { setError(''); setStep('choose'); } return true; });
    return () => sub.remove();
  }, [signedOut, step, busy]);

  const run = async action => {
    if (busy) return;
    setBusy(true); setError('');
    try { await action(); }
    catch (e) { if (mounted.current) setError(loginErrorMessage(e?.code || '')); }
    finally { if (mounted.current) setBusy(false); }
  };
  const goTo = next => { if (!busy) { setError(''); setStep(next); } };

  return <SafeAreaView style={[styles.fill, highContrast && styles.contrast]} edges={['top', 'bottom', 'left', 'right']}>
    <StatusBar barStyle={highContrast ? 'light-content' : 'dark-content'} backgroundColor={highContrast ? '#08080C' : '#FFFFFF'} />
    <MainScreenHeader title="Sismorcego" subtitle="Versão de treinamento" />
    <AnimatedScreenTransition screenKey={signedOut ? `login:${step}` : status}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.card}>
          <Text accessibilityRole="header" style={styles.title}>{title}</Text>
          <Text style={styles.body}>{message}</Text>
          {signedOut ? (step === 'coordinator'
            ? <CoordinatorForm busy={busy} error={shownError} onBack={() => goTo('choose')}
              onSubmit={(email, password) => run(() => signIn(email, password))} />
            : <ChooseRole busy={busy} error={shownError} onAcs={() => run(signInAcs)} onCoordinator={() => goTo('coordinator')} />)
            : status === 'checking' ? <ActivityIndicator accessibilityLabel="Verificando avaliação" color="#6824D6" /> : <>
              <Pressable accessibilityRole="button" accessibilityLabel="Tentar novamente" onPress={retrySession}
                style={({ pressed }) => [styles.action, pressed && styles.pressed]}>
                <Text style={styles.actionText}>Tentar novamente</Text>
              </Pressable>
              <Pressable accessibilityRole="button" accessibilityLabel="Trocar perfil" onPress={() => run(signOut)}
                style={({ pressed }) => [styles.secondary, pressed && styles.pressed]}>
                <Text style={styles.secondaryText}>Trocar perfil</Text>
              </Pressable>
            </>}
        </View>
      </ScrollView>
    </AnimatedScreenTransition>
  </SafeAreaView>;
}
const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: '#F8F6FD' }, contrast: { backgroundColor: '#08080C' },
  content: { flexGrow: 1, padding: 20, justifyContent: 'center' },
  card: { padding: 22, gap: 18, borderRadius: 24, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#EAE5F5' },
  title: { fontFamily: 'PlusJakartaSans-ExtraBold', fontSize: 23, color: '#181126' },
  body: { fontFamily: 'PlusJakartaSans-Regular', fontSize: 15, lineHeight: 23, color: '#625773' },
  option: { flexDirection: 'row', alignItems: 'center', gap: 14, minHeight: 76, padding: 16, borderRadius: 18,
    borderWidth: 1.5, borderColor: '#EAE5F5', backgroundColor: '#FFFFFF' },
  optionPressed: { borderColor: '#6824D6', backgroundColor: '#F6F1FF' },
  optionDisabled: { opacity: 0.55 },
  optionIcon: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F1EAFE' },
  optionText: { flex: 1, gap: 3 },
  optionTitle: { fontFamily: 'PlusJakartaSans-ExtraBold', fontSize: 16, color: '#181126' },
  optionBody: { fontFamily: 'PlusJakartaSans-Medium', fontSize: 13.5, lineHeight: 19, color: '#625773' },
  label: { fontFamily: 'PlusJakartaSans-Bold', fontSize: 14, color: '#181126', marginBottom: 6 },
  input: { width: '100%', minHeight: 50, paddingVertical: 11, paddingHorizontal: 14, borderRadius: 12, borderWidth: 1.5,
    borderColor: '#D9D0EC', backgroundColor: '#FFFFFF', fontFamily: 'PlusJakartaSans-Medium', fontSize: 15, color: '#181126' },
  inputFocused: { borderColor: '#6824D6' },
  inputError: { borderColor: '#C82333', backgroundColor: '#FFFBFB' },
  passwordWrap: { justifyContent: 'center' },
  passwordInput: { paddingRight: 48 },
  eye: { position: 'absolute', right: 8, width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  fieldError: { fontFamily: 'PlusJakartaSans-SemiBold', fontSize: 12.5, color: '#C82333', marginTop: 5 },
  error: { fontFamily: 'PlusJakartaSans-SemiBold', fontSize: 14, lineHeight: 20, color: '#C82333' },
  action: { minHeight: 52, borderRadius: 15, padding: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: '#6824D6' },
  actionText: { fontFamily: 'PlusJakartaSans-Bold', fontSize: 15, color: '#FFFFFF' }, pressed: { opacity: 0.8 },
  secondary: { minHeight: 48, borderRadius: 14, padding: 12, flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1.5, borderColor: '#EAE5F5', backgroundColor: '#FFFFFF' },
  secondaryText: { fontFamily: 'PlusJakartaSans-ExtraBold', fontSize: 14, color: '#5316B8' },
});
