import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Easing, Modal, StyleSheet, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Pdf from "react-native-pdf";
import { Animated, Pressable, Text, View } from '../../../ui/AccessibleNative';
import { CloseIcon } from '../../../ui/SismorcegoIcons';
import Icon from '../../../ui/Icon';
import useReduceMotion from '../../../ui/useReduceMotion';
import useAccessibility from '../../../hooks/useAccessibility';
import useSpeakOnMount from '../../../hooks/useSpeakOnMount';
import logger from "../../../utils/logger";

export default function PdfViewerModal({ pdf, onClose, onDownload, onError }) {
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const reduceMotion = useReduceMotion();
  const { highContrast } = useAccessibility();
  useSpeakOnMount('Ficha em PDF. Use Baixar para salvar o documento ou Fechar para retornar', { active: Boolean(pdf), priority: 50 });
  const [displayed, setDisplayed] = useState(pdf);
  const progress = useRef(new Animated.Value(0)).current;
  const current = useRef(pdf);

  // Conserva o documento durante a saída, inclusive ao trocar de ficha.
  useEffect(() => {
    let transition;
    let cancelled = false;
    const animate = (toValue, complete) => {
      if (reduceMotion) { progress.setValue(toValue); complete?.(); return; }
      transition = Animated.timing(progress, {
        toValue, duration: toValue ? 260 : 220,
        easing: Easing.out(Easing.cubic), useNativeDriver: true,
      });
      transition.start(({ finished }) => { if (finished && !cancelled) complete?.(); });
    };
    const enter = () => {
      current.current = pdf;
      setDisplayed(pdf);
      if (pdf) animate(1);
    };
    if (current.current && current.current !== pdf) animate(0, enter);
    else if (pdf) enter();
    return () => { cancelled = true; transition?.stop(); };
  }, [pdf, progress, reduceMotion]);

  const source = useMemo(() => {
    if (displayed?.path) return { uri: encodeURI(displayed.path), cache: false };
    if (displayed?.base64) return { uri: `data:application/pdf;base64,${displayed.base64}` };
    return null;
  }, [displayed]);
  if (!displayed) return null;

  return (
    <Modal transparent statusBarTranslucent navigationBarTranslucent visible animationType="none" onRequestClose={onClose}>
      <View style={styles.root} pointerEvents={pdf ? 'auto' : 'none'}>
        <Animated.View style={[StyleSheet.absoluteFill, styles.scrim, { opacity: progress }]}>
          <Pressable style={StyleSheet.absoluteFill} accessibilityRole="button" accessibilityLabel="Fechar prévia do PDF" onPress={onClose} />
        </Animated.View>
        <Animated.View style={[styles.sheet, { height: height - Math.max(insets.top + 16, 44), paddingBottom: insets.bottom,
          transform: [{ translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [height, 0] }) }] }]}>
          <View style={styles.handle} />
          <View style={styles.header}>
            <View style={styles.titles}>
              <Text style={styles.title} accessibilityRole="header">Ficha em PDF</Text>
              <Text style={styles.subtitle}>Sismorcego · prévia do documento</Text>
            </View>
            <Pressable accessibilityRole="button" accessibilityLabel="Baixar ou compartilhar PDF" onPress={onDownload}
              hitSlop={4} style={({ pressed }) => [styles.action, styles.download, pressed && styles.pressed]}>
              <Icon name="download" size={20} color={highContrast ? '#FFD700' : '#6824D6'} />
            </Pressable>
            <Pressable accessibilityRole="button" accessibilityLabel="Fechar" onPress={onClose}
              hitSlop={4} style={({ pressed }) => [styles.action, pressed && styles.pressed]}>
              <CloseIcon size={22} color="#181126" />
            </Pressable>
          </View>
          {source ? <Pdf source={source} style={styles.document} fitPolicy={0} minScale={1} maxScale={3}
            renderActivityIndicator={() => <ActivityIndicator color="#6824D6" size="large" />}
            onLoadComplete={pages => logger.log(`PDF carregado: ${pages} página(s)`)}
            onError={error => { logger.error('Erro ao abrir PDF:', error); onError?.(); }}
            enableAntialiasing useAndroidHardwareAcceleration trustAllCerts={false}
          /> : <View style={[styles.document, styles.center]}><ActivityIndicator size="large" color="#6824D6" /></View>}
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: 'flex-end' },
  scrim: { backgroundColor: 'rgba(24,17,38,0.55)' },
  sheet: { backgroundColor: '#FFFFFF', borderTopLeftRadius: 28, borderTopRightRadius: 28, overflow: 'hidden' },
  handle: { width: 38, height: 4, borderRadius: 999, backgroundColor: '#DFD2FA', alignSelf: 'center', marginTop: 12, marginBottom: 10 },
  header: { flexDirection: 'row', alignItems: 'center', paddingLeft: 24, paddingRight: 18, paddingBottom: 14, gap: 10 },
  titles: { flex: 1 },
  title: { fontFamily: 'PlusJakartaSans-ExtraBold', fontSize: 17, lineHeight: 24, color: '#181126' },
  subtitle: { fontFamily: 'PlusJakartaSans-Medium', fontSize: 10, lineHeight: 16, color: '#5E5473', marginTop: 2 },
  action: { width: 38, height: 38, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  download: { backgroundColor: '#F1EAFE' },
  pressed: { backgroundColor: '#E5D8FB' },
  document: { flex: 1, backgroundColor: '#F5F2FA' },
  center: { alignItems: 'center', justifyContent: 'center' },
});
