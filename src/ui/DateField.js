// src/ui/DateField.js
// Campo de data. Android: diálogo nativo. iOS: seletor numa folha inferior.
import React, { useState } from 'react';
import { Platform, Pressable, StyleSheet } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useTheme } from '../theme/ThemeProvider';
import Field, { useFieldBox } from './Field';
import BottomSheet from './BottomSheet';
import Button from './Button';
import Text from './Text';
import Icon from './Icon';

export const formatDate = (date) => {
  const d = new Date(date);
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  return `${day}/${month}/${d.getFullYear()}`;
};

export default function DateField({ label, hint, error, value, onChange, maximumDate, style }) {
  const { colors, spacing } = useTheme();
  const [open, setOpen] = useState(false);
  const box = useFieldBox({ error, focused: open });

  const handleChange = (event, selected) => {
    if (Platform.OS === 'android') setOpen(false);
    if (event?.type === 'dismissed') return;
    if (selected) onChange(selected);
  };

  return (
    <Field label={label} hint={hint} error={error} style={style}>
      <Pressable
        onPress={() => setOpen(true)}
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityValue={{ text: formatDate(value) }}
        accessibilityHint="Abre o seletor de data"
        android_ripple={{ color: colors.ripple }}
        style={[box, styles.between]}
      >
        <Text variant="body">{formatDate(value)}</Text>
        <Icon name="calendar" size="md" color={colors.inkMuted} />
      </Pressable>

      {Platform.OS === 'android' && open ? (
        <DateTimePicker value={value} mode="date" display="default" maximumDate={maximumDate} onChange={handleChange} />
      ) : null}

      {Platform.OS === 'ios' ? (
        <BottomSheet visible={open} onClose={() => setOpen(false)} title={label}>
          <DateTimePicker
            value={value}
            mode="date"
            display="spinner"
            locale="pt-BR"
            maximumDate={maximumDate}
            onChange={handleChange}
            themeVariant={colors.mode === 'light' ? 'light' : 'dark'}
          />
          <Button title="Concluir" onPress={() => setOpen(false)} style={{ marginHorizontal: spacing.xl }} />
        </BottomSheet>
      ) : null}
    </Field>
  );
}

const styles = StyleSheet.create({
  between: { justifyContent: 'space-between' },
});
