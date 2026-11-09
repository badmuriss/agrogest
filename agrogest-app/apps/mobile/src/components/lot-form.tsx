import { useState, type ReactNode } from 'react';

import { FieldInput, FormField, MoneyInput, QuantityStepper, ToggleGroup } from '@/components/fields';
import { AGE_SCALE, CATTLE_CATEGORIES, CattleIcon, type CattleCategory } from '@/components/cattle-icon';
import { Button, ButtonSpinner, ButtonText } from '@/components/gluestack/button';
import { Card } from '@/components/gluestack/card';
import { Divider } from '@/components/gluestack/divider';
import { HStack } from '@/components/gluestack/hstack';
import { Pressable } from '@/components/gluestack/pressable';
import { Text } from '@/components/gluestack/text';
import { VStack } from '@/components/gluestack/vstack';
import { PasturePicker } from '@/components/pasture-form';
import { Note } from '@/components/ui/controls';
import { DateField } from '@/components/ui/form';
import { Screen } from '@/components/ui/layout';
import { haptics } from '@/components/ui/motion';
import { Icon, IconTile, type IconName } from '@/components/ui/text';
import { formatDate } from '@/domain/dates';
import { formatCents, parseDecimal, parseInteger, plural } from '@/domain/format';
import type { LotEditLimits } from '@/domain/lot-edit';
import type { Lot } from '@/domain/types';
import { useApp } from '@/state/app-state';
import { usePalette } from '@/theme';

const PURCHASE_UNITS: { value: 'total' | 'cabeca'; label: string }[] = [
  { value: 'total', label: 'Total' },
  { value: 'cabeca', label: 'Por cabeça' },
];

/** Dados de raiz do lote, como o formulário os entrega. Fazenda e operação ficam com a tela. */
export type LotFormResult = Omit<Lot, 'id' | 'operationId' | 'farmId'>;

/** Remove vazios e repetições exatas; preserva zeros, séries e separadores. */
const cleanNumbers = (values: string[]) => [...new Set(values.map((value) => value.trim()).filter(Boolean))];

/** Categoria em cartão: o desenho mostra o sexo (boi ou vaca) e cresce com a idade. */
function CategoryTile({ category, selected, onPress }: { category: CattleCategory; selected: boolean; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      aria-selected={selected}
      accessibilityLabel={`${category.label}, ${category.sex === 'macho' ? 'machos' : 'fêmeas'} ${category.hint}`}
      onPress={() => {
        haptics.tap();
        onPress();
      }}
      className={
        selected
          ? 'flex-1 items-center gap-0.5 rounded-2xl border-2 border-primary bg-accent px-1 pb-2.5 pt-2 data-[active=true]:opacity-80'
          : 'flex-1 items-center gap-0.5 rounded-2xl border-2 border-transparent bg-secondary px-1 pb-2.5 pt-2 data-[active=true]:opacity-80'
      }>
      <VStack className="h-14 w-full items-center justify-end">
        <CattleIcon kind={category.kind} size={Math.round(52 * AGE_SCALE[category.age])} />
      </VStack>
      <Text size="sm" numberOfLines={1} className={selected ? 'font-semibold text-accent-foreground' : 'font-semibold'}>
        {category.label}
      </Text>
      <Text size="xs" numberOfLines={1} className={selected ? 'text-accent-foreground' : 'text-muted-foreground'}>
        {category.hint}
      </Text>
    </Pressable>
  );
}

/** Grade 2 × 3: uma linha de machos, outra de fêmeas, idade da esquerda para a direita. */
function CategoryPicker({ value, onChange }: { value: string; onChange: (category: string) => void }) {
  const p = usePalette();
  return (
    <VStack className="gap-3">
      {(['macho', 'femea'] as const).map((sex) => (
        <VStack key={sex} className="gap-1.5">
          <HStack className="items-center gap-1">
            <Icon name={sex === 'macho' ? 'gender-male' : 'gender-female'} size={16} color={p.textMuted} />
            <Text size="sm" className="text-muted-foreground">
              {sex === 'macho' ? 'Machos' : 'Fêmeas'}
            </Text>
          </HStack>
          <HStack className="gap-2">
            {CATTLE_CATEGORIES.filter((c) => c.sex === sex).map((c) => (
              <CategoryTile key={c.label} category={c} selected={value === c.label} onPress={() => onChange(c.label)} />
            ))}
          </HStack>
        </VStack>
      ))}
    </VStack>
  );
}

/**
 * Bloco do formulário com cabeçalho próprio. Os opcionais começam recolhidos e mostram
 * um resumo do que já foi preenchido, para a tela não virar uma parede de campos.
 */
function FormSection({
  icon,
  title,
  summary,
  collapsible,
  initiallyOpen = true,
  children,
}: {
  icon: IconName;
  title: string;
  summary?: string;
  collapsible?: boolean;
  initiallyOpen?: boolean;
  children: ReactNode;
}) {
  const p = usePalette();
  const [open, setOpen] = useState(!collapsible || initiallyOpen);
  const header = (
    <HStack className="items-center gap-3">
      <IconTile name={icon} size={36} tone="accent" />
      <VStack className="flex-1">
        <Text className="font-semibold" accessibilityRole="header">
          {title}
        </Text>
        {summary ? (
          <Text size="sm" numberOfLines={1} className="text-muted-foreground">
            {summary}
          </Text>
        ) : null}
      </VStack>
      {collapsible ? <Icon name={open ? 'chevron-up' : 'chevron-down'} size={22} color={p.textFaint} /> : null}
    </HStack>
  );
  return (
    <Card className="gap-5">
      {collapsible ? (
        <Pressable
          accessibilityRole="button"
          aria-expanded={open}
          accessibilityLabel={`${title}${summary ? `: ${summary}` : ''}`}
          className="-m-1 rounded-xl p-1 data-[active=true]:opacity-70"
          onPress={() => {
            haptics.tap();
            setOpen((value) => !value);
          }}>
          {header}
        </Pressable>
      ) : (
        header
      )}
      {open ? <VStack className="gap-5">{children}</VStack> : null}
    </Card>
  );
}

/** Lista de números de documento: um campo para digitar e os já adicionados como linhas removíveis. */
function DocumentNumbers({
  label,
  placeholder,
  values,
  draft,
  onChange,
  onDraftChange,
}: {
  label: string;
  placeholder: string;
  values: string[];
  draft: string;
  onChange: (values: string[]) => void;
  onDraftChange: (draft: string) => void;
}) {
  const p = usePalette();
  const add = () => {
    const next = cleanNumbers([...values, draft]);
    if (next.length > 100) return;
    haptics.tap();
    onChange(next);
    onDraftChange('');
  };
  return (
    <FormField label={label}>
      {values.length > 0 ? (
        <VStack className="mb-2 overflow-hidden rounded-xl border border-border">
          {values.map((value, index) => (
            <HStack key={value} className={index > 0 ? 'min-h-12 items-center gap-2 border-t border-border pl-3' : 'min-h-12 items-center gap-2 pl-3'}>
              <Icon name="file-document-outline" size={18} color={p.textMuted} />
              <Text className="flex-1 tabular-nums" numberOfLines={1}>
                {value}
              </Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Remover ${value}`}
                hitSlop={6}
                className="h-12 w-12 items-center justify-center data-[active=true]:opacity-60"
                onPress={() => {
                  haptics.tap();
                  onChange(values.filter((item) => item !== value));
                }}>
                <Icon name="close" size={20} color={p.textMuted} />
              </Pressable>
            </HStack>
          ))}
        </VStack>
      ) : null}
      <HStack className="items-center gap-2">
        <VStack className="flex-1">
          <FieldInput
            value={draft}
            onChangeText={onDraftChange}
            placeholder={placeholder}
            maxLength={100}
            autoCapitalize="characters"
            autoCorrect={false}
            returnKeyType="done"
            onSubmitEditing={draft.trim() ? add : undefined}
          />
        </VStack>
        <Button variant="soft" accessibilityLabel={`Adicionar ${label === 'GTA' ? label : label.toLowerCase()}`} isDisabled={!draft.trim() || values.length >= 100} onPress={add}>
          <Icon name="plus" size={20} color={p.accent} />
          <ButtonText>Adicionar</ButtonText>
        </Button>
      </HStack>
    </FormField>
  );
}

/**
 * Formulário único do lote: cadastro e edição dos dados de raiz. `limits` vem dos lançamentos
 * já feitos (edição) e impede deixar o lote com menos cabeças ou entrada depois deles.
 */
export function LotForm({
  farmId,
  initial,
  finance,
  limits,
  top,
  submitLabel,
  onSubmit,
}: {
  /** Fazenda do lote: o pasto é escolhido entre os dela. */
  farmId: string;
  initial: LotFormResult;
  finance: boolean;
  limits?: LotEditLimits;
  /** Conteúdo antes dos blocos (ilustração, fazenda). */
  top?: ReactNode;
  submitLabel: string;
  onSubmit: (result: LotFormResult) => Promise<void>;
}) {
  const p = usePalette();
  const editing = !!limits;
  const [category, setCategory] = useState(initial.category);
  const [headsText, setHeadsText] = useState(initial.headsPurchased > 0 ? String(initial.headsPurchased) : '');
  const [weightText, setWeightText] = useState(initial.entryWeightKg > 0 ? String(initial.entryWeightKg).replace('.', ',') : '');
  const [date, setDate] = useState(initial.purchasedAt);
  const [code, setCode] = useState(initial.code);
  const [pastureId, setPastureId] = useState<string | null>(initial.pastureId ?? null);
  const [supplier, setSupplier] = useState(initial.supplier);
  const [purchaseCents, setPurchaseCents] = useState(initial.purchaseCents);
  const [purchaseUnit, setPurchaseUnit] = useState<'total' | 'cabeca'>('total');
  const [commissionCents, setCommissionCents] = useState(initial.commissionCents);
  const [freightCents, setFreightCents] = useState(initial.freightCents);
  const [gtaNumbers, setGtaNumbers] = useState(initial.gtaNumbers ?? []);
  const [invoiceNumbers, setInvoiceNumbers] = useState(initial.invoiceNumbers ?? []);
  const [gtaDraft, setGtaDraft] = useState('');
  const [invoiceDraft, setInvoiceDraft] = useState('');
  const [touched, setTouched] = useState(false);
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);

  const heads = parseInteger(headsText);
  const app = useApp();
  // O pasto escolhido precisa ser desta fazenda; trocar de fazenda pede outra escolha.
  const pasture = pastureId ? app.pasture(pastureId) : undefined;
  const pastureValid = !!pasture && pasture.farmId === farmId && (pasture.active || pasture.id === initial.pastureId);
  const weight = parseDecimal(weightText);
  const errors = {
    category: category ? null : 'Escolha a categoria.',
    heads:
      heads === null || heads <= 0 || heads > 20_000
        ? 'Informe quantas cabeças entraram.'
        : limits && heads < limits.minHeads
          ? `Já saíram ou estão reservadas ${plural(limits.minHeads, 'cabeça', 'cabeças')} deste lote.`
          : null,
    weight: weight === null || weight < 20 || weight > 1500 ? 'Informe um peso médio entre 20 e 1.500 kg.' : null,
    date:
      limits?.latestPurchasedAt && date > limits.latestPurchasedAt
        ? `A entrada precisa ser até ${formatDate(limits.latestPurchasedAt)}, data do primeiro lançamento.`
        : null,
    code: code.trim() ? null : 'Dê um código para o lote.',
    pasture: pastureValid ? null : 'Escolha o pasto onde os animais entram.',
  };
  const shown = (key: keyof typeof errors) => (touched ? errors[key] : null);
  // O valor digitado pode ser por cabeça: nesse caso o total é valor × cabeças.
  const purchaseTotalCents = purchaseUnit === 'cabeca' ? purchaseCents * (heads ?? 0) : purchaseCents;
  const totalCents = purchaseTotalCents + commissionCents + freightCents;
  const allGta = cleanNumbers([...gtaNumbers, gtaDraft]);
  const allInvoices = cleanNumbers([...invoiceNumbers, invoiceDraft]);

  const documentsSummary =
    allGta.length + allInvoices.length === 0
      ? editing ? 'GTA e nota fiscal, se tiver' : 'Opcional · GTA e nota fiscal, se tiver'
      : [allGta.length ? plural(allGta.length, 'GTA', 'GTAs') : null, allInvoices.length ? plural(allInvoices.length, 'nota', 'notas') : null]
          .filter(Boolean)
          .join(' · ');
  const costSummary = totalCents > 0 ? formatCents(totalCents) : editing ? 'Animais, comissão e frete' : 'Opcional · Animais, comissão e frete';

  const save = async () => {
    setTouched(true);
    setFailure(null);
    if (Object.values(errors).some(Boolean) || heads === null || weight === null || !pasture) return;
    setBusy(true);
    try {
      await onSubmit({
        code: code.trim(),
        managementGroup: pasture.name,
        pastureId: pasture.id,
        supplier: supplier.trim(),
        category,
        purchasedAt: date,
        headsPurchased: heads,
        entryWeightKg: weight,
        purchaseCents: purchaseTotalCents,
        commissionCents,
        freightCents,
        gtaNumbers: allGta,
        invoiceNumbers: allInvoices,
      });
    } catch (error) {
      setFailure(error instanceof Error ? error.message : 'Não foi possível salvar o lote.');
      setBusy(false);
    }
  };

  const hasErrors = touched && Object.values(errors).some(Boolean);

  return (
    <Screen
      footer={
        <Button size="lg" className="flex-1" isDisabled={busy} onPress={save}>
          {busy ? <ButtonSpinner color={p.onAccent} /> : null}
          <ButtonText>{submitLabel}</ButtonText>
        </Button>
      }>
      {top}

      <FormSection icon="cow" title="Animais" summary={editing ? undefined : 'Categoria, quantidade e peso na entrada'}>
        <FormField label="Categoria" error={shown('category')}>
          <CategoryPicker value={category} onChange={setCategory} />
        </FormField>
        <FormField label="Cabeças" error={shown('heads')}>
          <FieldInput keyboardType="number-pad" suffix="cab." placeholder="Ex.: 40" value={headsText} onChangeText={setHeadsText} />
          {editing ? null : <QuantityStepper value={heads} onChange={(next) => setHeadsText(String(next))} />}
        </FormField>
        <FormField
          label="Peso médio na entrada"
          error={shown('weight')}
          hint={editing ? undefined : 'Pode ser o peso da compra ou uma estimativa. Não precisa pesar de novo.'}>
          <FieldInput keyboardType="decimal-pad" suffix="kg" placeholder="Ex.: 220" value={weightText} onChangeText={setWeightText} />
        </FormField>
        <DateField label="Data de entrada" value={date} onChange={setDate} error={shown('date')} />
      </FormSection>

      <FormSection icon="tag-outline" title="Identificação" summary={editing ? undefined : 'Código, pasto e origem'}>
        <PasturePicker
          farmId={farmId}
          value={pastureValid ? pastureId : null}
          onChange={setPastureId}
          title={editing ? 'Pasto de entrada' : 'Pasto onde os animais entram'}
          error={shown('pasture')}
        />
        <FormField label="Código do lote" error={shown('code')} hint={editing ? undefined : 'Sugerido em sequência. Pode trocar.'}>
          <FieldInput value={code} onChangeText={setCode} autoCapitalize="characters" />
        </FormField>
        <FormField label="Origem (opcional)" hint="De quem os animais vieram.">
          <FieldInput value={supplier} onChangeText={setSupplier} placeholder="Fornecedor ou cria própria" autoCapitalize="words" />
        </FormField>
      </FormSection>

      <FormSection
        icon="file-document-multiple-outline"
        title="Documentos da compra"
        summary={documentsSummary}
        collapsible
        initiallyOpen={allGta.length + allInvoices.length > 0}>
        <DocumentNumbers
          label="GTA"
          placeholder="Número da GTA"
          values={gtaNumbers}
          draft={gtaDraft}
          onChange={setGtaNumbers}
          onDraftChange={setGtaDraft}
        />
        <Divider />
        <DocumentNumbers
          label="Nota fiscal"
          placeholder="Número da nota"
          values={invoiceNumbers}
          draft={invoiceDraft}
          onChange={setInvoiceNumbers}
          onDraftChange={setInvoiceDraft}
        />
      </FormSection>

      {finance ? (
        <FormSection icon="cash" title="Custo de entrada" summary={costSummary} collapsible initiallyOpen={editing || totalCents > 0}>
          <FormField
            label="Valor dos animais"
            hint={purchaseUnit === 'cabeca' && !heads ? 'Informe as cabeças para calcular o total.' : 'Em branco se forem de cria própria.'}>
            <ToggleGroup accessibilityLabel="Unidade do valor dos animais" options={PURCHASE_UNITS} value={purchaseUnit} onChange={setPurchaseUnit} />
            <MoneyInput accessibilityLabel="Valor dos animais" cents={purchaseCents} onChange={setPurchaseCents} />
          </FormField>
          <HStack className="gap-3">
            <VStack className="flex-1">
              <FormField label="Comissão">
                <MoneyInput accessibilityLabel="Comissão" cents={commissionCents} onChange={setCommissionCents} />
              </FormField>
            </VStack>
            <VStack className="flex-1">
              <FormField label="Frete">
                <MoneyInput accessibilityLabel="Frete" cents={freightCents} onChange={setFreightCents} />
              </FormField>
            </VStack>
          </HStack>
          {totalCents > 0 && heads ? (
            <VStack className="gap-2 rounded-xl bg-secondary p-3">
              <HStack className="items-center justify-between gap-3">
                <Text className="font-semibold">Custo de entrada</Text>
                <Text className="font-semibold tabular-nums">{formatCents(totalCents)}</Text>
              </HStack>
              <HStack className="items-center justify-between gap-3">
                <Text className="text-muted-foreground">Por cabeça</Text>
                <Text className="tabular-nums">{formatCents(Math.round(totalCents / heads))}</Text>
              </HStack>
            </VStack>
          ) : null}
          {!editing && totalCents > 0 ? (
            <Note icon="arrow-right-circle-outline">
              Próxima etapa: depois de salvar, você informa como a compra foi paga, para ela entrar nas contas a pagar.
            </Note>
          ) : null}
        </FormSection>
      ) : null}

      {failure ? (
        <Note tone="danger" icon="alert-circle-outline" boxed title="Não foi possível salvar">
          {failure}
        </Note>
      ) : hasErrors ? (
        <Note tone="warning" icon="alert-outline" boxed>
          Confira os campos marcados acima.
        </Note>
      ) : null}
    </Screen>
  );
}
