// src/ui/TextField.js
// Rótulo sempre visível (nunca só placeholder). Campos de senha ganham o botão
// mostrar/ocultar sozinhos.
import React, { useRef, useState } from 'react';
import { TextInput, Pressable, StyleSheet } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';
import Field, { useFieldBox } from './Field';
import Icon from './Icon';

export default function TextField({
  label,
  hint,
  error,
  leadingIcon,
  secureTextEntry = false,
  multiline = false,
  editable = true,
  onFocus,
  onBlur,
  ref,
  style,
  ...inputProps
}) {
  const { colors, spacing, type } = useTheme();
  const [focused, setFocused] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const innerRef = useRef(null);
  const box = useFieldBox({ error, focused, editable });

  return (
    <Field label={label} hint={hint} error={error} style={style}>
      <Pressable
        // Toque em qualquer ponto da caixa foca o campo.
        onPress={() => innerRef.current?.focus()}
        accessible={false}
        style={[box, multiline && [styles.multilineBox, { paddingVertical: spacing.md }]]}
      >
        {leadingIcon ? <Icon name={leadingIcon} size="md" color={colors.inkMuted} /> : null}

        <TextInput
          ref={(node) => {
            innerRef.current = node;
            if (typeof ref === 'function') ref(node);
            else if (ref) ref.current = node;
          }}
          editable={editable}
          multiline={multiline}
          secureTextEntry={secureTextEntry && !revealed}
          placeholderTextColor={colors.inkSubtle}
          selectionColor={colors.primary}
          accessibilityLabel={label}
          accessibilityHint={hint}
          maxFontSizeMultiplier={1.4}
          onFocus={(e) => {
            setFocused(true);
            onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            onBlur?.(e);
          }}
          {...inputProps}
          style={[
            styles.input,
            type.body,
            { color: colors.ink },
            multiline && styles.multiline,
          ]}
        />

        {secureTextEntry ? (
          <Pressable
            onPress={() => setRevealed((v) => !v)}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={revealed ? 'Ocultar senha' : 'Mostrar senha'}
          >
            <Icon name={revealed ? 'eye-off' : 'eye'} size="md" color={colors.inkMuted} />
          </Pressable>
        ) : null}
      </Pressable>
    </Field>
  );
}

const styles = StyleSheet.create({
  input: { flex: 1, paddingVertical: 10 },
  multiline: { minHeight: 96, textAlignVertical: 'top' },
  multilineBox: { alignItems: 'flex-start' },
});
