import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { FieldInput, FormField, MoneyInput, ToggleGroup } from '@/components/fields';
import { Button, Chip, ChipWrap, Note, SwitchRow } from '@/components/ui/controls';
import { DateField } from '@/components/ui/form';
import { EmptyState, Screen } from '@/components/ui/layout';
import { haptics } from '@/components/ui/motion';
import { ACCOUNT_KIND_LABEL, accountErrors, type AccountInput } from '@/domain/finance';
import type { AccountKind } from '@/domain/types';
import { useApp } from '@/state/app-state';
import { space } from '@/theme';

const KINDS = Object.keys(ACCOUNT_KIND_LABEL) as AccountKind[];

/** Cadastro e edição de conta financeira, com o saldo de partida. */
export default function EditarContaScreen() {
  const app = useApp();
  const params = useLocalSearchParams<{ id?: string; operacao?: string }>();
  const current = params.id ? app.accounts.find((a) => a.id === params.id) : undefined;
  const operationId = current?.operationId ?? params.operacao ?? app.scopedFarms.find((f) => app.canSeeFinance(f.operationId))?.operationId ?? '';
  const [input, setInput] = useState<AccountInput>(() => ({
    name: current?.name ?? '',
    kind: current?.kind ?? 'corrente',
    bank: current?.bank ?? '',
    agency: current?.agency ?? '',
    number: current?.number ?? '',
    openingBalanceCents: current?.openingBalanceCents ?? 0,
    openingDate: current?.openingDate ?? app.today,
    active: current?.active ?? true,
    closingDay: current?.closingDay ?? null,
    dueDay: current?.dueDay ?? null,
  }));
  const [negative, setNegative] = useState((current?.openingBalanceCents ?? 0) < 0);
  const [tried, setTried] = useState(false);
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);

  if (!operationId || !app.canSeeFinance(operationId) || (params.id && !current)) {
    return (
      <Screen>
        <EmptyState icon="lock-outline" title="Contas dos sócios" message="Somente um sócio da operação cadastra contas." />
      </Screen>
    );
  }

  const set = (patch: Partial<AccountInput>) => setInput({ ...input, ...patch });
  const value: AccountInput = { ...input, openingBalanceCents: Math.abs(input.openingBalanceCents) * (negative ? -1 : 1) };
  const error = accountErrors(value, app.accounts.filter((a) => a.operationId === operationId && a.id !== current?.id));
  const save = async () => {
    setTried(true);
    setFailure(null);
    if (error) return;
    setBusy(true);
    try {
      if (current) await app.updateAccount(current.id, value);
      else await app.createAccount(operationId, value);
      haptics.success();
      router.back();
    } catch (e) {
      setFailure(e instanceof Error ? e.message : 'Não foi possível salvar a conta.');
      setBusy(false);
    }
  };

  return (
    <Screen footer={<Button title={busy ? 'Salvando…' : current ? 'Salvar alterações' : 'Cadastrar conta'} icon="check" size="lg" disabled={busy} onPress={save} />}>
      <FormField label="Nome da conta" error={tried && error?.includes('nome') ? error : null}>
        <FieldInput value={input.name} onChangeText={(name) => set({ name })} placeholder="Ex.: Sicredi da fazenda" maxLength={100} autoCapitalize="sentences" />
      </FormField>
      <FormField label="Tipo">
        <ChipWrap>
          {KINDS.map((k) => (
            <Chip key={k} label={ACCOUNT_KIND_LABEL[k]} selected={input.kind === k} onPress={() => set({ kind: k })} />
          ))}
        </ChipWrap>
      </FormField>
      {input.kind !== 'caixa' ? (
        <>
          <FormField label="Banco (opcional)">
            <FieldInput value={input.bank} onChangeText={(bank) => set({ bank })} placeholder="Ex.: Sicredi" maxLength={60} />
          </FormField>
          <View style={styles.row}>
            <View style={styles.flex}>
              <FormField label="Agência (opcional)">
                <FieldInput value={input.agency} onChangeText={(agency) => set({ agency })} keyboardType="number-pad" maxLength={60} />
              </FormField>
            </View>
            <View style={styles.flex}>
              <FormField label="Conta (opcional)">
                <FieldInput value={input.number} onChangeText={(number) => set({ number })} maxLength={60} />
              </FormField>
            </View>
          </View>
        </>
      ) : null}
      {input.kind === 'cartao' ? (
        <>
          <View style={styles.row}>
            <View style={styles.flex}>
              <FormField label="Dia do fechamento">
                <FieldInput
                  value={input.closingDay ? String(input.closingDay) : ''}
                  onChangeText={(t) => set({ closingDay: t ? Number(t.replace(/\D/g, '')) || null : null })}
                  keyboardType="number-pad"
                  maxLength={2}
                  placeholder="1 a 28"
                />
              </FormField>
            </View>
            <View style={styles.flex}>
              <FormField label="Dia do vencimento">
                <FieldInput
                  value={input.dueDay ? String(input.dueDay) : ''}
                  onChangeText={(t) => set({ dueDay: t ? Number(t.replace(/\D/g, '')) || null : null })}
                  keyboardType="number-pad"
                  maxLength={2}
                  placeholder="1 a 28"
                />
              </FormField>
            </View>
          </View>
          <Note icon="credit-card-outline">
            O cartão é dívida, não caixa. Pagar uma conta com ele põe a compra na fatura; a fatura vira conta a pagar e se paga com uma transferência de outra conta para o cartão.
          </Note>
        </>
      ) : null}
      <FormField
        label={input.kind === 'cartao' ? 'Fatura em aberto na data' : 'Saldo inicial'}
        hint={input.kind === 'cartao' ? 'Use "Negativo" para o valor que já está na fatura.' : 'O saldo do extrato nesta data. As baixas somam e subtraem a partir dele.'}>
        <ToggleGroup
          accessibilityLabel="Sinal do saldo"
          options={[
            { value: 'positivo', label: 'Positivo' },
            { value: 'negativo', label: 'Negativo' },
          ]}
          value={negative ? 'negativo' : 'positivo'}
          onChange={(v) => setNegative(v === 'negativo')}
        />
        <MoneyInput cents={Math.abs(input.openingBalanceCents)} onChange={(cents) => set({ openingBalanceCents: cents })} accessibilityLabel="Saldo inicial" />
      </FormField>
      <DateField label="Data do saldo inicial" value={input.openingDate} onChange={(openingDate) => set({ openingDate })} />
      {current ? (
        <SwitchRow
          label="Conta ativa"
          description={input.active ? 'Aparece para novas baixas.' : 'Sai das escolhas; o extrato continua disponível.'}
          value={input.active}
          onValueChange={(active) => set({ active })}
        />
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
  row: { flexDirection: 'row', gap: space.md },
  flex: { flex: 1 },
});
