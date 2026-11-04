// src/ui/Select.js
// Seleção em folha inferior. options: [{ value, label }]
import React, { useState } from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../theme/ThemeProvider';
import Field, { useFieldBox } from './Field';
import BottomSheetModal from './BottomSheetModal';
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
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [open, setOpen] = useState(false);
  const [sheetMounted, setSheetMounted] = useState(false);
  const box = useFieldBox({ error, focused: open, editable: !disabled });

  const selected = options.find((o) => o.value === value);

  const choose = (next) => {
    onChange(next);
    setOpen(false);
  };

  return (
    <Field label={label} hint={hint} error={error} style={style}>
      <Pressable
        onPress={() => { setSheetMounted(true); setOpen(true); }}
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

      {sheetMounted && (
        <Modal transparent statusBarTranslucent navigationBarTranslucent visible animationType="none" onRequestClose={() => setOpen(false)}>
          <View style={styles.sheetRoot}>
            <BottomSheetModal
              visible={open}
              title={title ?? label ?? placeholder}
              options={options}
              selectedValue={value}
              onSelect={option => choose(option.value)}
              onClose={() => setOpen(false)}
              onExited={() => setSheetMounted(false)}
              bottomInset={insets.bottom}
            />
          </View>
        </Modal>
      )}
    </Field>
  );
}

const styles = StyleSheet.create({
  value: { flex: 1 },
  between: { justifyContent: 'space-between' },
  disabled: { opacity: 0.6 },
  sheetRoot: { flex: 1 },
});
