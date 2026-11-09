import { createContext, useContext, useState, type ComponentProps, type ReactNode, type Ref } from 'react';
import type { TextInputInstance } from 'react-native';

import { Button, ButtonText } from '@/components/gluestack/button';
import {
  FormControl,
  FormControlError,
  FormControlErrorText,
  FormControlHelper,
  FormControlHelperText,
  FormControlLabel,
  FormControlLabelText,
} from '@/components/gluestack/form-control';
import { HStack } from '@/components/gluestack/hstack';
import { Input, InputField, InputSlot } from '@/components/gluestack/input';
import { Pressable } from '@/components/gluestack/pressable';
import { Text } from '@/components/gluestack/text';
import { VStack } from '@/components/gluestack/vstack';
import { haptics } from '@/components/ui/motion';
import { Icon } from '@/components/ui/text';
import { formatCents } from '@/domain/format';
import { useIsDark, usePalette } from '@/theme';

/** Rótulo do FormField: vira o nome acessível do campo (o Gluestack usaria "Input Field"). */
const FieldLabelContext = createContext<string | undefined>(undefined);

/**
 * Campos de formulário do app sobre o Gluestack (FormControl + Input). Mantêm os padrões
 * de campo: rótulo curto, ajuda ou erro embaixo, alvo de 52 pt e teclado no tema atual.
 */
export function FormField({
  label,
  hint,
  error,
  right,
  children,
}: {
  label: string;
  hint?: string;
  error?: string | null;
  right?: ReactNode;
  children: ReactNode;
}) {
  return (
    <FormControl isInvalid={!!error}>
      <FormControlLabel>
        <FormControlLabelText>{label}</FormControlLabelText>
        {right}
      </FormControlLabel>
      <FieldLabelContext.Provider value={label}>{children}</FieldLabelContext.Provider>
      {error ? (
        <FormControlError>
          <FormControlErrorText accessibilityLiveRegion="polite">{error}</FormControlErrorText>
        </FormControlError>
      ) : hint ? (
        <FormControlHelper>
          <FormControlHelperText>{hint}</FormControlHelperText>
        </FormControlHelper>
      ) : null}
    </FormControl>
  );
}

type FieldInputProps = Omit<ComponentProps<typeof InputField>, 'ref'> & {
  /** Unidade fixa à direita (ex.: "kg"). */
  suffix?: string;
  right?: ReactNode;
  ref?: Ref<TextInputInstance>;
};

/** A tipagem do Gluestack declara o ref do InputField como TextInputProps; em runtime é o TextInput. */
type InputFieldRef = ComponentProps<typeof InputField>['ref'];

export function FieldInput({ suffix, right, ref, accessibilityLabel, ...props }: FieldInputProps) {
  const p = usePalette();
  const isDark = useIsDark();
  const fieldLabel = useContext(FieldLabelContext);
  return (
    <Input>
      <InputField
        ref={ref as InputFieldRef}
        aria-label={accessibilityLabel ?? fieldLabel}
        selectionColor={p.accent}
        keyboardAppearance={isDark ? 'dark' : 'light'}
        {...props}
      />
      {suffix ? <Text className="text-muted-foreground">{suffix}</Text> : null}
      {right}
    </Input>
  );
}

/** Senha com botão de mostrar/ocultar (em vez de pedir para digitar duas vezes). */
export function PasswordInput(props: Omit<FieldInputProps, 'secureTextEntry' | 'right' | 'suffix'>) {
  const p = usePalette();
  const [visible, setVisible] = useState(false);
  return (
    <FieldInput
      autoCapitalize="none"
      autoCorrect={false}
      {...props}
      secureTextEntry={!visible}
      right={
        <InputSlot
          accessibilityRole="button"
          accessibilityLabel={visible ? 'Ocultar senha' : 'Mostrar senha'}
          hitSlop={8}
          className="self-stretch pl-2"
          onPress={() => {
            haptics.tap();
            setVisible((v) => !v);
          }}>
          <Icon name={visible ? 'eye-off-outline' : 'eye-outline'} size={22} color={p.textMuted} />
        </InputSlot>
      }
    />
  );
}

/** Valor em reais digitado como centavos ("12345" → R$ 123,45). */
export function MoneyInput({
  cents,
  onChange,
  accessibilityLabel,
}: {
  cents: number;
  onChange: (cents: number) => void;
  accessibilityLabel?: string;
}) {
  return (
    <FieldInput
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
 * Ajuste rápido de quantidade: toques em +10/+20/+50 e −10/−20/−50 em vez de digitar.
 * O mínimo é 0 e o máximo é `max`.
 */
export function QuantityStepper({
  value,
  onChange,
  steps = [10, 20, 50],
  max = 20_000,
}: {
  value: number | null;
  onChange: (next: number) => void;
  steps?: number[];
  max?: number;
}) {
  const current = value ?? 0;
  const row = (sign: 1 | -1) => (
    <HStack space="sm">
      {steps.map((step) => {
        const disabled = sign < 0 && current === 0;
        return (
          <Button
            key={step}
            size="sm"
            variant={sign > 0 ? 'soft' : 'secondary'}
            className="flex-1 rounded-full"
            accessibilityLabel={`${sign > 0 ? 'Somar' : 'Subtrair'} ${step}`}
            isDisabled={disabled}
            onPress={() => {
              haptics.tap();
              onChange(Math.min(max, Math.max(0, current + sign * step)));
            }}>
            <ButtonText>{`${sign > 0 ? '+' : '−'}${step}`}</ButtonText>
          </Button>
        );
      })}
    </HStack>
  );
  return (
    <VStack space="sm" className="mt-2">
      {row(1)}
      {row(-1)}
    </VStack>
  );
}

/** Escolha entre poucas opções lado a lado (ex.: Total | Por cabeça). */
export function ToggleGroup<T extends string>({
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
  return (
    <HStack accessibilityRole="tablist" accessibilityLabel={accessibilityLabel} className="mb-2 gap-1 rounded-xl bg-secondary p-1">
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
            className={
              selected
                ? 'min-h-10 flex-1 items-center justify-center rounded-lg border border-border bg-card data-[active=true]:opacity-70'
                : 'min-h-10 flex-1 items-center justify-center rounded-lg border border-transparent data-[active=true]:opacity-70'
            }>
            <Text size="sm" numberOfLines={1} className={selected ? 'font-semibold text-foreground' : 'font-semibold text-muted-foreground'}>
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </HStack>
  );
}
