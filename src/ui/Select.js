// src/ui/Select.js
// Seleção em folha inferior. options: [{ value, label }]
import React, { useState } from 'react';
import { Pressable, FlatList, StyleSheet } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';
import Field, { useFieldBox } from './Field';
import BottomSheet from './BottomSheet';
import Text from './Text';
import Icon from './Icon';

export default function Select({
  label,
  hint,
  error,
  value,
  onChange,
  options,
  placeholder = 'Selecione',
  title,
  disabled = false,
  style,
}) {
  const { colors, spacing, touchTarget } = useTheme();
  const [open, setOpen] = useState(false);
  const box = useFieldBox({ error, focused: open, editable: !disabled });

  const selected = options.find((o) => o.value === value);

  const choose = (next) => {
    onChange(next);
    setOpen(false);
  };

  return (
    <Field label={label} hint={hint} error={error} style={style}>
      <Pressable
        onPress={() => setOpen(true)}
        disabled={disabled}
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityValue={{ text: selected ? selected.label : placeholder }}
        accessibilityState={{ disabled, expanded: open }}
        android_ripple={{ color: colors.ripple }}
        style={[box, styles.between, disabled && styles.disabled]}
      >
        <Text variant="body" tone={selected ? 'default' : 'subtle'} numberOfLines={1} style={styles.value}>
          {selected ? selected.label : placeholder}
        </Text>
        <Icon name="chevron-down" size="md" color={colors.inkMuted} />
      </Pressable>

      <BottomSheet visible={open} onClose={() => setOpen(false)} title={title ?? label ?? placeholder}>
        <FlatList
          data={options}
          keyExtractor={(o) => String(o.value)}
          renderItem={({ item }) => {
            const isSelected = item.value === value;
            return (
              <Pressable
                onPress={() => choose(item.value)}
                accessibilityRole="button"
                accessibilityLabel={item.label}
                accessibilityState={{ selected: isSelected }}
                android_ripple={{ color: colors.ripple }}
                style={({ pressed }) => [
                  styles.option,
                  {
                    minHeight: touchTarget + 4,
                    paddingHorizontal: spacing.xl,
                    gap: spacing.md,
                    backgroundColor: isSelected || pressed ? colors.primarySoft : 'transparent',
                  },
                ]}
              >
                <Text
                  variant={isSelected ? 'bodyStrong' : 'body'}
                  style={[styles.value, isSelected && { color: colors.onPrimarySoft }]}
                >
                  {item.label}
                </Text>
                {isSelected ? <Icon name="check" size="md" color={colors.onPrimarySoft} /> : null}
              </Pressable>
            );
          }}
        />
      </BottomSheet>
    </Field>
  );
}

const styles = StyleSheet.create({
  value: { flex: 1 },
  between: { justifyContent: 'space-between' },
  disabled: { opacity: 0.6 },
  option: { flexDirection: 'row', alignItems: 'center' },
});
