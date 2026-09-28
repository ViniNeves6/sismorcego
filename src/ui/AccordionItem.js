// src/ui/AccordionItem.js
// Item expansível controlado pelo pai (permite abrir um por vez ou vários).
import React from 'react';
import { LayoutAnimation, Platform, Pressable, UIManager, View, StyleSheet } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';
import useReduceMotion from './useReduceMotion';
import Text from './Text';
import Icon from './Icon';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

export default function AccordionItem({ title, subtitle, expanded, onToggle, children }) {
  const { colors, radius, spacing } = useTheme();
  const reduceMotion = useReduceMotion();

  const toggle = () => {
    if (!reduceMotion) LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    onToggle();
  };

  return (
    <View
      style={[
        styles.box,
        { backgroundColor: colors.surface, borderColor: expanded ? colors.primary : colors.line, borderRadius: radius.lg },
      ]}
    >
      <Pressable
        onPress={toggle}
        accessibilityRole="button"
        accessibilityLabel={subtitle ? `${title}. ${subtitle}` : title}
        accessibilityState={{ expanded }}
        android_ripple={{ color: colors.ripple }}
        style={[styles.header, { padding: spacing.lg, gap: spacing.md }]}
      >
        <View style={styles.titles}>
          <Text variant="bodyStrong">{title}</Text>
          {subtitle ? (
            <Text variant="caption" tone="muted">
              {subtitle}
            </Text>
          ) : null}
        </View>
        <Icon name={expanded ? 'chevron-up' : 'chevron-down'} size="md" color={colors.inkMuted} />
      </Pressable>

      {expanded ? (
        <View style={[styles.body, { borderTopColor: colors.line, padding: spacing.lg, gap: spacing.md }]}>
          {children}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  box: { borderWidth: 1.5, overflow: 'hidden' },
  header: { flexDirection: 'row', alignItems: 'center' },
  titles: { flex: 1, gap: 2 },
  body: { borderTopWidth: StyleSheet.hairlineWidth },
});
