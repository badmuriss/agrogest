import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { FieldInput, FormField } from '@/components/fields';
import { PAYMENT_STATUS } from '@/components/finance-ui';
import { Button, Note, StatusText } from '@/components/ui/controls';
import { Card, Divider, EmptyState, KV, Screen } from '@/components/ui/layout';
import { haptics } from '@/components/ui/motion';
import { AppText } from '@/components/ui/text';
import { formatDate } from '@/domain/dates';
import { advanceBalance, METHOD_LABEL } from '@/domain/finance';
import { formatCents } from '@/domain/format';
import { MOVEMENT_LABEL } from '@/domain/treasury';
import { useApp } from '@/state/app-state';
import { space } from '@/theme';

/** Uma movimentação: de onde, para onde, quem registrou e o estorno auditável. */
export default function MovimentoDetalheScreen() {
  const app = useApp();
  const { id } = useLocalSearchParams<{ id: string }>();
  const movement = app.movements.find((m) => m.id === id);
  const [reversing, setReversing] = useState(false);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);

  if (!movement) {
    return (
      <Screen>
        <EmptyState icon="swap-horizontal" title="Movimentação indisponível" message="Somente os sócios da operação veem as movimentações." />
      </Screen>
    );
  }
  const meta = PAYMENT_STATUS[movement.status];
  const account = (accountId: string | null) => app.accounts.find((a) => a.id === accountId)?.name ?? '—';
  const financing = app.financings.find((f) => f.id === movement.financingId);
  const left = movement.kind === 'adiantamento' ? advanceBalance(movement, app.payments) : null;

  const reverse = async () => {
    setBusy(true);
    setFailure(null);
    try {
      await app.reverseMovement(movement.id, reason);
      haptics.success();
      setReversing(false);
    } catch (e) {
      setFailure(e instanceof Error ? e.message : 'Não foi possível estornar.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen>
      <View style={styles.head}>
        <AppText variant="caption" tone="muted">
          {MOVEMENT_LABEL[movement.kind]}
        </AppText>
        <AppText variant="title">{formatCents(movement.cents)}</AppText>
        <StatusText label={meta.label} tone={meta.tone} />
      </View>
      <Card>
        <KV label="Data" value={formatDate(movement.occurredAt)} />
        {movement.fromAccountId ? <KV label="Saiu de" value={account(movement.fromAccountId)} /> : null}
        {movement.toAccountId ? <KV label="Entrou em" value={account(movement.toAccountId)} /> : null}
        {movement.partnerId ? <KV label="Sócio" value={app.userName(movement.partnerId)} /> : null}
        {financing ? <KV label="Financiamento" value={financing.bank} /> : null}
        {movement.counterparty && !financing ? <KV label="Cliente" value={movement.counterparty} /> : null}
        {movement.invoiceMonth ? <KV label="Fatura" value={`${movement.invoiceMonth.slice(5, 7)}/${movement.invoiceMonth.slice(0, 4)}`} /> : null}
        {left !== null ? <KV label="A compensar" value={formatCents(left)} hint="nos recebimentos do cliente" /> : null}
        <Divider />
        <KV label="Forma" value={METHOD_LABEL[movement.method]} />
        {movement.proof ? <KV label="Comprovante" value={movement.proof} /> : null}
        {movement.notes ? <KV label="Observação" value={movement.notes} /> : null}
        <KV label="Registrada por" value={app.userName(movement.authorId)} />
      </Card>
      <Note icon="information-outline">Movimentação muda o saldo das contas, não o resultado: não é receita nem despesa.</Note>
      {movement.status === 'conflito' && movement.conflictReason ? (
        <Note boxed tone="danger" icon="alert-circle-outline">
          {movement.conflictReason}
        </Note>
      ) : null}
      {movement.reverseReason ? (
        <AppText variant="caption" tone="warning">
          {`Estornada por ${app.userName(movement.reversedBy ?? '').split(' ')[0]}: ${movement.reverseReason}`}
        </AppText>
      ) : null}
      {movement.status === 'efetivado' || movement.status === 'conflito' ? (
        reversing ? (
          <View style={styles.head}>
            {movement.status === 'efetivado' ? (
              <FormField label="Motivo do estorno">
                <FieldInput value={reason} onChangeText={setReason} maxLength={500} placeholder="Ex.: transferência em duplicidade" />
              </FormField>
            ) : null}
            <View style={styles.row}>
              <Button title="Voltar" variant="secondary" disabled={busy} onPress={() => setReversing(false)} />
              <Button
                title={movement.status === 'efetivado' ? 'Estornar' : 'Descartar'}
                variant="danger"
                disabled={busy || (movement.status === 'efetivado' && !reason.trim())}
                onPress={() => void reverse()}
                style={styles.grow}
              />
            </View>
          </View>
        ) : (
          <Button
            title={movement.status === 'efetivado' ? 'Estornar' : 'Descartar em conflito'}
            variant="ghost"
            icon="undo-variant"
            onPress={() => {
              setReversing(true);
              setReason('');
              setFailure(null);
            }}
          />
        )
      ) : null}
      {failure ? (
        <Note boxed tone="danger" icon="alert-circle-outline">
          {failure}
        </Note>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  head: { gap: space.xs },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  grow: { flexGrow: 2 },
});
