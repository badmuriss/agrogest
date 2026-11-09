import { router, Stack, useLocalSearchParams } from 'expo-router';

import { InstallmentRow } from '@/components/finance-ui';
import { Button } from '@/components/ui/controls';
import { Card, Divider, EmptyState, Group, KV, ListRow, Screen, Section } from '@/components/ui/layout';
import { AppText } from '@/components/ui/text';
import { formatDate } from '@/domain/dates';
import { FINANCING_LINE_LABEL } from '@/domain/finance';
import { formatCents, formatNumber } from '@/domain/format';
import { financingSummary } from '@/domain/treasury';
import { useApp } from '@/state/app-state';

/** Contrato, liberações e parcelas do financiamento, com o saldo devedor. */
export default function FinanciamentoScreen() {
  const app = useApp();
  const { id } = useLocalSearchParams<{ id: string }>();
  const financing = app.financings.find((f) => f.id === id);
  if (!financing) {
    return (
      <Screen>
        <EmptyState icon="bank-transfer-in" title="Financiamento indisponível" message="Somente os sócios da operação veem os financiamentos." />
      </Screen>
    );
  }
  const s = financingSummary(financing, app.movements, app.allInstallments);
  const installments = app.allInstallments
    .filter((v) => v.entryId === financing.id || app.renegotiations.some((r) => r.id === v.entryId && r.items.some((i) => i.entryId === financing.id)))
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  const releases = app.movements.filter((m) => m.financingId === financing.id);

  return (
    <Screen
      footer={
        s.toReleaseCents > 0 ? (
          <Button
            title={`Registrar liberação · ${formatCents(s.toReleaseCents)}`}
            icon="bank-transfer-in"
            size="lg"
            onPress={() => router.push({ pathname: '/financeiro/movimentar', params: { tipo: 'liberacao', financiamento: financing.id, valor: String(s.toReleaseCents) } })}
          />
        ) : undefined
      }>
      <Stack.Screen options={{ title: financing.bank }} />
      <Card>
        <KV label="Saldo devedor" value={formatCents(s.outstandingCents)} strong hint="liberado − amortizado" />
        <KV label="Contratado" value={formatCents(financing.releasedCents)} />
        <KV label="Liberado" value={formatCents(s.releasedCents)} />
        <KV label="Amortizado" value={formatCents(s.principalPaidCents)} />
        <KV label="Juros pagos" value={formatCents(s.interestPaidCents)} hint={`de ${formatCents(s.interestCents)} previstos`} />
        <Divider />
        <KV label="Linha" value={FINANCING_LINE_LABEL[financing.line]} />
        {financing.contract ? <KV label="Contrato" value={financing.contract} /> : null}
        {financing.ratePct !== null ? <KV label="Taxa" value={`${formatNumber(financing.ratePct, 2)}% ao ano`} /> : null}
        {financing.graceMonths > 0 ? <KV label="Carência" value={`${financing.graceMonths} meses`} /> : null}
        {financing.guarantees ? <KV label="Garantias" value={financing.guarantees} /> : null}
        <KV label="Fazenda" value={app.farm(financing.farmId)?.name ?? ''} />
      </Card>
      <Section title="Parcelas">
        <Group>
          {installments.map((v) => (
            <InstallmentRow key={v.id} view={v} />
          ))}
        </Group>
        <AppText variant="caption" tone="faint">Cada parcela é conta a pagar e entra nos avisos de vencimento. Os juros vão para o resultado financeiro; a amortização, não.</AppText>
      </Section>
      {releases.length > 0 ? (
        <Section title="Liberações">
          <Group>
            {releases.map((m) => (
              <ListRow
                key={m.id}
                icon="bank-transfer-in"
                title={`${formatDate(m.occurredAt)} · ${formatCents(m.cents)}`}
                subtitle={app.accounts.find((a) => a.id === m.toAccountId)?.name}
                onPress={() => router.push({ pathname: '/financeiro/movimento/[id]', params: { id: m.id } })}
              />
            ))}
          </Group>
        </Section>
      ) : null}
    </Screen>
  );
}
