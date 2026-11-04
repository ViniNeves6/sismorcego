import { Animated, Pressable, ScrollView, Text, View } from './AccessibleNative';
import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Easing, StyleSheet } from 'react-native';
import { CloseIcon } from './SismorcegoIcons';
import useReduceMotion from './useReduceMotion';
import useFadeCompositing from './useFadeCompositing';
import useSpeakOnMount from '../hooks/useSpeakOnMount';

export default function BottomSheetModal({
  visible,
  title,
  options = [],
  selectedValue = '',
  onSelect,
  onClose,
  onExited,
  bottomInset = 0,
  reduceMotion = false,
}) {
  const systemReduceMotion = useReduceMotion();
  const skipMotion = reduceMotion || systemReduceMotion;
  const [rendered, setRendered] = useState(visible);
  const anim = useRef(new Animated.Value(0)).current;
  const compositing = useFadeCompositing(anim, visible ? 1 : 0, skipMotion);
  const exitCallback = useRef(onExited);
  exitCallback.current = onExited;

  useLayoutEffect(() => { if (visible) setRendered(true); }, [visible]);
  useEffect(() => {
    if (!rendered) return;
    if (skipMotion) {
      anim.setValue(visible ? 1 : 0);
      if (!visible) {
        setRendered(false);
        exitCallback.current?.();
      }
      return;
    }
    let cancelled = false;
    const transition = Animated.timing(anim, {
      toValue: visible ? 1 : 0,
      duration: visible ? 260 : 220,
      easing: visible
        ? Easing.bezier(0.22, 0.82, 0.25, 1)
        : Easing.out(Easing.ease),
      useNativeDriver: true,
    });
    transition.start(({ finished }) => {
      if (finished && !cancelled && !visible) {
        setRendered(false);
        exitCallback.current?.();
      }
    });
    return () => { cancelled = true; transition.stop(); };
  }, [visible, rendered, skipMotion, anim]);

  useSpeakOnMount(`${title || 'Selecionar opção'}. ${options.slice(0, 20).map(option => option.label ?? option.value ?? option.id ?? option).join('. ')}${options.length > 20 ? '. Há mais opções. Deslize a lista' : ''}`, { active: visible, priority: 40 });
  if (!rendered) return null;

  const translateY = anim.interpolate({
    inputRange: [0, 1],
    outputRange: [420, 0],
  });

  return (
    <Animated.View
      {...compositing}
      style={[styles.backdrop, { opacity: anim }]}
      pointerEvents={visible ? 'auto' : 'none'}
    >
      <Pressable style={StyleSheet.absoluteFill} onPress={onClose}
        accessibilityRole="button" accessibilityLabel="Fechar seleção" />
      <Animated.View
        style={[
          styles.sheet,
          { paddingBottom: 28 + bottomInset },
          {
            transform: [{ translateY }],
          },
        ]}
      >
        <View style={styles.handle} />
        <View style={styles.header}>
          <Text style={styles.title} accessibilityRole="header">{title}</Text>
          <Pressable
            onPress={onClose}
            accessibilityRole="button"
            accessibilityLabel="Fechar"
            hitSlop={4}
            style={({ pressed }) => [
              styles.closeBtn,
              pressed && styles.closeBtnPressed,
            ]}
          >
            <CloseIcon size={22} color="#181126" />
          </Pressable>
        </View>
        <ScrollView
          style={styles.optionsList}
          contentContainerStyle={styles.optionsContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {options.map((opt) => {
            const value = opt?.id ?? opt?.value ?? opt;
            const label = opt?.label ?? value;
            const selected = selectedValue?.id ?? selectedValue?.value ?? selectedValue;
            const isSelected = value === selected;
            return (
              <Pressable
                key={value}
                onPress={() => {
                  onSelect(opt);
                }}
                accessibilityRole="button"
                accessibilityState={{ selected: isSelected }}
                style={({ pressed }) => [
                  styles.optionItem,
                  isSelected && styles.optionItemSelected,
                  pressed && !isSelected && styles.optionItemPressed,
                ]}
              >
                <Text
                  style={[
                    styles.optionText,
                    isSelected && styles.optionTextSelected,
                  ]}
                >
                  {label}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(24, 17, 38, 0.55)',
    zIndex: 210,
    justifyContent: 'flex-end',
  },
  sheet: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    maxHeight: '75%',
  },
  handle: {
    width: 38,
    height: 4,
    borderRadius: 999,
    backgroundColor: '#DFD2FA',
    alignSelf: 'center',
    marginTop: 12,
    marginBottom: 10,
  },
  header: {
    paddingTop: 4,
    paddingLeft: 24,
    paddingRight: 18,
    paddingBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  title: {
    flex: 1,
    fontSize: 17,
    lineHeight: 24,
    fontFamily: 'PlusJakartaSans-ExtraBold',
    color: '#181126',
    includeFontPadding: false,
  },
  closeBtn: {
    width: 38,
    height: 38,
    borderRadius: 999,
    backgroundColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionsList: {
    flexGrow: 0,
  },
  closeBtnPressed: {
    backgroundColor: '#F6F3FF',
  },
  optionsContent: {
    paddingHorizontal: 12,
  },
  optionItem: {
    minHeight: 48,
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderRadius: 14,
    backgroundColor: 'transparent',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  optionItemSelected: {
    backgroundColor: '#EFE9FE',
  },
  optionItemPressed: {
    backgroundColor: '#F6F3FF',
  },
  optionText: {
    flex: 1,
    fontSize: 15,
    lineHeight: 20,
    fontFamily: 'PlusJakartaSans-Medium',
    color: '#181126',
    includeFontPadding: false,
  },
  optionTextSelected: {
    color: '#5316B8',
    fontFamily: 'PlusJakartaSans-ExtraBold',
  },
});
