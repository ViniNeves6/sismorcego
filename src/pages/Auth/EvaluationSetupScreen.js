import React from 'react';
import { ActivityIndicator, StatusBar, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Pressable, ScrollView, Text, View } from '../../ui/AccessibleNative';
import MainScreenHeader from '../../ui/MainScreenHeader';
import AnimatedScreenTransition from '../../ui/AnimatedScreenTransition';
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

// A status screen only: no login, installation codes, picker or activation flow.
export default function EvaluationSetupScreen() {
  const { highContrast } = useAccessibility();
  const { evaluation, retrySession } = useAuth();
  const status = messages[evaluation?.status] ? evaluation.status : 'unavailable';
  const [title, message] = messages[status];
  useSpeakOnMount(`${title}. ${message}`);
  return <SafeAreaView style={[styles.fill, highContrast && styles.contrast]} edges={['top', 'bottom', 'left', 'right']}>
    <StatusBar barStyle={highContrast ? 'light-content' : 'dark-content'} backgroundColor={highContrast ? '#08080C' : '#FFFFFF'} />
    <MainScreenHeader title="Sismorcego" subtitle="Avaliação com coordenadores" />
    <AnimatedScreenTransition screenKey={status}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.card}>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.body}>{message}</Text>
          {status === 'checking' ? <ActivityIndicator accessibilityLabel="Verificando avaliação" color="#6824D6" /> :
            <Pressable accessibilityRole="button" accessibilityLabel="Tentar novamente" onPress={retrySession}
              style={({ pressed }) => [styles.action, pressed && styles.pressed]}>
              <Text style={styles.actionText}>Tentar novamente</Text>
            </Pressable>}
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
  action: { minHeight: 52, borderRadius: 15, padding: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: '#6824D6' },
  actionText: { fontFamily: 'PlusJakartaSans-Bold', fontSize: 15, color: '#FFFFFF' }, pressed: { opacity: 0.8 },
});
