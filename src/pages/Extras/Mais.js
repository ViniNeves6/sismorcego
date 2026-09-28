// src/pages/Extras/Mais.js
import React from 'react';
import { Alert, View, StyleSheet } from 'react-native';
import { ScrollScreen, ScreenHeader, Card, Avatar, Text, ListGroup, ListRow } from '../../ui';
import useAuth from '../../hooks/useAuth';
import useProfilePhoto from '../../hooks/useProfilePhoto';
import { useTheme } from '../../theme/ThemeProvider';
import logger from '../../utils/logger';

const styles = StyleSheet.create({
  profile: { flexDirection: 'row', alignItems: 'center' },
  profileText: { flex: 1, gap: 2 },
});

export default function Mais({ navigation }) {
  const { user, signOut } = useAuth();
  const photo = useProfilePhoto();
  const { spacing } = useTheme();

  const name = user?.displayName || user?.email?.split('@')[0] || 'Sua conta';

  const confirmSignOut = () => {
    Alert.alert('Sair da conta?', 'Registros pendentes continuam salvos no aparelho.', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Sair',
        style: 'destructive',
        onPress: () => signOut().catch((e) => logger.error('Mais: erro ao sair', e)),
      },
    ]);
  };

  return (
    <ScrollScreen header={<ScreenHeader title="Mais" />}>
      <Card onPress={() => navigation.getParent()?.navigate('Conta')} accessibilityLabel={`Conta de ${name}. Abrir perfil`}>
        <View style={[styles.profile, { gap: spacing.md }]}>
          <Avatar uri={photo} name={name} size={56} />
          <View style={styles.profileText}>
            <Text variant="heading" numberOfLines={1}>
              {name}
            </Text>
            {user?.email ? (
              <Text variant="caption" tone="muted" numberOfLines={1}>
                {user.email}
              </Text>
            ) : null}
          </View>
        </View>
      </Card>

      <ListGroup>
        <ListRow
          icon="settings"
          title="Configurações"
          subtitle="Tamanho do texto, contraste e leitura em voz alta"
          onPress={() => navigation.navigate('Configuracoes')}
        />
        <ListRow icon="help-circle" title="Dúvidas" onPress={() => navigation.navigate('Duvidas')} />
        <ListRow icon="info" title="Sobre o projeto" onPress={() => navigation.navigate('Sobre')} />
        <ListRow icon="book-open" title="Informativos" subtitle="Material educativo sobre morcegos e raiva" onPress={() => navigation.navigate('Informativos')} />
        <ListRow icon="users" title="Créditos" onPress={() => navigation.navigate('Creditos')} />
      </ListGroup>

      <ListGroup>
        <ListRow icon="log-out" title="Sair" tone="danger" onPress={confirmSignOut} />
      </ListGroup>
    </ScrollScreen>
  );
}
