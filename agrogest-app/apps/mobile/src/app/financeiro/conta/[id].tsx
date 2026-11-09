import { router, Stack, useLocalSearchParams } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { PAYMENT_STATUS } from '@/components/finance-ui';
import { Button, Note, StatusText } from '@/components/ui/controls';
import { Card, Divider, EmptyState, Group, KV, ListRow, Screen, Section } from '@/components/ui/layout';
import { AppText } from '@/components/ui/text';
import { formatDate } from '@/domain/dates';
import { ACCOUNT_KIND_LABEL, installmentId, METHOD_LABEL, paymentTotal, statement, type StatementLine } from '@/domain/finance';
import { formatCents, plural } from '@/domain/format';
import { MOVEMENT_LABEL } from '@/domain/treasury';
import type { Movement, Payment } from '@/domain/types';
import { useApp } from '@/state/app-state';
import { space } from '@/theme';

/**
 * Extrato da conta: saldo inicial, cada baixa e cada movimentação que contam, com o saldo depois de
 * cada uma. No cartão de crédito, as faturas: o que entrou em cada uma e quanto falta pagar.
 */
export default function ContaScreen() {
  const app = useApp();
  const { id } = useLocalSearchParams<{ id: string }>();
  const account = app.accounts.find((a) => a.id === id);
  if (!account) {
    return (
      <Screen>
        <EmptyState icon="bank-off-outline" title="Conta indisponível" />
      </Screen>
    );
  }
  const card = account.kind === 'cartao';
  const lines = statement(account, app.payments, undefined, app.movements).reverse();
  const touches = (m: Movement) => m.fromAccountId === account.id || m.toAccountId === account.id;
  const others: ({ payment: Payment } | { movement: Movement })[] = [
    ...app.payments.filter((p) => p.accountId === account.id && (p.status === 'estornado' || p.status === 'conflito')).map((payment) => ({ payment })),
    ...app.movements.filter((m) => touches(m) && (m.status === 'estornado' || m.status === 'conflito')).map((movement) => ({ movement })),
  ];
  const invoices = app.invoices.filter((i) => i.accountId === account.id).reverse();
  const balance = app.accountBalance(account.id);

  const open = (line: Pick<StatementLine, 'payment' | 'movement'>) => {
    if (line.movement) router.push({ pathname: '/financeiro/movimento/[id]', params: { id: line.movement.id } });
    else if (line.payment) router.push({ pathname: '/financeiro/parcela/[id]', params: { id: installmentId(line.payment.items[0].entryId, line.payment.items[0].index) } });
  };
  const title = (line: Pick<StatementLine, 'payment' | 'movement'>) => {
    if (line.movement) {
      const m = line.movement;
      if (m.kind === 'transferencia') {
        const other = app.accounts.find((a) => a.id === (m.fromAccountId === account.id ? m.toAccountId : m.fromAccountId));
        return m.fromAccountId === account.id ? `Para ${other?.name ?? 'outra conta'}` : `De ${other?.name ?? 'outra conta'}`;
      }
      return `${MOVEMENT_LABEL[m.kind]}${m.partnerId ? ` · ${app.userName(m.partnerId).split(' ')[0]}` : m.counterparty ? ` · ${m.counterparty}` : ''}`;
    }
    const p = line.payment!;
    return `${p.direction === 'pagar' ? (card ? 'Compra' : 'Pagamento') : card ? 'Estorno' : 'Recebimento'} · ${plural(p.items.length, 'parcela', 'parcelas')}`;
  };

  return (
    <Screen
      footer={
        <>
          <Button title="Editar" variant="secondary" icon="pencil-outline" onPress={() => router.push({ pathname: '/financeiro/conta/editar', params: { id: account.id } })} />
          <Button
            title={card ? 'Pagar fatura' : 'Movimentar'}
            icon={card ? 'credit-card-check-outline' : 'swap-horizontal'}
            style={styles.grow}
            onPress={() =>
              router.push({
                pathname: '/financeiro/movimentar',
                params: card ? { tipo: 'transferencia', para: account.id } : { operacao: account.operationId, de: account.id },
              })
            }
          />
        </>
      }>
      <Stack.Screen options={{ title: account.name }} />
      <Card>
        <KV label={card ? 'Fatura em aberto (total)' : 'Saldo hoje'} value={formatCents(card ? Math.max(0, -balance) : balance)} strong />
        <KV label={`${card ? 'Fatura inicial' : 'Saldo inicial'} em ${formatDate(account.openingDate)}`} value={formatCents(account.openingBalanceCents)} />
        <Divider />
        <KV label="Tipo" value={ACCOUNT_KIND_LABEL[account.kind]} />
        {card ? <KV label="Fatura" value={`fecha dia ${account.closingDay} · vence dia ${account.dueDay}`} /> : null}
        {account.bank ? <KV label="Banco" value={[account.bank, account.agency && `ag. ${account.agency}`, account.number && `c/c ${account.number}`].filter(Boolean).join(' · ')} /> : null}
        {!account.active ? <KV label="Situação" value="Inativa" /> : null}
      </Card>

      {card ? (
        <Section title="Faturas">
          {invoices.length === 0 ? (
            <AppText variant="caption" tone="muted">
              Nenhuma compra no cartão ainda. Ao registrar um pagamento, escolha este cartão como conta.
            </AppText>
          ) : (
            <Group>
              {invoices.map((i) => (
                <ListRow
                  key={i.id}
                  icon="credit-card-outline"
                  iconTone={i.openCents > 0 && i.daysToDue < 0 ? 'danger' : i.openCents > 0 ? 'warning' : 'success'}
                  title={
                    <View style={styles.row}>
                      <AppText variant="bodyStrong" style={styles.flex}>{`Fatura ${i.month.slice(5, 7)}/${i.month.slice(0, 4)}`}</AppText>
                      <AppText variant="bodyStrong" numeric>
                        {formatCents(i.openCents > 0 ? i.openCents : i.chargesCents)}
                      </AppText>
                    </View>
                  }
                  subtitle={`${i.closed ? 'Fechou' : 'Fecha'} ${formatDate(i.closingDate)} · vence ${formatDate(i.dueDate)}${i.openCents > 0 ? ` · ${formatCents(i.paidCents)} pago` : ' · paga'}`}
                  onPress={
                    i.openCents > 0
                      ? () => router.push({ pathname: '/financeiro/movimentar', params: { tipo: 'transferencia', para: account.id, fatura: i.month, valor: String(i.openCents) } })
                      : undefined
                  }
                />
              ))}
            </Group>
          )}
          <Note icon="information-outline">A despesa paga no cartão conta na data da compra; o caixa só muda quando a fatura é paga.</Note>
        </Section>
      ) : null}

      <Section title={lines.length > 0 ? plural(lines.length, 'movimento', 'movimentos') : 'Movimentos'}>
        {lines.length === 0 ? (
          <AppText variant="caption" tone="muted">
            Nenhuma baixa nesta conta ainda.
          </AppText>
        ) : (
          <Group>
            {lines.map((line) => (
              <ListRow
                key={line.id}
                icon={line.movement ? 'swap-horizontal' : line.cents >= 0 ? 'arrow-down-bold-circle-outline' : 'arrow-up-bold-circle-outline'}
                iconTone={line.cents >= 0 ? 'success' : 'neutral'}
                title={
                  <View style={styles.row}>
                    <AppText variant="bodyStrong" style={styles.flex} numberOfLines={1}>
                      {title(line)}
                    </AppText>
                    <AppText variant="bodyStrong" numeric tone={line.cents >= 0 ? 'success' : 'default'}>
                      {`${line.cents >= 0 ? '+' : '−'} ${formatCents(Math.abs(line.cents))}`}
                    </AppText>
                  </View>
                }
                subtitle={
                  <View style={styles.row}>
                    <AppText variant="caption" tone="muted" style={styles.flex}>
                      {`${formatDate(line.date)} · ${METHOD_LABEL[(line.payment ?? line.movement)!.method]}`}
                    </AppText>
                    <AppText variant="caption" tone="muted" numeric>
                      {`saldo ${formatCents(line.balanceCents)}`}
                    </AppText>
                  </View>
                }
                onPress={() => open(line)}
              />
            ))}
          </Group>
        )}
      </Section>
      {others.length > 0 ? (
        <Section title="Fora do saldo">
          <Group>
            {others.map((x) => {
              const status = 'payment' in x ? x.payment.status : x.movement.status;
              const date = 'payment' in x ? x.payment.paidAt : x.movement.occurredAt;
              const cents = 'payment' in x ? paymentTotal(x.payment) : x.movement.cents;
              return (
                <ListRow
                  key={'payment' in x ? x.payment.id : x.movement.id}
                  icon="cash-remove"
                  title={`${formatDate(date)} · ${formatCents(Math.abs(cents))}`}
                  subtitle={'movement' in x ? MOVEMENT_LABEL[x.movement.kind] : undefined}
                  right={<StatusText label={PAYMENT_STATUS[status].label} tone={PAYMENT_STATUS[status].tone} />}
                  onPress={() => open(x)}
                />
              );
            })}
          </Group>
        </Section>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  flex: { flex: 1 },
  grow: { flexGrow: 2 },
});
