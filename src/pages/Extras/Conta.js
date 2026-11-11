// src/pages/Extras/Conta.js
import React, { useEffect, useState } from 'react';
import { DeviceEventEmitter, View, StyleSheet } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { launchCamera, launchImageLibrary } from 'react-native-image-picker';
import { ScrollScreen, ScreenHeader, Section, TextField, Button, FooterBar, Avatar, useToast } from '../../ui';
import { useTheme } from '../../theme/ThemeProvider';
import useAuth from '../../hooks/useAuth';
import useAccessibility from '../../hooks/useAccessibility';
import useSpeakOnMount from '../../hooks/useSpeakOnMount';
import logger from '../../utils/logger';
import { hasProfileChanges, normalizedProfile } from '../../services/editChanges';
import { COORDINATOR_EVALUATION } from '../../services/appEnvironment';

const EMAIL_RE = /\S+@\S+\.\S+/;

export default function Conta() {
  const { user, updateUser } = useAuth();
  const { textToSpeechEnabled, speak } = useAccessibility();
  const { spacing } = useTheme();
  const toast = useToast();
  useSpeakOnMount('Tela de conta. Você pode atualizar suas informações pessoais.');

  const [nome, setNome] = useState(COORDINATOR_EVALUATION ? 'Sismorcego' : user?.displayName || '');
  const [email, setEmail] = useState(COORDINATOR_EVALUATION ? '************' : user?.email || '');
  const [senha, setSenha] = useState('');
  const [confirmaSenha, setConfirmaSenha] = useState('');
  const [foto, setFoto] = useState(null);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [baseline, setBaseline] = useState(() => normalizedProfile({ username: user?.displayName, email: user?.email }));
  const changed = hasProfileChanges(baseline, { username: nome, email }) || senha.length > 0;
  useEffect(() => { setBaseline(previous => ({ ...previous, username: normalizedProfile({ username: user?.displayName }).username })); }, [user?.displayName]);
  useEffect(() => { setBaseline(previous => ({ ...previous, email: normalizedProfile({ email: user?.email }).email })); }, [user?.email]);

  // Foto local (ou do Firebase, se existir).
  useEffect(() => {
    let active = true;
    AsyncStorage.getItem('profilePhoto').then((saved) => {
      if (!active) return;
      if (saved) setFoto(saved);
      else if (user?.photoURL) setFoto(user.photoURL);
    });
    return () => {
      active = false;
    };
  }, [user]);

  // A foto fica só no aparelho; avisa o resto do app quando muda.
  const escolherFoto = (from) => {
    const picker = from === 'camera' ? launchCamera : launchImageLibrary;
    picker({ mediaType: 'photo', quality: 0.7, includeBase64: true }, (res) => {
      const base64 = res?.assets?.[0]?.base64;
      if (!base64) return;
      const uri = `data:image/jpeg;base64,${base64}`;
      setFoto(uri);
      AsyncStorage.setItem('profilePhoto', uri).catch((e) => logger.error('Conta: erro ao salvar foto', e));
      DeviceEventEmitter.emit('profilePhoto:changed', uri);
    });
  };

  const validate = () => {
    const next = {};
    if (!EMAIL_RE.test(email.trim())) next.email = 'Digite um e-mail válido.';
    if (senha && senha.length < 6) next.senha = 'A senha precisa ter ao menos 6 caracteres.';
    if (senha && senha !== confirmaSenha) next.confirmaSenha = 'As senhas não conferem.';
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const salvar = async () => {
    if (COORDINATOR_EVALUATION || saving || !changed) return;
    if (!validate()) {
      if (textToSpeechEnabled) speak('Erro. Verifique os campos destacados.');
      return;
    }

    try {
      setSaving(true);
      const requested = normalizedProfile({ username: nome, email });
      await updateUser({ nome: requested.username, email: requested.email, senha });
      setBaseline(requested);
      setSenha('');
      setConfirmaSenha('');
      toast.show('Dados atualizados.', { tone: 'success' });
      if (textToSpeechEnabled) speak('Seus dados foram atualizados com sucesso.');
    } catch (e) {
      logger.error('Conta: erro ao atualizar', e);
      const message = e?.message || 'Não foi possível atualizar.';
      toast.show(message, { tone: 'danger', duration: 6000 });
      if (textToSpeechEnabled) speak(`Erro. ${message}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <ScrollScreen
      header={<ScreenHeader title="Conta" />}
      footer={!COORDINATOR_EVALUATION &&
        <FooterBar>
          <Button title="Salvar alterações" icon="check" onPress={salvar} loading={saving}
            disabled={!changed} variant={!changed ? 'muted' : 'primary'} />
        </FooterBar>
      }
      contentContainerStyle={{ gap: spacing.xl }}
    >
      <View style={[styles.photo, { gap: spacing.md }]}>
        <Avatar uri={foto} name={nome || user?.email} size={96} />
        <View style={[styles.row, { gap: spacing.md }]}>
          <Button title="Galeria" icon="image" variant="secondary" onPress={() => escolherFoto('gallery')} style={styles.half} />
          <Button title="Câmera" icon="camera" variant="secondary" onPress={() => escolherFoto('camera')} style={styles.half} />
        </View>
      </View>

      <Section title="Dados pessoais">
        <TextField label="Nome de usuário" value={COORDINATOR_EVALUATION ? 'Sismorcego' : nome} onChangeText={setNome} editable={!COORDINATOR_EVALUATION} autoCapitalize="words" autoComplete="name" />
        <TextField
          label="E-mail"
          editable={!COORDINATOR_EVALUATION}
          value={COORDINATOR_EVALUATION ? '************' : email}
          onChangeText={setEmail}
          error={errors.email}
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="email"
        />
      </Section>

      {!COORDINATOR_EVALUATION && <Section title="Alterar senha" description="Deixe em branco para manter a senha atual.">
        <TextField
          label="Nova senha"
          value={senha}
          onChangeText={setSenha}
          error={errors.senha}
          secureTextEntry
          autoCapitalize="none"
          autoComplete="new-password"
        />
        <TextField
          label="Confirmar nova senha"
          value={confirmaSenha}
          onChangeText={setConfirmaSenha}
          error={errors.confirmaSenha}
          secureTextEntry
          autoCapitalize="none"
          autoComplete="new-password"
        />
      </Section>}
    </ScrollScreen>
  );
}

const styles = StyleSheet.create({
  photo: { alignItems: 'center' },
  row: { flexDirection: 'row' },
  half: { flex: 1 },
});
