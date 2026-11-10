import type { ReactNode } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Switch, View, type StyleProp, type ViewStyle } from 'react-native';

import { radius, soft, space, toneColor, usePalette, type Tone } from '@/theme';

import { haptics, PressableScale } from './motion';
import { AppText, Icon, type IconName } from './text';

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';

export function Button({
  title,
  onPress,
  variant = 'primary',
  icon,
  disabled,
  size = 'md',
  style,
}: {
  title: string;
  onPress: () => void;
  variant?: ButtonVariant;
  icon?: IconName;
  disabled?: boolean;
  size?: 'md' | 'lg';
  style?: StyleProp<ViewStyle>;
}) {
  const p = usePalette();
  const colors = disabled ? { bg: p.disabledBackground, fg: p.disabledText } : {
    primary: { bg: p.accent, fg: p.onAccent },
    secondary: { bg: p.fill, fg: p.text },
    ghost: { bg: 'transparent', fg: p.accent },
    danger: { bg: soft(p.danger), fg: p.danger },
  }[variant];
  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityState={{ disabled: !!disabled }}
      accessibilityLabel={title}
      disabled={disabled}
      disabledOpacity={1}
      onPress={onPress}
      containerStyle={[styles.buttonContainer, style]}
      style={[styles.button, size === 'lg' && styles.buttonLg, { backgroundColor: colors.bg }]}>
      {icon ? <Icon name={icon} size={18} color={colors.fg} /> : null}
      <AppText variant="bodyStrong" style={[styles.buttonText, { color: colors.fg }]}>
        {title}
      </AppText>
    </PressableScale>
  );
}

/** Botão redondo só com ícone (ações de cabeçalho). Alvo de toque de 44 pt. */
export function IconButton({
  icon,
  accessibilityLabel,
  onPress,
  tone = 'neutral',
}: {
  icon: IconName;
  accessibilityLabel: string;
  onPress: () => void;
  tone?: 'neutral' | 'accent';
}) {
  const p = usePalette();
  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      hitSlop={6}
      onPress={onPress}
      style={[styles.iconButton, { backgroundColor: tone === 'accent' ? p.accent : p.fill }]}>
      <Icon name={icon} size={22} color={tone === 'accent' ? p.onAccent : p.text} />
    </PressableScale>
  );
}

/** Seleção com realce de marca, sem grandes áreas brancas no tema escuro. */
export function Chip({
  label,
  selected,
  onPress,
  count,
}: {
  label: string;
  selected?: boolean;
  onPress: () => void;
  count?: number;
}) {
  const p = usePalette();
  const fg = selected ? p.accent : p.text;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: !!selected }}
      {...(Platform.OS === 'web' ? { 'aria-pressed': !!selected } : {})}
      onPress={() => {
        haptics.tap();
        onPress();
      }}
      style={({ pressed }) => [
        styles.chip,
        { backgroundColor: selected ? p.accentSoft : p.fill, borderColor: selected ? p.accent : 'transparent', opacity: pressed ? 0.8 : 1 },
      ]}>
      <AppText variant="label" style={{ color: fg }}>
        {label}
      </AppText>
      {count !== undefined && count > 0 ? (
        <AppText variant="label" numeric style={{ color: selected ? p.accent : p.textMuted }}>
          {count}
        </AppText>
      ) : null}
    </Pressable>
  );
}

export function ChipRow({ children }: { children: ReactNode }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
      {children}
    </ScrollView>
  );
}

export function ChipWrap({ children }: { children: ReactNode }) {
  return <View style={styles.chipWrap}>{children}</View>;
}

export function Segmented<T extends string>({
  options,
  value,
  onChange,
  accessibilityLabel,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
  accessibilityLabel?: string;
}) {
  const p = usePalette();
  return (
    <View accessibilityRole="tablist" accessibilityLabel={accessibilityLabel} style={[styles.segmented, { backgroundColor: p.fill }]}>
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <Pressable
            key={option.value}
            accessibilityRole="tab"
            aria-selected={selected}
            onPress={() => {
              haptics.tap();
              onChange(option.value);
            }}
            style={[styles.segment, selected && { backgroundColor: p.surface, borderColor: p.border }]}>
            <AppText
              variant="label"
              numberOfLines={1}
              style={{ color: selected ? p.text : p.textMuted, textAlign: 'center' }}>
              {option.label}
            </AppText>
          </Pressable>
        );
      })}
    </View>
  );
}

/** Estado em texto com um ponto colorido: discreto, mas nunca só cor. */
export function StatusText({ label, tone = 'neutral' }: { label: string; tone?: Tone }) {
  const p = usePalette();
  const color = toneColor(p, tone);
  return (
    <View style={styles.status}>
      <View style={[styles.dot, { backgroundColor: color }]} />
      <AppText variant="label" style={{ color }}>
        {label}
      </AppText>
    </View>
  );
}

/** Etiqueta pequena e neutra. */
export function Badge({ label, tone = 'neutral', icon }: { label: string; tone?: Tone; icon?: IconName }) {
  const p = usePalette();
  const color = tone === 'neutral' ? p.textMuted : toneColor(p, tone);
  return (
    <View style={[styles.badge, { backgroundColor: tone === 'neutral' ? p.fill : soft(color) }]}>
      {icon ? <Icon name={icon} size={12} color={color} /> : null}
      <AppText variant="label" style={{ color, fontSize: 12, lineHeight: 16 }}>
        {label}
      </AppText>
    </View>
  );
}

/** Observação curta. Com `boxed`, ganha um fundo suave para alertas reais. */
export function Note({
  tone = 'neutral',
  icon = 'information-outline',
  title,
  children,
  boxed,
}: {
  tone?: Tone;
  icon?: IconName;
  title?: string;
  children?: ReactNode;
  boxed?: boolean;
}) {
  const p = usePalette();
  const color = tone === 'neutral' ? p.textMuted : toneColor(p, tone);
  return (
    <View style={[styles.note, boxed && { backgroundColor: soft(color), padding: space.md, borderRadius: radius.lg }]}>
      <Icon name={icon} size={18} color={color} />
      <View style={styles.noteBody}>
        {title ? (
          <AppText variant="bodyStrong" style={{ color: tone === 'neutral' ? p.text : color }}>
            {title}
          </AppText>
        ) : null}
        {typeof children === 'string' ? (
          <AppText variant="caption" tone="muted">
            {children}
          </AppText>
        ) : (
          children
        )}
      </View>
    </View>
  );
}

export function SwitchRow({
  label,
  description,
  value,
  onValueChange,
}: {
  label: string;
  description?: string;
  value: boolean;
  onValueChange: (value: boolean) => void;
}) {
  const p = usePalette();
  return (
    <View style={styles.switchRow}>
      <View style={styles.flexShrink}>
        <AppText variant="bodyStrong">{label}</AppText>
        {description ? (
          <AppText variant="caption" tone="muted">
            {description}
          </AppText>
        ) : null}
      </View>
      <Switch
        accessibilityLabel={label}
        value={value}
        onValueChange={(v) => {
          haptics.tap();
          onValueChange(v);
        }}
        trackColor={{ true: p.accent, false: p.fillStrong }}
        ios_backgroundColor={p.fillStrong}
        thumbColor="#FFFFFF"
        {...(Platform.OS === 'web' ? { activeThumbColor: '#FFFFFF' } : {})}
      />
    </View>
  );
}

export function CheckRow({
  label,
  description,
  checked,
  onToggle,
}: {
  label: string;
  description?: string;
  checked: boolean;
  onToggle: () => void;
}) {
  const p = usePalette();
  return (
    <Pressable
      accessibilityRole="checkbox"
      aria-checked={checked}
      onPress={() => {
        haptics.tap();
        onToggle();
      }}
      style={styles.checkRow}>
      <Icon name={checked ? 'checkbox-marked' : 'checkbox-blank-outline'} size={22} color={checked ? p.accent : p.textFaint} />
      <View style={styles.flexShrink}>
        <AppText variant="bodyStrong">{label}</AppText>
        {description ? (
          <AppText variant="caption" tone="muted">
            {description}
          </AppText>
        ) : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  flexShrink: { flexShrink: 1 },
  buttonContainer: { flexGrow: 1, flexShrink: 1 },
  button: {
    minHeight: 52,
    paddingHorizontal: space.lg,
    paddingVertical: space.sm,
    borderRadius: radius.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.sm,
  },
  buttonLg: { minHeight: 56 },
  iconButton: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  buttonText: { textAlign: 'center', flexShrink: 1 },
  chip: {
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: space.md + 2,
    minHeight: 44,
    borderRadius: radius.pill,
  },
  chipRow: { gap: space.sm, paddingRight: space.lg },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  segmented: { flexDirection: 'row', padding: 3, borderRadius: radius.md, gap: 2 },
  segment: {
    flex: 1,
    minHeight: 44,
    borderRadius: radius.sm + 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: space.xs,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'transparent',
  },
  status: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dot: { width: 7, height: 7, borderRadius: 4 },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    alignSelf: 'flex-start',
    paddingHorizontal: space.sm,
    paddingVertical: 2,
    borderRadius: radius.pill,
  },
  note: { flexDirection: 'row', gap: space.sm + 2, alignItems: 'flex-start' },
  noteBody: { flex: 1, gap: 2 },
  switchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.md },
  checkRow: { flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: 44 },
});
