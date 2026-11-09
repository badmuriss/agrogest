import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { FieldInput, FormField, MoneyInput } from '@/components/fields';
import { formatCents, formatNumber, parseDecimal, plural } from '@/domain/format';
import { formatQty, SUPPLY_KIND_LABEL, toControlUnits, UNIT_LABEL, type StockPosition } from '@/domain/stock';
import type { StockItem, Supply } from '@/domain/types';
import { useApp } from '@/state/app-state';
import { space } from '@/theme';

import { Button, Chip, ChipWrap, IconButton, Note, StatusText } from './ui/controls';
import { Card, Group, ListRow, Section } from './ui/layout';
import { AppText } from './ui/text';

/** Duração em linguagem de campo: "dura uns 12 dias". */
export function durationText(position: Pick<StockPosition, 'daysLeft' | 'qty'>): string {
  if (position.qty <= 0) return 'Sem estoque';
  if (position.daysLeft === null) return 'Sem consumo nos últimos 30 dias';
  if (position.daysLeft < 1) return 'Acaba hoje no ritmo atual';
  return `Dura uns ${plural(position.daysLeft, 'dia', 'dias')} no ritmo atual`;
}

/** Insumo com saldo, duração e, para sócio, valor e custo médio. */
export function StockRow({ position, showValue }: { position: StockPosition; showValue: boolean }) {
  const unit = position.supply.unit;
  return (
    <ListRow
      icon="silo"
      iconTone={position.low ? 'warning' : position.qty > 0 ? 'accent' : 'neutral'}
      accessibilityLabel={`${position.supply.name}: ${formatQty(position.qty, unit)}`}
      title={
        <View style={styles.row}>
          <AppText variant="bodyStrong" style={styles.flex} numberOfLines={1}>
            {position.supply.name}
          </AppText>
          <AppText variant="bodyStrong" numeric>
            {formatQty(position.qty, unit)}
          </AppText>
        </View>
      }
      subtitle={
        <View style={styles.sub}>
          <AppText variant="caption" tone="muted" numberOfLines={2}>
            {[
              durationText(position),
              showValue && position.qty > 0 ? `${formatCents(position.valueCents)} · ${formatCents(position.avgCostCents)}/${unit}` : null,
              position.reserved > 0 ? `${formatQty(position.reserved, unit)} aguardando aprovação` : null,
            ]
              .filter(Boolean)
              .join(' · ')}
          </AppText>
          {position.low ? <StatusText label="Estoque baixo" tone="warning" /> : null}
        </View>
      }
      onPress={() => router.push({ pathname: '/estoque/[id]', params: { id: position.supply.id, fazenda: position.farmId } })}
    />
  );
}

/** Insumos ativos da operação para escolher, com o saldo na fazenda. */
export function SupplyPicker({
  farmId,
  value,
  onChange,
  title = 'Insumo',
}: {
  farmId: string;
  value: string | null;
  onChange: (supplyId: string) => void;
  title?: string;
}) {
  const app = useApp();
  const farm = app.farm(farmId);
  const positions = app.stock([farmId]).filter((s) => s.supply.active);
  const canCreate = !!farm && app.canSeeFinance(farm.operationId);
  return (
    <Section title={title}>
      {positions.length > 0 ? (
        <Group>
          {positions.map((p) => (
            <ListRow
              key={p.supply.id}
              icon="silo"
              iconTone={value === p.supply.id ? 'accent' : 'neutral'}
              title={p.supply.name}
              subtitle={`${SUPPLY_KIND_LABEL[p.supply.kind]} · ${formatQty(p.available, p.supply.unit)} disponíveis`}
              selected={value === p.supply.id}
              onPress={() => onChange(p.supply.id)}
            />
          ))}
        </Group>
      ) : (
        <Note boxed icon="silo" title="Nenhum insumo cadastrado">
          <AppText variant="caption" tone="muted">
            {canCreate ? 'Cadastre sal, proteinado, ração ou medicamento para controlar o estoque.' : 'Peça a um sócio para cadastrar os insumos.'}
          </AppText>
          {canCreate ? <Button title="Cadastrar insumo" variant="secondary" icon="plus" onPress={() => router.push('/estoque/insumo')} /> : null}
        </Note>
      )}
    </Section>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: space.sm, alignItems: 'center' },
  sub: { gap: 2 },
  flex: { flex: 1 },
  items: { gap: space.md },
  item: { gap: space.sm },
});

export interface StockItemDraft {
  supplyId: string | null;
  quantityText: string;
  unit: string | null;
  cents: number;
}

/** Itens válidos, com a quantidade convertida para a unidade de controle; ou o primeiro problema. */
export function resolveStockItems(
  drafts: StockItemDraft[],
  totalCents: number,
  supplyOf: (id: string) => Supply | undefined,
): { items: StockItem[]; error: string | null } {
  const items: StockItem[] = [];
  for (const d of drafts) {
    const supply = d.supplyId ? supplyOf(d.supplyId) : undefined;
    if (!supply) return { items, error: 'Escolha o insumo de cada item.' };
    const purchaseQuantity = parseDecimal(d.quantityText) ?? 0;
    const unit = d.unit ?? supply.unit;
    const quantity = toControlUnits(supply, purchaseQuantity, unit);
    if (!(purchaseQuantity > 0) || quantity === null || quantity <= 0) return { items, error: `Informe a quantidade de ${supply.name}.` };
    items.push({ supplyId: supply.id, quantity, cents: d.cents, purchaseQuantity, purchaseUnit: unit });
  }
  if (items.length === 0) return { items, error: 'Adicione ao menos um insumo.' };
  const sum = items.reduce((acc, i) => acc + i.cents, 0);
  if (sum !== totalCents) return { items, error: `Os itens somam ${formatCents(sum)}; a compra é de ${formatCents(totalCents)}.` };
  return { items, error: null };
}

export function draftsFrom(items: StockItem[] | undefined): StockItemDraft[] {
  return (items ?? []).map((i) => ({ supplyId: i.supplyId, quantityText: formatNumber(i.purchaseQuantity, 3), unit: i.purchaseUnit, cents: i.cents }));
}

/**
 * Itens da compra para o estoque: insumo, quantidade na unidade da compra (convertida para a de
 * controle) e valor. Os itens precisam fechar o valor da compra.
 */
export function StockItemsEditor({
  operationId,
  drafts,
  onChange,
  totalCents,
}: {
  operationId: string;
  drafts: StockItemDraft[];
  onChange: (drafts: StockItemDraft[]) => void;
  totalCents: number;
}) {
  const app = useApp();
  const supplies = app.supplies.filter((s) => s.operationId === operationId && s.active);
  const set = (i: number, patch: Partial<StockItemDraft>) => onChange(drafts.map((d, j) => (j === i ? { ...d, ...patch } : d)));
  const resolved = resolveStockItems(drafts, totalCents, (id) => app.supply(id));
  if (supplies.length === 0) {
    return (
      <Note boxed icon="silo" title="Cadastre o insumo primeiro">
        <AppText variant="caption" tone="muted">
          {app.canSeeFinance(operationId) ? 'Ex.: Sal mineral, controlado em sacos, com 1 t = 40 sacos.' : 'Peça a um sócio para cadastrar os insumos.'}
        </AppText>
        {app.canSeeFinance(operationId) ? <Button title="Cadastrar insumo" variant="secondary" icon="plus" onPress={() => router.push('/estoque/insumo')} /> : null}
      </Note>
    );
  }
  return (
    <View style={styles.items}>
      {drafts.map((d, i) => {
        const supply = d.supplyId ? app.supply(d.supplyId) : undefined;
        const units = supply ? [supply.unit, ...supply.conversions.map((c) => c.unit)] : [];
        const qty = parseDecimal(d.quantityText) ?? 0;
        const converted = supply ? toControlUnits(supply, qty, d.unit ?? supply.unit) : null;
        return (
          <Card key={i} style={styles.item}>
            <View style={styles.row}>
              <AppText variant="bodyStrong" style={styles.flex}>{`Item ${i + 1}`}</AppText>
              {drafts.length > 1 ? <IconButton icon="close" accessibilityLabel={`Remover item ${i + 1}`} onPress={() => onChange(drafts.filter((_, j) => j !== i))} /> : null}
            </View>
            <ChipWrap>
              {supplies.map((s) => (
                <Chip key={s.id} label={s.name} selected={d.supplyId === s.id} onPress={() => set(i, { supplyId: s.id, unit: s.unit })} />
              ))}
            </ChipWrap>
            {supply ? (
              <>
                <FormField
                  label="Quantidade comprada"
                  hint={converted !== null && (d.unit ?? supply.unit) !== supply.unit && qty > 0 ? `= ${formatQty(converted, supply.unit)} no estoque` : undefined}>
                  <FieldInput value={d.quantityText} onChangeText={(quantityText) => set(i, { quantityText })} keyboardType="decimal-pad" placeholder="Ex.: 12" />
                </FormField>
                {units.length > 1 ? (
                  <ChipWrap>
                    {units.map((u) => (
                      <Chip key={u} label={UNIT_LABEL[u]?.[1] ?? u} selected={(d.unit ?? supply.unit) === u} onPress={() => set(i, { unit: u })} />
                    ))}
                  </ChipWrap>
                ) : null}
                <FormField label="Valor do item">
                  <MoneyInput cents={d.cents} onChange={(cents) => set(i, { cents })} accessibilityLabel={`Valor do item ${i + 1}`} />
                </FormField>
              </>
            ) : null}
          </Card>
        );
      })}
      <Button title="Adicionar outro insumo" variant="ghost" icon="plus" onPress={() => onChange([...drafts, { supplyId: null, quantityText: '', unit: null, cents: 0 }])} />
      {resolved.error && drafts.some((d) => d.supplyId) ? (
        <AppText variant="caption" tone="danger">
          {resolved.error}
        </AppText>
      ) : null}
      <AppText variant="caption" tone="muted">
        A compra entra no estoque e vira conta a pagar. Os lotes só recebem o custo quando o consumo for apontado.
      </AppText>
    </View>
  );
}
