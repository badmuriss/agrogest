import { useState, type ReactNode, type Ref } from 'react';
import { Pressable, StyleSheet, TextInput, View, type TextInputInstance, type TextInputProps } from 'react-native';

import { addDays, todayISO } from '@/domain/dates';
import { formatCents } from '@/domain/format';
import { font, radius, space, useIsDark, usePalette } from '@/theme';

import { Chip } from './controls';
import { DateInput } from './date-input';
import { haptics } from './motion';
import { AppText, Icon } from './text';

export function Field({
  label,
  hint,
  error,
  children,
  right,
}: {
  label: string;
  hint?: string;
  error?: string | null;
  children: ReactNode;
  right?: ReactNode;
}) {
  return (
    <View style={styles.field}>
      <View style={styles.labelRow}>
        <AppText variant="label" tone="muted">
          {label}
        </AppText>
        {right}
      </View>
      {children}
      {error ? (
        <AppText variant="caption" tone="danger" accessibilityLiveRegion="polite">
          {error}
        </AppText>
      ) : hint ? (
        <AppText variant="caption" tone="muted">
          {hint}
        </AppText>
      ) : null}
    </View>
  );
}

export function TextField({
  suffix,
  right,
  invalid,
  style,
  onFocus,
  onBlur,
  ref,
  ...props
}: TextInputProps & { suffix?: string; right?: ReactNode; invalid?: boolean; ref?: Ref<TextInputInstance> }) {
  const p = usePalette();
  const isDark = useIsDark();
  const [focused, setFocused] = useState(false);
  const border = invalid ? p.danger : focused ? p.accent : 'transparent';
  return (
    <View style={[styles.inputBox, { backgroundColor: p.fill, borderColor: border }]}>
      <TextInput
        ref={ref}
        placeholderTextColor={p.textFaint}
        selectionColor={p.accent}
        keyboardAppearance={isDark ? 'dark' : 'light'}
        {...props}
        onFocus={(e) => {
          setFocused(true);
          onFocus?.(e);
        }}
        onBlur={(e) => {
          setFocused(false);
          onBlur?.(e);
        }}
        style={[styles.input, { color: p.text }, props.multiline && styles.multiline, style]}
      />
      {suffix ? (
        <AppText tone="muted" style={styles.suffix}>
          {suffix}
        </AppText>
      ) : null}
      {right}
    </View>
  );
}

/** Senha com botão de mostrar/ocultar (em vez de pedir para digitar duas vezes). */
export function PasswordField(props: Omit<TextInputProps, 'secureTextEntry'> & { invalid?: boolean; ref?: Ref<TextInputInstance> }) {
  const p = usePalette();
  const [visible, setVisible] = useState(false);
  return (
    <TextField
      autoCapitalize="none"
      autoCorrect={false}
      {...props}
      secureTextEntry={!visible}
      right={
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={visible ? 'Ocultar senha' : 'Mostrar senha'}
          hitSlop={8}
          onPress={() => {
            haptics.tap();
            setVisible((v) => !v);
          }}
          style={({ pressed }) => [styles.eye, pressed && { opacity: 0.5 }]}>
          <Icon name={visible ? 'eye-off-outline' : 'eye-outline'} size={22} color={p.textMuted} />
        </Pressable>
      }
    />
  );
}

/** Valor em reais digitado como centavos ("12345" → R$ 123,45). */
export function MoneyField({
  cents,
  onChange,
  accessibilityLabel,
}: {
  cents: number;
  onChange: (cents: number) => void;
  accessibilityLabel?: string;
}) {
  return (
    <TextField
      accessibilityLabel={accessibilityLabel}
      value={cents > 0 ? formatCents(cents) : ''}
      placeholder="R$ 0,00"
      keyboardType="number-pad"
      onChangeText={(text) => {
        const digits = text.replace(/\D/g, '').slice(0, 12);
        onChange(digits ? Number(digits) : 0);
      }}
    />
  );
}

/**
 * Valor em destaque, como o Pix no Nubank: o número é o centro da tela e o teclado já abre nele.
 * Digita-se só números; os centavos entram pela direita (1234 → R$ 12,34).
 */
export function BigMoneyField({
  cents,
  onChange,
  accessibilityLabel,
  autoFocus = false,
  invalid = false,
}: {
  cents: number;
  onChange: (cents: number) => void;
  accessibilityLabel: string;
  autoFocus?: boolean;
  invalid?: boolean;
}) {
  const p = usePalette();
  return (
    <TextInput
      accessibilityLabel={accessibilityLabel}
      autoFocus={autoFocus}
      value={cents > 0 ? formatCents(cents) : ''}
      placeholder="R$ 0,00"
      placeholderTextColor={p.textFaint}
      keyboardType="number-pad"
      selectionColor={p.accent}
      onChangeText={(text) => {
        const digits = text.replace(/\D/g, '').slice(0, 12);
        onChange(digits ? Number(digits) : 0);
      }}
      style={[styles.bigMoney, { color: p.text, borderBottomColor: invalid ? p.danger : cents > 0 ? p.accent : p.border }]}
    />
  );
}

export function DateField({
  label,
  value,
  onChange,
  hint,
  error,
}: {
  label: string;
  value: string;
  onChange: (iso: string) => void;
  hint?: string;
  error?: string | null;
}) {
  const today = todayISO();
  const yesterday = addDays(today, -1);

  return (
    <Field label={label} hint={hint} error={error}>
      <DateInput label={label} value={value} onChange={onChange} />
      <View style={styles.dateRow}>
        <Chip label="Hoje" selected={value === today} onPress={() => onChange(today)} />
        <Chip label="Ontem" selected={value === yesterday} onPress={() => onChange(yesterday)} />
      </View>
    </Field>
  );
}

const styles = StyleSheet.create({
  bigMoney: { fontFamily: font.bold, fontSize: 40, lineHeight: 50, textAlign: 'center', paddingVertical: space.sm, borderBottomWidth: 2, fontVariant: ['tabular-nums'] },
  field: { gap: space.sm },
  labelRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.sm },
  inputBox: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: radius.md,
    borderWidth: 1.5,
    minHeight: 52,
  },
  input: { flex: 1, fontSize: 16, paddingHorizontal: space.md + 2, paddingVertical: space.md, minWidth: 0 },
  multiline: { minHeight: 84, textAlignVertical: 'top' },
  suffix: { paddingRight: space.md + 2 },
  eye: { paddingHorizontal: space.md, alignSelf: 'stretch', justifyContent: 'center' },
  dateRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
});
