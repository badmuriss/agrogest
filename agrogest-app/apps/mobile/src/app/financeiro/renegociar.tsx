import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { FieldInput, FormField, MoneyInput, ToggleGroup } from '@/components/fields';
import { dueText } from '@/components/finance-ui';
import { Button, Chip, ChipWrap, Note } from '@/components/ui/controls';
import { DateField } from '@/components/ui/form';
import { Card, Divider, EmptyState, KV, Screen, Section } from '@/components/ui/layout';
import { haptics } from '@/components/ui/motion';
import { AppText } from '@/components/ui/text';
import { monthlyInstallments } from '@/domain/allocation';
import { formatDate } from '@/domain/dates';
import type { InstallmentView } from '@/domain/finance';
import { formatCents } from '@/domain/format';
import { renegotiationDelta, renegotiationErrors } from '@/domain/treasury';
import { useApp } from '@/state/app-state';
import { space } from '@/theme';

type Mode = 'renegociar' | 'cancelar';

/**
 * Renegociação de uma ou mais parcelas da mesma operação e direção: muda vencimento ou valor,
 * divide ou agrupa. O que já foi pago fica; o restante vira as parcelas novas. Cancelar encerra
 * a parcela no que já foi pago (perdão, desistência). Sempre com motivo; nada é apagado.
 */
export default function RenegociarScreen() {
  const app = useApp();
  const params = useLocalSearchParams<{ parcelas?: string }>();
  const views = (params.parcelas ?? '')
    .split(',')
    .filter(Boolean)
    .map((id) => app.allInstallments.find((v) => v.id === id))
    .filter((v): v is InstallmentView => v !== undefined && v.openCents > 0 && v.source !== 'fatura' && !v.renegotiatedBy);
  const open = views.reduce((acc, v) => acc + v.openCents, 0);
  const [mode, setMode] = useState<Mode>('renegociar');
  const [total, setTotal] = useState(open);
  const [count, setCount] = useState(1);
  const [firstDue, setFirstDue] = useState(views[0]?.dueDate && views[0].dueDate > app.today ? views[0].dueDate : app.today);
  const [reason, setReason] = useState('');
  const [tried, setTried] = useState(false);
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);

  const operationId = views[0]?.operationId ?? '';
  if (views.length === 0 || !app.canSeeFinance(operationId)) {
    return (
      <Screen>
        <EmptyState icon="calendar-edit" title="Nada para renegociar" message="As parcelas escolhidas já foram quitadas ou renegociadas." />
      </Screen>
    );
  }

  const installments = mode === 'cancelar' ? [] : monthlyInstallments(total, count, firstDue);
  const input = { operationId, items: views.map((v) => ({ entryId: v.entryId, index: v.index })), installments, reason };
  const error = renegotiationErrors(input, app.allInstallments) ?? (mode === 'renegociar' && total <= 0 ? 'Informe o novo valor.' : null);
  const delta = renegotiationDelta(installments, open);
  const pagar = views[0].direction === 'pagar';

  const save = async () => {
    setTried(true);
    setFailure(null);
    if (error) return;
    setBusy(true);
    try {
      await app.renegotiate(input);
      haptics.success();
      router.back();
    } catch (e) {
      setFailure(e instanceof Error ? e.message : 'Não foi possível renegociar.');
      setBusy(false);
    }
  };

  return (
    <Screen
      footer={
        <Button
          title={busy ? 'Salvando…' : mode === 'cancelar' ? 'Cancelar parcelas' : 'Salvar renegociação'}
          icon="check"
          size="lg"
          variant={mode === 'cancelar' ? 'danger' : 'primary'}
          disabled={busy}
          onPress={save}
        />
      }>
      <Section title={views.length > 1 ? `${views.length} parcelas` : 'Parcela'}>
        {views.map((v) => (
          <Card key={v.id} style={styles.card}>
            <AppText variant="bodyStrong">
              {v.title}
              {v.count > 1 ? ` · ${v.position}/${v.count}` : ''}
            </AppText>
            <AppText variant="caption" tone="muted">
              {[v.counterparty || null, dueText(v), `${formatCents(v.openCents)} em aberto`, v.paidCents > 0 ? `${formatCents(v.paidCents)} já pago` : null].filter(Boolean).join(' · ')}
            </AppText>
          </Card>
        ))}
      </Section>

      <ToggleGroup<Mode>
        accessibilityLabel="O que fazer"
        options={[
          { value: 'renegociar', label: 'Novas condições' },
          { value: 'cancelar', label: 'Cancelar' },
        ]}
        value={mode}
        onChange={setMode}
      />

      {mode === 'renegociar' ? (
        <>
          <FormField label="Novo total" hint={`Em aberto hoje: ${formatCents(open)}.`}>
            <MoneyInput cents={total} onChange={setTotal} accessibilityLabel="Novo total" />
          </FormField>
          <FormField label="Parcelas">
            <ChipWrap>
              {[1, 2, 3, 4, 5, 6, 10, 12].map((n) => (
                <Chip key={n} label={n === 1 ? 'Uma só' : `${n}x`} selected={count === n} onPress={() => setCount(n)} />
              ))}
            </ChipWrap>
          </FormField>
          <DateField label={count > 1 ? 'Primeiro vencimento' : 'Novo vencimento'} value={firstDue} onChange={setFirstDue} />
          <Card>
            {installments.map((item, i) => (
              <KV key={i} label={`${count > 1 ? `${i + 1}ª · ` : ''}${formatDate(item.dueDate)}`} value={formatCents(item.cents)} />
            ))}
            {delta !== 0 ? (
              <>
                <Divider />
                <KV
                  label={delta > 0 ? 'Acréscimo (juros)' : 'Desconto obtido'}
                  value={formatCents(Math.abs(delta))}
                  hint={pagar ? (delta > 0 ? 'despesa financeira' : 'receita financeira') : delta > 0 ? 'receita financeira' : 'despesa financeira'}
                />
              </>
            ) : null}
          </Card>
        </>
      ) : (
        <Note icon="alert-outline" tone="warning">
          {pagar
            ? `A parcela fica encerrada no que já foi pago. ${formatCents(open)} deixam de ser devidos (perdão ou acordo) e entram como desconto no resultado financeiro.`
            : `A parcela fica encerrada no que já foi recebido. ${formatCents(open)} não serão recebidos e entram como perda no resultado financeiro.`}
        </Note>
      )}

      <FormField label="Motivo" hint="Fica no histórico, com o seu nome e a data.">
        <FieldInput value={reason} onChangeText={setReason} maxLength={500} multiline placeholder="Ex.: fornecedor aceitou prorrogar por 30 dias" />
      </FormField>
      <View style={styles.card}>
        <AppText variant="caption" tone="faint">
          A competência não muda: a despesa ou a venda continua na data em que aconteceu. Dá para desfazer enquanto nenhuma parcela nova for paga.
        </AppText>
      </View>
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
  card: { gap: space.sm },
});
