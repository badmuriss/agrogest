import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { useEffect, useRef, useState } from 'react';
import { Keyboard, Modal, Platform, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { formatDate, parseISODate, toISODate } from '@/domain/dates';
import { radius, space, useIsDark, usePalette } from '@/theme';

import { Button } from './controls';
import type { DateInputProps } from './date-input.types';
import { haptics } from './motion';
import { AppText, Icon } from './text';

export function DateInput({ label, value, onChange }: DateInputProps) {
  const p = usePalette();
  const isDark = useIsDark();
  const insets = useSafeAreaInsets();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(() => parseISODate(value) ?? new Date());
  const androidOpen = useRef(false);
  const selected = parseISODate(value);

  useEffect(() => () => {
    if (androidOpen.current) void DateTimePickerAndroid.dismiss('date');
  }, []);

  const showPicker = () => {
    Keyboard.dismiss();
    haptics.tap();
    const date = parseISODate(value) ?? new Date();
    if (Platform.OS === 'android') {
      if (androidOpen.current) return;
      androidOpen.current = true;
      setOpen(true);
      const close = () => {
        androidOpen.current = false;
        setOpen(false);
      };
      DateTimePickerAndroid.open({
        value: date,
        mode: 'date',
        display: 'default',
        positiveButton: { label: 'Selecionar' },
        negativeButton: { label: 'Cancelar' },
        onValueChange: (_, next) => {
          close();
          onChange(toISODate(next));
        },
        onDismiss: close,
        onError: close,
      });
      return;
    }
    setDraft(date);
    setOpen(true);
  };

  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityValue={{ text: selected ? formatDate(value) : 'Sem data' }}
        accessibilityHint="Abre o calendário para escolher uma data"
        accessibilityState={{ expanded: open }}
        onPress={showPicker}
        style={({ pressed }) => [styles.input, { backgroundColor: p.fill, opacity: pressed ? 0.8 : 1 }]}>
        <AppText numeric style={[styles.date, !selected && { color: p.textFaint }]}>
          {selected ? formatDate(value) : 'Selecionar data'}
        </AppText>
        <Icon name="calendar-month-outline" size={22} color={p.accent} />
      </Pressable>
      {Platform.OS !== 'android' ? (
        <Modal transparent visible={open} animationType="slide" onRequestClose={() => setOpen(false)}>
          <View style={styles.overlay}>
            <Pressable
              accessibilityLabel="Cancelar seleção de data"
              accessibilityRole="button"
              style={styles.backdrop}
              onPress={() => setOpen(false)}
            />
            <View
              accessibilityViewIsModal
              style={[styles.sheet, { backgroundColor: p.surface, paddingBottom: Math.max(insets.bottom, space.lg) }]}>
              <AppText variant="heading" accessibilityRole="header">{label}</AppText>
              <DateTimePicker
                accessibilityLabel={label}
                value={draft}
                mode="date"
                display="spinner"
                locale="pt-BR"
                themeVariant={isDark ? 'dark' : 'light'}
                textColor={p.text}
                onValueChange={(_, next) => setDraft(next)}
                style={styles.picker}
              />
              <View style={styles.actions}>
                <Button title="Cancelar" variant="secondary" onPress={() => setOpen(false)} />
                <Button title="Selecionar" onPress={() => {
                  onChange(toISODate(draft));
                  setOpen(false);
                }} />
              </View>
            </View>
          </View>
        </Modal>
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  input: {
    minHeight: 54,
    borderRadius: radius.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingHorizontal: space.md + 2,
    paddingVertical: space.md,
  },
  date: { flex: 1 },
  overlay: { flex: 1, justifyContent: 'flex-end', alignItems: 'center' },
  backdrop: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, backgroundColor: '#00000066' },
  sheet: {
    width: '100%',
    maxWidth: 480,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    paddingTop: space.xl,
    paddingHorizontal: space.lg,
    gap: space.md,
  },
  picker: { width: '100%', height: 216 },
  actions: { flexDirection: 'row', gap: space.sm },
});
