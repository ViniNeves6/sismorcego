import React from 'react';
import { StyleSheet } from 'react-native';
import { Pressable, Text, View } from './AccessibleNative';

// Cabeçalho das cinco abas principais, conforme .top-bar do HTML de referência.
export default function MainScreenHeader({ title, subtitle, actionIcon, actionLabel, onActionPress }) {
  return (
    <View style={styles.header}>
      <View style={styles.titles}>
        <Text accessibilityRole="header" style={styles.title}>{title}</Text>
        <Text style={styles.subtitle}>{subtitle}</Text>
      </View>
      {actionIcon && (
        <Pressable onPress={onActionPress} accessibilityRole="button" accessibilityLabel={actionLabel}
          hitSlop={4} style={({ pressed }) => [styles.action, pressed && styles.actionPressed]}>
          {actionIcon}
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0,
    gap: 12, paddingTop: 12, paddingHorizontal: 20, paddingBottom: 18,
    backgroundColor: '#FFFFFF', borderBottomWidth: 1, borderBottomColor: '#EFE9FE',
  },
  titles: { flex: 1, minWidth: 0 },
  title: {
    fontSize: 24, lineHeight: 32, fontFamily: 'PlusJakartaSans-ExtraBold',
    color: '#181126', letterSpacing: -0.48, includeFontPadding: false,
  },
  subtitle: {
    fontSize: 13, lineHeight: 18, fontFamily: 'PlusJakartaSans-Medium',
    color: '#5E5473', marginTop: 2, includeFontPadding: false,
  },
  action: {
    width: 40, height: 40, borderRadius: 20, flexShrink: 0,
    backgroundColor: '#F6F3FF', borderWidth: 1.5, borderColor: '#DFD2FA',
    alignItems: 'center', justifyContent: 'center',
  },
  actionPressed: { backgroundColor: '#EFE9FE', transform: [{ scale: 0.96 }] },
});
