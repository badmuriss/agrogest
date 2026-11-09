import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { FieldInput, FormField } from '@/components/fields';
import { Button, Chip, ChipWrap, IconButton, Note, SwitchRow } from '@/components/ui/controls';
import { EmptyState, Screen, Section } from '@/components/ui/layout';
import { haptics } from '@/components/ui/motion';
import { AppText } from '@/components/ui/text';
import { formatNumber, parseDecimal } from '@/domain/format';
import { SUPPLY_KIND_LABEL, SUPPLY_UNITS, supplyErrors, UNIT_LABEL, type SupplyInput } from '@/domain/stock';
import type { SupplyKind } from '@/domain/types';
import { useApp } from '@/state/app-state';
import { space } from '@/theme';

const KINDS = Object.keys(SUPPLY_KIND_LABEL) as SupplyKind[];
const unitName = (unit: string) => UNIT_LABEL[unit]?.[0] ?? unit;

/**
 * Cadastro do insumo: unidade de controle do saldo (ex.: saco) e conversões da compra (ex.:
 * 1 t = 40 sacos). A unidade de controle não muda depois que o insumo tiver movimentos.
 */
export default function EditarInsumoScreen() {
  const app = useApp();
  const params = useLocalSearchParams<{ id?: string }>();
  const current = params.id ? app.supplies.find((s) => s.id === params.id) : undefined;
  const operationId = current?.operationId ?? app.scopedFarms.find((f) => app.canSeeFinance(f.operationId))?.operationId ?? '';
  const [name, setName] = useState(current?.name ?? '');
  const [kind, setKind] = useState<SupplyKind>(current?.kind ?? 'sal_mineral');
  const [unit, setUnit] = useState(current?.unit ?? 'saco');
  const [conversions, setConversions] = useState<{ unit: string; factor: string }[]>(
    () => current?.conversions.map((c) => ({ unit: c.unit, factor: formatNumber(c.factor, 4) })) ?? [],
  );
  const [minText, setMinText] = useState(current?.minQuantity !== null && current?.minQuantity !== undefined ? formatNumber(current.minQuantity, 3) : '');
  const [active, setActive] = useState(current?.active ?? true);
  const [tried, setTried] = useState(false);
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);

  if (!operationId || !app.canSeeFinance(operationId) || (params.id && !current)) {
    return (
      <Screen>
        <EmptyState icon="lock-outline" title="Cadastro por um sócio" message="Peça a um sócio para cadastrar ou editar insumos." />
      </Screen>
    );
  }

  const input: SupplyInput = {
    name,
    kind,
    unit,
    conversions: conversions.map((c) => ({ unit: c.unit, factor: parseDecimal(c.factor) ?? 0 })),
    minQuantity: minText.trim() ? parseDecimal(minText) : null,
    active,
  };
  const error = supplyErrors(input, app.supplies.filter((s) => s.operationId === operationId && s.id !== current?.id));
  const freeUnits = SUPPLY_UNITS.filter((u) => u !== unit && !conversions.some((c) => c.unit === u));
  const save = async () => {
    setTried(true);
    setFailure(null);
    if (error) return;
    setBusy(true);
    try {
      await app.saveSupply(operationId, input, current?.id);
      haptics.success();
      router.back();
    } catch (e) {
      setFailure(e instanceof Error ? e.message : 'Não foi possível salvar o insumo.');
      setBusy(false);
    }
  };

  return (
    <Screen footer={<Button title={busy ? 'Salvando…' : current ? 'Salvar alterações' : 'Cadastrar insumo'} icon="check" size="lg" disabled={busy} onPress={save} />}>
      <FormField label="Nome">
        <FieldInput value={name} onChangeText={setName} placeholder="Ex.: Sal mineral 80" maxLength={100} autoCapitalize="sentences" />
      </FormField>
      <FormField label="Tipo">
        <ChipWrap>
          {KINDS.map((k) => (
            <Chip key={k} label={SUPPLY_KIND_LABEL[k]} selected={kind === k} onPress={() => setKind(k)} />
          ))}
        </ChipWrap>
      </FormField>
      <FormField label="Controlar o saldo em" hint="A unidade em que você aponta o consumo no dia a dia.">
        <ChipWrap>
          {SUPPLY_UNITS.map((u) => (
            <Chip key={u} label={unitName(u)} selected={unit === u} onPress={() => { setUnit(u); setConversions(conversions.filter((c) => c.unit !== u)); }} />
          ))}
        </ChipWrap>
      </FormField>

      <Section title="Conversões da compra (opcional)">
        <AppText variant="caption" tone="muted">
          {`Se a compra vem em outra unidade, diga quanto ela vale em ${UNIT_LABEL[unit]?.[1] ?? unit}. Ex.: 1 t = 40 sacos de 25 kg.`}
        </AppText>
        {conversions.map((c, i) => (
          <View key={c.unit} style={styles.conversion}>
            <AppText variant="bodyStrong">{`1 ${unitName(c.unit)} =`}</AppText>
            <View style={styles.flex}>
              <FieldInput
                accessibilityLabel={`Quantos ${UNIT_LABEL[unit]?.[1] ?? unit} tem 1 ${unitName(c.unit)}`}
                value={c.factor}
                onChangeText={(factor) => setConversions(conversions.map((x, j) => (j === i ? { ...x, factor } : x)))}
                keyboardType="decimal-pad"
                suffix={UNIT_LABEL[unit]?.[1] ?? unit}
              />
            </View>
            <IconButton icon="close" accessibilityLabel={`Remover ${unitName(c.unit)}`} onPress={() => setConversions(conversions.filter((_, j) => j !== i))} />
          </View>
        ))}
        {freeUnits.length > 0 ? (
          <ChipWrap>
            {freeUnits.map((u) => (
              <Chip key={u} label={`+ ${unitName(u)}`} onPress={() => setConversions([...conversions, { unit: u, factor: '' }])} />
            ))}
          </ChipWrap>
        ) : null}
      </Section>

      <FormField label="Estoque mínimo por fazenda (opcional)" hint="Abaixo disso, o app avisa que está na hora de comprar.">
        <FieldInput value={minText} onChangeText={setMinText} keyboardType="decimal-pad" suffix={UNIT_LABEL[unit]?.[1] ?? unit} placeholder="Ex.: 20" />
      </FormField>
      {current ? (
        <SwitchRow label="Insumo ativo" description={active ? 'Aparece nas compras e nos consumos.' : 'Sai das escolhas; o saldo e o histórico continuam.'} value={active} onValueChange={setActive} />
      ) : null}
      {failure ? (
        <Note boxed tone="danger" icon="alert-circle-outline" title="Não foi possível salvar">
          {failure}
        </Note>
      ) : tried && error ? (
        <Note boxed tone="warning" icon="alert-outline">
          {error}
        </Note>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  conversion: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  flex: { flex: 1 },
});
