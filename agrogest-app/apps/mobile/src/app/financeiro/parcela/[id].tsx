import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { FieldInput, FormField } from '@/components/fields';
import { dueText, PAYMENT_STATUS, STATE_TONE } from '@/components/finance-ui';
import { Button, Note, StatusText } from '@/components/ui/controls';
import { Card, Divider, EmptyState, Group, KV, ListRow, Screen, Section } from '@/components/ui/layout';
import { haptics } from '@/components/ui/motion';
import { AppText } from '@/components/ui/text';
import { formatDate } from '@/domain/dates';
import { installmentId, METHOD_LABEL, paymentTotal, STATE_LABEL } from '@/domain/finance';
import { undoRenegotiationBlock } from '@/domain/treasury';
import { formatCents } from '@/domain/format';
import type { Payment } from '@/domain/types';
import { useApp } from '@/state/app-state';
import { space } from '@/theme';

/** Uma parcela: quanto falta, as baixas que a citam e o estorno auditável de cada uma. */
export default function ParcelaScreen() {
  const app = useApp();
  const { id } = useLocalSearchParams<{ id: string }>();
  const view = app.allInstallments.find((v) => v.id === id);
  const [reversing, setReversing] = useState<string | null>(null);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);

  if (!view || !app.canSeeFinance(view.operationId)) {
    return (
      <Screen>
        <EmptyState icon="cash-remove" title="Parcela indisponível" message="Ela pode ter sido de um lançamento recusado, ou você não é sócio desta operação." />
      </Screen>
    );
  }

  const reverse = async (payment: Payment) => {
    setBusy(true);
    setFailure(null);
    try {
      await app.reversePayment(payment.id, reason);
      haptics.success();
      setReversing(null);
      setReason('');
    } catch (e) {
      setFailure(e instanceof Error ? e.message : 'Não foi possível estornar.');
    } finally {
      setBusy(false);
    }
  };

  const share = (payment: Payment) =>
    payment.items.find((i) => installmentId(i.entryId, i.index) === view.id)?.cents ?? 0;
  const farm = app.farm(view.farmId);
  const sourceOf = (payment: Payment) =>
    payment.partnerId
      ? `Pago por ${app.userName(payment.partnerId).split(' ')[0]} (${payment.partnerMode === 'aporte' ? 'aporte' : 'reembolso'})`
      : payment.advanceId
        ? 'Compensou adiantamento'
        : app.accounts.find((a) => a.id === payment.accountId)?.name;
  const closedBy = view.renegotiatedBy ? app.renegotiations.find((r) => r.id === view.renegotiatedBy) : undefined;
  const ownReneg = view.source === 'renegociacao' ? app.renegotiations.find((r) => r.id === view.entryId) : undefined;
  const undoBlock = ownReneg ? undoRenegotiationBlock(ownReneg, app.allInstallments) : 'none';

  const undo = async () => {
    if (!ownReneg) return;
    setBusy(true);
    setFailure(null);
    try {
      await app.undoRenegotiation(ownReneg.id, reason);
      haptics.success();
      router.back();
    } catch (e) {
      setFailure(e instanceof Error ? e.message : 'Não foi possível desfazer.');
      setBusy(false);
    }
  };

  if (view.source === 'fatura') {
    const [, accountId, month] = view.id.split(':');
    return (
      <Screen
        footer={
          view.openCents > 0 ? (
            <Button
              title="Pagar fatura"
              icon="credit-card-check-outline"
              size="lg"
              onPress={() => router.push({ pathname: '/financeiro/movimentar', params: { tipo: 'transferencia', para: accountId, fatura: month, valor: String(view.openCents) } })}
            />
          ) : undefined
        }>
        <View style={styles.head}>
          <AppText variant="caption" tone="muted">Fatura do cartão</AppText>
          <AppText variant="title">{view.title}</AppText>
          <StatusText label={STATE_LABEL[view.state]} tone={STATE_TONE[view.state]} />
        </View>
        <Card>
          <KV label="Compras no ciclo" value={formatCents(view.cents)} />
          <KV label="Já pago" value={formatCents(view.paidCents)} />
          <KV label="Em aberto" value={formatCents(view.openCents)} strong />
          <Divider />
          <KV label="Fechamento" value={formatDate(view.occurredAt)} />
          <KV label="Vencimento" value={formatDate(view.dueDate)} hint={view.openCents > 0 ? dueText(view) : undefined} />
        </Card>
        <Group>
          <ListRow icon="credit-card-outline" title="Ver o cartão" subtitle="Compras e faturas" onPress={() => router.push({ pathname: '/financeiro/conta/[id]', params: { id: accountId } })} />
        </Group>
        <Note icon="information-outline">A fatura se paga com uma transferência de outra conta para o cartão. As despesas continuam na data de cada compra.</Note>
      </Screen>
    );
  }

  return (
    <Screen
      footer={
        view.openCents > 0 ? (
          <>
            <Button
              title="Renegociar"
              variant="secondary"
              icon="calendar-edit"
              onPress={() => router.push({ pathname: '/financeiro/renegociar', params: { parcelas: view.id } })}
            />
            <Button
              title={view.direction === 'pagar' ? 'Registrar pagamento' : 'Registrar recebimento'}
              icon="check"
              style={styles.grow}
              onPress={() => router.push({ pathname: '/financeiro/baixa', params: { parcelas: view.id, direcao: view.direction } })}
            />
          </>
        ) : undefined
      }>
      <View style={styles.head}>
        <AppText variant="caption" tone="muted">
          {view.direction === 'pagar' ? 'Conta a pagar' : 'Conta a receber'}
          {view.count > 1 ? ` · parcela ${view.position} de ${view.count}` : ''}
        </AppText>
        <AppText variant="title">{view.title}</AppText>
        <StatusText label={STATE_LABEL[view.state]} tone={STATE_TONE[view.state]} />
      </View>

      {closedBy ? (
        <Note boxed icon="calendar-edit" title={closedBy.installments.length === 0 ? 'Parcela cancelada' : 'Parcela renegociada'}>
          <AppText variant="caption" tone="muted">
            {`${formatDate(closedBy.createdAt.slice(0, 10))} · ${app.userName(closedBy.authorId).split(' ')[0]}: ${closedBy.reason}`}
          </AppText>
          <AppText variant="caption" tone="muted">
            {closedBy.installments.length === 0
              ? `Ficou encerrada em ${formatCents(view.cents)}, o que já estava pago, de ${formatCents(view.originalCents ?? view.cents)}.`
              : `O que faltava virou ${closedBy.installments.length === 1 ? '1 parcela nova' : `${closedBy.installments.length} parcelas novas`}.`}
          </AppText>
          {closedBy.installments.length > 0 ? (
            <Button
              title="Ver parcelas novas"
              variant="secondary"
              icon="arrow-right"
              onPress={() => router.push({ pathname: '/financeiro/parcela/[id]', params: { id: installmentId(closedBy.id, 0) } })}
            />
          ) : null}
        </Note>
      ) : null}
      <Card>
        <KV label="Valor da parcela" value={formatCents(view.originalCents ?? view.cents)} />
        <KV label={view.direction === 'pagar' ? 'Já pago' : 'Já recebido'} value={formatCents(view.paidCents)} />
        <KV label="Em aberto" value={formatCents(view.openCents)} strong />
        <Divider />
        <KV label="Vencimento" value={formatDate(view.dueDate)} hint={view.openCents > 0 ? dueText(view) : undefined} />
        <KV label="Competência" value={formatDate(view.occurredAt)} hint="quando o fato aconteceu" />
        {view.counterparty ? <KV label={view.direction === 'pagar' ? 'Fornecedor' : 'Cliente'} value={view.counterparty} /> : null}
        {view.categoryName ? <KV label="Categoria" value={view.categoryName} /> : null}
        {farm ? <KV label="Fazenda" value={farm.name} /> : null}
      </Card>
      {view.interestCents ? (
        <Card>
          <KV label="Amortização" value={formatCents(view.cents - view.interestCents)} hint="sai do caixa, não é custo" />
          <KV label="Juros" value={formatCents(view.interestCents)} hint="despesa financeira" />
        </Card>
      ) : null}
      <Group>
        {view.source === 'lote' ? (
          <ListRow icon="cow" title="Ver o lote" subtitle="Dados e pagamento da compra" onPress={() => router.push({ pathname: '/lote/[id]', params: { id: view.entryId } })} />
        ) : view.source === 'lancamento' ? (
          <ListRow icon="file-document-outline" title="Ver o lançamento" subtitle="Aprovação, rateio e histórico" onPress={() => router.push({ pathname: '/lancamento/[id]', params: { id: view.entryId } })} />
        ) : view.source === 'financiamento' ? (
          <ListRow icon="bank-transfer-in" title="Ver o financiamento" subtitle="Contrato, liberações e cronograma" onPress={() => router.push({ pathname: '/financeiro/financiamento/[id]', params: { id: view.entryId } })} />
        ) : view.source === 'reembolso' ? (
          <ListRow icon="account-cash-outline" title="Ver os sócios" subtitle="Aportes, retiradas e reembolsos" onPress={() => router.push('/financeiro/socios')} />
        ) : view.source === 'importacao' ? (
          <ListRow icon="file-table-outline" title="Trazida da planilha" subtitle="Saldo de abertura: não é custo nem receita no app" chevron={false} />
        ) : null}
      </Group>
      {ownReneg ? (
        <Card style={styles.card}>
          <AppText variant="bodyStrong">Renegociação</AppText>
          <AppText variant="caption" tone="muted">
            {`${formatDate(ownReneg.createdAt.slice(0, 10))} · ${app.userName(ownReneg.authorId).split(' ')[0]}: ${ownReneg.reason}`}
          </AppText>
          {ownReneg.items.map((item) => {
            const original = app.allInstallments.find((v) => v.entryId === item.entryId && v.index === item.index);
            return original ? (
              <ListRow
                key={original.id}
                icon="calendar-remove"
                title={`${original.title}${original.count > 1 ? ` · ${original.position}/${original.count}` : ''}`}
                subtitle={`Original ${formatCents(original.originalCents ?? original.cents)} · vencia ${formatDate(original.dueDate)}`}
                onPress={() => router.push({ pathname: '/financeiro/parcela/[id]', params: { id: original.id } })}
              />
            ) : null;
          })}
          {undoBlock === null ? (
            reversing === 'undo' ? (
              <View style={styles.reverse}>
                <FormField label="Motivo">
                  <FieldInput value={reason} onChangeText={setReason} maxLength={500} />
                </FormField>
                <View style={styles.row}>
                  <Button title="Voltar" variant="secondary" disabled={busy} onPress={() => setReversing(null)} />
                  <Button title="Desfazer renegociação" variant="danger" disabled={busy || !reason.trim()} onPress={() => void undo()} style={styles.grow} />
                </View>
              </View>
            ) : (
              <Button title="Desfazer renegociação" variant="ghost" icon="undo-variant" onPress={() => { setReversing('undo'); setReason(''); }} />
            )
          ) : undoBlock !== 'none' ? (
            <AppText variant="caption" tone="faint">{undoBlock}</AppText>
          ) : null}
        </Card>
      ) : null}

      <Section title="Baixas">
        {view.payments.length === 0 ? (
          <AppText variant="caption" tone="muted">
            Nenhuma baixa ainda. O caixa só muda quando o pagamento for registrado.
          </AppText>
        ) : (
          view.payments.map((payment) => {
            const meta = PAYMENT_STATUS[payment.status];
            const extras = payment.interestCents + payment.fineCents - payment.discountCents;
            return (
              <Card key={payment.id} style={styles.card}>
                <View style={styles.row}>
                  <AppText variant="bodyStrong" style={styles.flex}>
                    {formatDate(payment.paidAt)} · {formatCents(share(payment))}
                  </AppText>
                  <StatusText label={meta.label} tone={meta.tone} />
                </View>
                <AppText variant="caption" tone="muted">
                  {[sourceOf(payment), METHOD_LABEL[payment.method], payment.proof ? `Comprovante ${payment.proof}` : null, app.userName(payment.authorId).split(' ')[0]]
                    .filter(Boolean)
                    .join(' · ')}
                </AppText>
                {payment.items.length > 1 || extras !== 0 ? (
                  <AppText variant="caption" tone="muted">
                    {`Baixa de ${formatCents(paymentTotal(payment))} na conta`}
                    {payment.items.length > 1 ? `, junto com outras ${payment.items.length - 1} parcelas` : ''}
                    {payment.interestCents + payment.fineCents > 0 ? `, com ${formatCents(payment.interestCents + payment.fineCents)} de juros e multa` : ''}
                    {payment.discountCents > 0 ? `, ${formatCents(payment.discountCents)} de desconto` : ''}.
                  </AppText>
                ) : null}
                {payment.conflictReason && payment.status === 'conflito' ? (
                  <Note tone="danger" icon="alert-circle-outline">
                    {payment.conflictReason}
                  </Note>
                ) : null}
                {payment.reverseReason ? (
                  <AppText variant="caption" tone="warning">
                    {`Estornada por ${app.userName(payment.reversedBy ?? '').split(' ')[0]}: ${payment.reverseReason}`}
                  </AppText>
                ) : null}
                {payment.status === 'efetivado' || payment.status === 'conflito' ? (
                  reversing === payment.id ? (
                    <View style={styles.reverse}>
                      {payment.status === 'efetivado' ? (
                        <FormField label="Motivo do estorno">
                          <FieldInput value={reason} onChangeText={setReason} placeholder="Ex.: Pix devolvido pelo banco" maxLength={500} />
                        </FormField>
                      ) : null}
                      <View style={styles.row}>
                        <Button title="Voltar" variant="secondary" disabled={busy} onPress={() => setReversing(null)} />
                        <Button
                          title={payment.status === 'efetivado' ? 'Estornar baixa' : 'Descartar'}
                          variant="danger"
                          disabled={busy || (payment.status === 'efetivado' && !reason.trim())}
                          onPress={() => void reverse(payment)}
                          style={styles.grow}
                        />
                      </View>
                    </View>
                  ) : (
                    <Button
                      title={payment.status === 'efetivado' ? 'Estornar' : 'Descartar baixa em conflito'}
                      variant="ghost"
                      icon="undo-variant"
                      onPress={() => { setReversing(payment.id); setReason(''); setFailure(null); }}
                    />
                  )
                ) : null}
              </Card>
            );
          })
        )}
        {failure ? (
          <Note boxed tone="danger" icon="alert-circle-outline">
            {failure}
          </Note>
        ) : null}
        <AppText variant="caption" tone="faint">
          Estornar não apaga: a baixa fica no histórico e a parcela volta a ficar em aberto.
        </AppText>
      </Section>
    </Screen>
  );
}

const styles = StyleSheet.create({
  head: { gap: space.xs },
  card: { gap: space.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  reverse: { gap: space.sm },
  flex: { flex: 1 },
  grow: { flexGrow: 2 },
});
