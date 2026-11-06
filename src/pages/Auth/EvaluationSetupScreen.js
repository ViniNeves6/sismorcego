import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, BackHandler, NativeModules, StatusBar, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Pressable, ScrollView, Text, View } from '../../ui/AccessibleNative';
import MainScreenHeader from '../../ui/MainScreenHeader';
import AnimatedScreenTransition from '../../ui/AnimatedScreenTransition';
import useAuth from '../../hooks/useAuth';
import useSpeakOnMount from '../../hooks/useSpeakOnMount';
import useAccessibility from '../../hooks/useAccessibility';

function Action({ title, onPress, disabled, loading, secondary }) {
  return <Pressable accessibilityRole="button" accessibilityLabel={title} accessibilityState={{ disabled: Boolean(disabled), busy: Boolean(loading) }}
    disabled={disabled} onPress={onPress} style={({ pressed }) => [styles.action, secondary && styles.secondary, disabled && styles.disabled, pressed && styles.pressed]}>
    {loading ? <ActivityIndicator color="#FFFFFF" /> : <Text style={[styles.actionText, secondary && styles.secondaryText]}>{title}</Text>}
  </Pressable>;
}

export default function EvaluationSetupScreen() {
  const { highContrast } = useAccessibility();
  const { evaluation, provisionDevice, retrySession } = useAuth();
  const [team, setTeam] = useState(false), [busy, setBusy] = useState(false), [error, setError] = useState('');
  const alive = useRef(true);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  useEffect(() => {
    if (!team) return;
    const back = BackHandler.addEventListener('hardwareBackPress', () => { setTeam(false); setError(''); return true; });
    return () => back.remove();
  }, [team]);
  const checking = evaluation?.status === 'checking';
  useSpeakOnMount(team ? 'Configuração pela equipe. Use o código deste aparelho para solicitar o arquivo de configuração e importe o arquivo recebido.'
    : checking ? 'Verificando configuração do aparelho.' : 'Este aparelho precisa ser configurado pela equipe responsável pela avaliação.');
  const importConfiguration = async () => {
    if (busy) return;
    setBusy(true); setError('');
    try {
      const reader = NativeModules.SismorcegoProvisioning;
      if (!reader?.selectConfiguration) throw new Error();
      const raw = await reader.selectConfiguration();
      if (raw !== null) await provisionDevice(raw);
    } catch (failure) {
      if (alive.current) setError(failure?.code?.startsWith('network/')
        ? 'Conecte o aparelho à internet e tente novamente.'
        : 'Não foi possível configurar. Peça à equipe um arquivo válido para este aparelho.');
    } finally { if (alive.current) setBusy(false); }
  };
  return <SafeAreaView style={[styles.fill, highContrast && styles.contrast]} edges={['top', 'bottom', 'left', 'right']}>
    <StatusBar barStyle={highContrast ? 'light-content' : 'dark-content'} backgroundColor={highContrast ? '#08080C' : '#FFFFFF'} />
    <MainScreenHeader title="Sismorcego" subtitle="Avaliação com coordenadores" />
    <AnimatedScreenTransition screenKey={team ? 'team-setup' : 'configuration-status'}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.card}>
          <Text style={styles.title}>{team ? 'Configuração pela equipe' : checking ? 'Verificando aparelho' : 'Configuração necessária'}</Text>
          <Text style={styles.body}>{team
            ? 'Esta etapa é realizada pela equipe responsável, antes de entregar o aparelho ao coordenador.'
            : checking ? 'Aguarde enquanto a sessão é verificada.'
              : 'O acesso à avaliação precisa ser preparado neste aparelho. Procure a equipe responsável para configurar ou renovar o acesso.'}</Text>
          {team ? <>
            <Text style={styles.label}>Código deste aparelho</Text>
            <Text selectable accessibilityLabel="Código deste aparelho" style={styles.code}>{evaluation?.installationId || 'Preparando código...'}</Text>
            <Text style={styles.body}>Solicite à equipe o arquivo correspondente a este código. Não compartilhe o arquivo e remova-o do aparelho após a configuração.</Text>
            <Action title={busy ? 'Configurando...' : 'Importar configuração'} onPress={importConfiguration}
              loading={busy} disabled={busy || !evaluation?.installationId || evaluation?.reason === 'unsupported-build'} />
            <Action title="Voltar" secondary onPress={() => { setTeam(false); setError(''); }} />
          </> : checking ? <ActivityIndicator accessibilityLabel="Verificando sessão" color="#6824D6" /> : <>
            {evaluation?.reason === 'unsupported-build' && <Text style={styles.body}>A equipe deve instalar o APK de avaliação apropriado neste aparelho.</Text>}
            {evaluation?.reason === 'secure-storage-unavailable' && <Text style={styles.body}>Não foi possível acessar o armazenamento seguro do aparelho. Peça ajuda à equipe.</Text>}
            <Action title="Configurar aparelho" onPress={() => setTeam(true)} disabled={!evaluation?.installationId} />
            <Action title="Tentar novamente" secondary onPress={retrySession} />
          </>}
          {!!error && <Text accessibilityRole="alert" style={styles.error}>{error}</Text>}
        </View>
      </ScrollView>
    </AnimatedScreenTransition>
  </SafeAreaView>;
}
const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: '#F8F6FD' },
  contrast: { backgroundColor: '#08080C' },
  content: { flexGrow: 1, padding: 20, justifyContent: 'center' },
  card: { padding: 22, gap: 18, borderRadius: 24, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#EAE5F5' },
  title: { fontFamily: 'PlusJakartaSans-ExtraBold', fontSize: 23, color: '#181126' },
  body: { fontFamily: 'PlusJakartaSans-Regular', fontSize: 15, lineHeight: 23, color: '#625773' },
  label: { fontFamily: 'PlusJakartaSans-Bold', fontSize: 14, color: '#5316B8' },
  code: { fontFamily: 'PlusJakartaSans-Medium', fontSize: 14, color: '#181126', backgroundColor: '#F5F1FF', padding: 14, borderRadius: 12 },
  error: { color: '#B42318', fontSize: 14 },
  action: { minHeight: 52, borderRadius: 15, padding: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: '#6824D6', borderWidth: 1, borderColor: '#6824D6' },
  secondary: { backgroundColor: '#F5F1FF', borderColor: '#DFD2FA' },
  actionText: { fontFamily: 'PlusJakartaSans-Bold', fontSize: 15, color: '#FFFFFF' },
  secondaryText: { color: '#5316B8' }, disabled: { opacity: 0.5 }, pressed: { opacity: 0.8 },
});
