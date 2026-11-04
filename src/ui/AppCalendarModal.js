import { Animated, Pressable, ScrollView, Text, View } from './AccessibleNative';
import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { BackHandler, Easing, StyleSheet } from 'react-native';
import useReduceMotion from './useReduceMotion';
import useFadeCompositing from './useFadeCompositing';
import useSpeakOnMount from '../hooks/useSpeakOnMount';
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  CloseIcon,
} from './SismorcegoIcons';
import {
  formatDatePtBrFromIso,
  toIsoDateString,
} from '../services/sismorcegoData';

const CALENDAR_MONTHS_PT = [
  'Janeiro',
  'Fevereiro',
  'Março',
  'Abril',
  'Maio',
  'Junho',
  'Julho',
  'Agosto',
  'Setembro',
  'Outubro',
  'Novembro',
  'Dezembro',
];

const WEEKDAYS_PT = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];

function CalendarPickerMenu({ visible, reduceMotion, style, children, onExited, testID }) {
  const [rendered, setRendered] = useState(visible);
  const progress = useRef(new Animated.Value(0)).current;
  const compositing = useFadeCompositing(progress, visible ? 1 : 0, reduceMotion);
  const exitCallback = useRef(onExited);
  exitCallback.current = onExited;
  useSpeakOnMount(testID?.includes('month') ? 'Selecionar mês. Deslize a lista para encontrar um dos doze meses' : 'Selecionar ano. Deslize a lista para encontrar o ano', { active: visible, priority: 45 });

  useLayoutEffect(() => {
    if (visible) setRendered(true);
  }, [visible]);

  useEffect(() => {
    if (!rendered) return;
    if (reduceMotion) {
      progress.setValue(visible ? 1 : 0);
      if (!visible) { setRendered(false); exitCallback.current?.(); }
      return;
    }

    let cancelled = false;
    const animation = Animated.timing(progress, {
      toValue: visible ? 1 : 0,
      duration: visible ? 160 : 120,
      easing: Easing.bezier(0.22, 0.82, 0.25, 1),
      useNativeDriver: true,
    });
    animation.start(({ finished }) => {
      if (finished && !cancelled && !visible) { setRendered(false); exitCallback.current?.(); }
    });
    return () => { cancelled = true; animation.stop(); };
  }, [visible, rendered, reduceMotion, progress]);

  if (!rendered) return null;

  return (
    <Animated.View
      testID={testID}
      {...compositing}
      pointerEvents={visible ? 'auto' : 'none'}
      accessibilityElementsHidden={!visible}
      importantForAccessibility={visible ? 'auto' : 'no-hide-descendants'}
      style={[
        style,
        {
          opacity: progress,
          transform: [{
            translateY: progress.interpolate({
              inputRange: [0, 1],
              outputRange: [-6, 0],
            }),
          }],
        },
      ]}
    >
      {children}
    </Animated.View>
  );
}

function parseIsoParts(iso) {
  const match = String(iso || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  const year = Number(match[1]);
  const monthIndex = Number(match[2]) - 1;
  const day = Number(match[3]);
  const d = new Date(year, monthIndex, day);
  if (
    d.getFullYear() !== year ||
    d.getMonth() !== monthIndex ||
    d.getDate() !== day
  ) {
    return null;
  }
  return { year, monthIndex, day };
}

export default function AppCalendarModal({
  visible,
  selectedIsoDate,
  onSelectDate,
  onClose,
  reduceMotion = false,
}) {
  const systemReduceMotion = useReduceMotion();
  const skipAnimation = reduceMotion || systemReduceMotion;
  const [rendered, setRendered] = useState(visible);
  const anim = useRef(new Animated.Value(0)).current;
  const compositing = useFadeCompositing(anim, visible ? 1 : 0, skipAnimation);

  const todayParts = useMemo(() => {
    const now = new Date();
    return {
      year: now.getFullYear(),
      monthIndex: now.getMonth(),
      day: now.getDate(),
      iso: toIsoDateString(now.getFullYear(), now.getMonth(), now.getDate()),
    };
  }, []);

  const [viewYear, setViewYear] = useState(todayParts.year);
  const [viewMonth, setViewMonth] = useState(todayParts.monthIndex);
  const [openPicker, setOpenPicker] = useState(null); // 'month' | 'year' | null
  const [displayedPicker, setDisplayedPicker] = useState(null);
  const [pickerLayouts, setPickerLayouts] = useState({});
  const pickerRequest = useRef(null);
  pickerRequest.current = visible ? openPicker : null;

  useLayoutEffect(() => {
    if (openPicker && !displayedPicker) setDisplayedPicker(openPicker);
  }, [openPicker, displayedPicker]);

  useEffect(() => {
    if (!visible || !openPicker) return;
    const listener = BackHandler.addEventListener('hardwareBackPress', () => {
      setOpenPicker(null);
      return true;
    });
    return () => listener.remove();
  }, [visible, openPicker]);

  const rememberPickerLayout = key => ({ nativeEvent: { layout } }) => {
    const { x, y, width, height } = layout;
    setPickerLayouts(previous => {
      const old = previous[key];
      if (old?.x === x && old?.y === y && old?.width === width && old?.height === height) return previous;
      return { ...previous, [key]: { x, y, width, height } };
    });
  };
  const controls = pickerLayouts.controls;
  const anchor = pickerLayouts[displayedPicker];
  const pickerPosition = controls && anchor ? {
    left: controls.x + anchor.x - styles.dialog.borderWidth,
    top: controls.y + anchor.y + anchor.height + 5 - styles.dialog.borderWidth,
    width: displayedPicker === 'year' ? 80 : anchor.width,
  } : null;

  useLayoutEffect(() => {
    if (visible) {
      const parsed = parseIsoParts(selectedIsoDate) || todayParts;
      setViewYear(parsed.year);
      setViewMonth(parsed.monthIndex);
      setOpenPicker(null);
      setDisplayedPicker(null);
      setRendered(true);
    }
  }, [visible, selectedIsoDate, todayParts]);

  // Inicia somente após montar as views nativas; cancela uma saída interrompida.
  useEffect(() => {
    if (!rendered) return;
    if (skipAnimation) {
      anim.setValue(visible ? 1 : 0);
      if (!visible) setRendered(false);
      return;
    }
    let cancelled = false;
    const animation = Animated.timing(anim, {
      toValue: visible ? 1 : 0,
      duration: visible ? 180 : 120,
      easing: Easing.bezier(0.22, 0.82, 0.25, 1),
      useNativeDriver: true,
    });
    animation.start(({ finished }) => {
      if (finished && !cancelled && !visible) setRendered(false);
    });
    return () => { cancelled = true; animation.stop(); };
  }, [visible, rendered, skipAnimation, anim]);

  const yearsList = useMemo(() => {
    const maxYear = new Date().getFullYear();
    const arr = [];
    for (let y = maxYear; y >= 1930; y -= 1) {
      arr.push(y);
    }
    return arr;
  }, []);

  const isFutureMonthDisabled = useMemo(() => {
    if (viewYear > todayParts.year) return true;
    if (viewYear === todayParts.year && viewMonth >= todayParts.monthIndex) return true;
    return false;
  }, [viewYear, viewMonth, todayParts]);

  const calendarCells = useMemo(() => {
    const firstWeekday = new Date(viewYear, viewMonth, 1).getDay();
    const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
    const daysInPrevMonth = new Date(viewYear, viewMonth, 0).getDate();

    const cells = [];
    for (let i = firstWeekday - 1; i >= 0; i -= 1) {
      const day = daysInPrevMonth - i;
      const d = new Date(viewYear, viewMonth - 1, day);
      cells.push({
        year: d.getFullYear(),
        monthIndex: d.getMonth(),
        day: d.getDate(),
        outside: true,
      });
    }
    for (let day = 1; day <= daysInMonth; day += 1) {
      cells.push({
        year: viewYear,
        monthIndex: viewMonth,
        day,
        outside: false,
      });
    }
    let nextDay = 1;
    while (cells.length < 42) {
      const d = new Date(viewYear, viewMonth + 1, nextDay);
      nextDay += 1;
      cells.push({
        year: d.getFullYear(),
        monthIndex: d.getMonth(),
        day: d.getDate(),
        outside: true,
      });
    }

    const rows = [];
    for (let r = 0; r < 6; r += 1) {
      rows.push(cells.slice(r * 7, r * 7 + 7));
    }
    return rows;
  }, [viewYear, viewMonth]);

  useSpeakOnMount(`Selecionar data. ${CALENDAR_MONTHS_PT[viewMonth]} de ${viewYear}. Toque no mês ou no ano para alterar. Escolha um dia, Hoje ou Cancelar`, { active: visible, priority: 40 });
  if (!rendered) return null;

  const handleChangeMonth = (delta) => {
    setOpenPicker(null);
    const next = new Date(viewYear, viewMonth + delta, 1);
    if (delta > 0 && isFutureMonthDisabled) return;
    setViewYear(next.getFullYear());
    setViewMonth(next.getMonth());
  };

  const handlePickDay = (cell) => {
    const cellDate = new Date(cell.year, cell.monthIndex, cell.day);
    const today = new Date(todayParts.year, todayParts.monthIndex, todayParts.day);
    if (cellDate > today) return;

    const iso = toIsoDateString(cell.year, cell.monthIndex, cell.day);
    const display = formatDatePtBrFromIso(iso);
    onSelectDate({ iso, display });
    onClose();
  };

  const handlePickToday = () => {
    const now = new Date();
    const iso = toIsoDateString(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
    );
    const display = formatDatePtBrFromIso(iso);
    onSelectDate({ iso, display });
    onClose();
  };

  const translateY = anim.interpolate({
    inputRange: [0, 1],
    outputRange: [12, 0],
  });
  const scale = anim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.98, 1],
  });

  return (
    <Animated.View
      {...compositing}
      style={[styles.overlay, { opacity: anim }]}
      pointerEvents={visible ? 'auto' : 'none'}
      accessibilityViewIsModal
      accessibilityElementsHidden={!visible}
      importantForAccessibility={visible ? 'auto' : 'no-hide-descendants'}
    >
      <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
      <Animated.View
        testID="calendar-dialog"
        style={[
          styles.dialog,
          {
            transform: [{ translateY }, { scale }],
          },
        ]}
      >
        {/* Heading matching .app-calendar-heading */}
        <View style={styles.heading}>
          <View>
            <Text style={styles.eyebrow}>DATA DA OCORRÊNCIA</Text>
            <Text style={styles.title}>Selecionar data</Text>
          </View>
          <Pressable
            onPress={onClose}
            accessibilityRole="button"
            accessibilityLabel="Fechar calendário"
            style={({ pressed }) => [
              styles.dismissBtn,
              pressed && { opacity: 0.8 },
            ]}
          >
            <CloseIcon size={17} color="#5316B8" strokeWidth={2.3} />
          </Pressable>
        </View>

        {/* Controls matching .app-calendar-controls: [ < ] [ Mês ] [ Ano ] [ > ] */}
        <View testID="calendar-controls" onLayout={rememberPickerLayout('controls')} style={styles.controlsRow}>
          <Pressable
            onPress={() => handleChangeMonth(-1)}
            style={({ pressed }) => [
              styles.ctrlNavBtn,
              pressed && styles.ctrlNavBtnPressed,
            ]}
          >
            <ChevronLeftIcon size={17} color="#5316B8" strokeWidth={2.3} />
          </Pressable>

          <View testID="calendar-month-anchor" onLayout={rememberPickerLayout('month')} style={styles.pickerColMonth}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Selecionar mês"
              aria-expanded={openPicker === 'month'}
              onPress={() =>
                setOpenPicker((prev) => (prev === 'month' ? null : 'month'))
              }
              style={[
                styles.pickerBtn,
                openPicker === 'month' && styles.pickerBtnOpen,
              ]}
            >
              <Text style={styles.pickerBtnText} numberOfLines={1}>
                {CALENDAR_MONTHS_PT[viewMonth]}
              </Text>
            </Pressable>
          </View>

          <View testID="calendar-year-anchor" onLayout={rememberPickerLayout('year')} style={styles.pickerColYear}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Selecionar ano"
              aria-expanded={openPicker === 'year'}
              onPress={() =>
                setOpenPicker((prev) => (prev === 'year' ? null : 'year'))
              }
              style={[
                styles.pickerBtn,
                openPicker === 'year' && styles.pickerBtnOpen,
              ]}
            >
              <Text style={styles.pickerBtnText} numberOfLines={1}>
                {String(viewYear)}
              </Text>
            </Pressable>
          </View>

          <Pressable
            disabled={isFutureMonthDisabled}
            onPress={() => handleChangeMonth(1)}
            style={({ pressed }) => [
              styles.ctrlNavBtn,
              isFutureMonthDisabled && styles.ctrlNavBtnDisabled,
              pressed && !isFutureMonthDisabled && styles.ctrlNavBtnPressed,
            ]}
          >
            <ChevronRightIcon size={17} color="#5316B8" strokeWidth={2.3} />
          </Pressable>
        </View>

        {/* Keep the menu inside the dialog's touch bounds, outside the short control columns. */}
        {displayedPicker && (
          <CalendarPickerMenu
            key={displayedPicker}
            testID={`calendar-${displayedPicker}-menu`}
            visible={visible && openPicker === displayedPicker && Boolean(pickerPosition)}
            reduceMotion={skipAnimation}
            style={[styles.dropdown, pickerPosition]}
            onExited={() => setDisplayedPicker(pickerRequest.current)}
          >
            <ScrollView
              testID={`calendar-${displayedPicker}-list`}
              accessibilityLabel={displayedPicker === 'month' ? 'Meses do calendário' : 'Anos do calendário'}
              style={styles.dropdownScroll}
              showsVerticalScrollIndicator
              nestedScrollEnabled
              keyboardShouldPersistTaps="handled"
            >
              {(displayedPicker === 'month' ? CALENDAR_MONTHS_PT : yearsList).map((option, index) => {
                const value = displayedPicker === 'month' ? index : option;
                const active = value === (displayedPicker === 'month' ? viewMonth : viewYear);
                return (
                  <Pressable
                    key={option}
                    accessibilityRole="button"
                    accessibilityState={{ selected: active }}
                    onPress={() => {
                      if (displayedPicker === 'month') setViewMonth(value);
                      else setViewYear(value);
                      setOpenPicker(null);
                    }}
                    style={[styles.dropdownOption, active && styles.dropdownOptionActive]}
                  >
                    <Text style={[styles.dropdownOptionText, active && styles.dropdownOptionTextActive]}>
                      {String(option)}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          </CalendarPickerMenu>
        )}

        {/* Days of week matching .app-calendar-weekdays */}
        <Pressable
          style={styles.body}
          onPress={() => {
            if (openPicker) setOpenPicker(null);
          }}
        >
          <View style={styles.weekdaysRow}>
            {WEEKDAYS_PT.map((w, idx) => (
              <View key={idx} style={styles.weekdayCell}>
                <Text style={styles.weekdayText}>{w}</Text>
              </View>
            ))}
          </View>

          {/* Days Grid matching .app-calendar-days */}
          <View style={styles.daysGrid}>
            {calendarCells.map((row, rIdx) => (
              <View key={rIdx} style={styles.daysRow}>
                {row.map((cell, cIdx) => {
                  const cellDate = new Date(cell.year, cell.monthIndex, cell.day);
                  const today = new Date(todayParts.year, todayParts.monthIndex, todayParts.day);
                  const isFuture = cellDate > today;
                  const iso = toIsoDateString(
                    cell.year,
                    cell.monthIndex,
                    cell.day,
                  );
                  const isSelected = iso === selectedIsoDate;
                  const isToday = iso === todayParts.iso;

                  return (
                    <Pressable
                      key={`${rIdx}_${cIdx}`}
                      disabled={isFuture}
                      onPress={() => handlePickDay(cell)}
                      style={({ pressed }) => [
                        styles.dayCell,
                        cell.outside && styles.dayCellOutside,
                        isFuture && styles.dayCellFuture,
                        isToday && !isSelected && styles.dayCellToday,
                        isSelected && styles.dayCellSelected,
                        pressed && !isSelected && !isFuture && styles.dayCellPressed,
                      ]}
                    >
                      <Text
                        style={[
                          styles.dayText,
                          cell.outside && styles.dayTextOutside,
                          isFuture && styles.dayTextFuture,
                          isToday && !isSelected && styles.dayTextToday,
                          isSelected && styles.dayTextSelected,
                        ]}
                      >
                        {String(cell.day)}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            ))}
          </View>
        </Pressable>

        {/* Footer matching .app-calendar-footer: Cancelar + Selecionar hoje */}
        <View style={styles.footer}>
          <Pressable
            onPress={onClose}
            style={({ pressed }) => [
              styles.cancelBtn,
              pressed && { opacity: 0.85 },
            ]}
          >
            <Text style={styles.cancelBtnText}>Cancelar</Text>
          </Pressable>
          <Pressable
            onPress={handlePickToday}
            style={({ pressed }) => [
              styles.todayBtn,
              pressed && { opacity: 0.9 },
            ]}
          >
            <Text style={styles.todayBtnText}>Selecionar hoje</Text>
          </Pressable>
        </View>
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(28, 13, 54, 0.48)',
    zIndex: 230,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  dialog: {
    width: '100%',
    maxWidth: 365,
    backgroundColor: '#FFFFFF',
    borderRadius: 22,
    borderWidth: 1.5,
    borderColor: '#DFD2FA',
    padding: 18,
    elevation: 20,
    shadowColor: '#1C0D36',
    shadowOffset: { width: 0, height: 22 },
    shadowOpacity: 0.24,
    shadowRadius: 28,
  },
  heading: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 18,
  },
  eyebrow: {
    fontSize: 10,
    letterSpacing: 0.7,
    fontFamily: 'PlusJakartaSans-ExtraBold',
    color: '#6824D6',
    marginBottom: 3,
    includeFontPadding: false,
  },
  title: {
    fontSize: 18,
    fontFamily: 'PlusJakartaSans-ExtraBold',
    color: '#181126',
    letterSpacing: -0.3,
    includeFontPadding: false,
  },
  dismissBtn: {
    width: 35,
    height: 35,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#DFD2FA',
    backgroundColor: '#F6F3FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  controlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 16,
    zIndex: 30,
  },
  ctrlNavBtn: {
    width: 35,
    height: 36,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#DFD2FA',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctrlNavBtnPressed: {
    backgroundColor: '#EFE9FE',
  },
  ctrlNavBtnDisabled: {
    opacity: 0.3,
  },
  pickerColMonth: {
    flex: 1,
    position: 'relative',
  },
  pickerColYear: {
    width: 76,
    position: 'relative',
  },
  pickerBtn: {
    height: 36,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#DFD2FA',
    backgroundColor: '#F6F3FF',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  pickerBtnOpen: {
    borderColor: '#6824D6',
    backgroundColor: '#EFE9FE',
  },
  pickerBtnText: {
    fontSize: 12,
    fontFamily: 'PlusJakartaSans-ExtraBold',
    color: '#5316B8',
    textAlign: 'center',
    includeFontPadding: false,
  },
  dropdown: {
    position: 'absolute',
    maxHeight: 198,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#DFD2FA',
    padding: 4,
    zIndex: 50,
    elevation: 10,
    shadowColor: '#1C0D36',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.18,
    shadowRadius: 16,
  },
  dropdownScroll: {
    height: 180,
    flexGrow: 0,
    flexShrink: 1,
  },
  dropdownOption: {
    minHeight: 35,
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 7,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dropdownOptionActive: {
    backgroundColor: '#EFE9FE',
  },
  dropdownOptionText: {
    fontSize: 12,
    fontFamily: 'PlusJakartaSans-SemiBold',
    color: '#181126',
    textAlign: 'center',
    includeFontPadding: false,
  },
  dropdownOptionTextActive: {
    fontFamily: 'PlusJakartaSans-ExtraBold',
    color: '#5316B8',
  },
  body: {
    zIndex: 1,
  },
  weekdaysRow: {
    flexDirection: 'row',
    marginBottom: 6,
  },
  weekdayCell: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
  },
  weekdayText: {
    fontSize: 11,
    fontFamily: 'PlusJakartaSans-ExtraBold',
    color: '#796E92',
    textAlign: 'center',
    includeFontPadding: false,
  },
  daysGrid: {
    gap: 2,
  },
  daysRow: {
    flexDirection: 'row',
    gap: 2,
  },
  dayCell: {
    flex: 1,
    aspectRatio: 1,
    minHeight: 35,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayCellPressed: {
    backgroundColor: '#EFE9FE',
  },
  dayCellOutside: {
    opacity: 0.5,
  },
  dayCellFuture: {
    opacity: 0.3,
  },
  dayCellToday: {
    borderWidth: 1.5,
    borderColor: '#7E22CE',
  },
  dayCellSelected: {
    backgroundColor: '#6824D6',
    elevation: 2,
    shadowColor: '#6824D6',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 5,
  },
  dayText: {
    fontSize: 12,
    fontFamily: 'PlusJakartaSans-Bold',
    color: '#181126',
    textAlign: 'center',
    includeFontPadding: false,
  },
  dayTextOutside: {
    color: '#796E92',
  },
  dayTextFuture: {
    color: '#796E92',
  },
  dayTextToday: {
    color: '#5316B8',
    fontFamily: 'PlusJakartaSans-ExtraBold',
  },
  dayTextSelected: {
    color: '#FFFFFF',
    fontFamily: 'PlusJakartaSans-ExtraBold',
  },
  footer: {
    flexDirection: 'row',
    gap: 9,
    paddingTop: 14,
    marginTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#EFE9FE',
  },
  cancelBtn: {
    flex: 1,
    height: 41,
    borderRadius: 11,
    borderWidth: 1,
    borderColor: '#DFD2FA',
    backgroundColor: '#F6F3FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelBtnText: {
    fontSize: 13,
    fontFamily: 'PlusJakartaSans-ExtraBold',
    color: '#5316B8',
    includeFontPadding: false,
  },
  todayBtn: {
    flex: 1,
    height: 41,
    borderRadius: 11,
    backgroundColor: '#6824D6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  todayBtnText: {
    fontSize: 13,
    fontFamily: 'PlusJakartaSans-ExtraBold',
    color: '#FFFFFF',
    includeFontPadding: false,
  },
});
