import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { InstallmentRow } from '@/components/finance-ui';
import { Button, Chip, ChipRow, Note } from '@/components/ui/controls';
import { Card, Divider, EmptyState, Group, KV, ListRow, Screen, Section } from '@/components/ui/layout';
import { AppText } from '@/components/ui/text';
import { formatDate } from '@/domain/dates';
import { formatCents } from '@/domain/format';
import { buildDre, presetPeriod } from '@/domain/reports';
import { distributeByShare, MOVEMENT_LABEL, partnerPositions } from '@/domain/treasury';
import { useApp } from '@/state/app-state';
import { space } from '@/theme';

type Range = 'ano' | '12m' | 'tudo';

/**
 * Conta corrente dos sócios por operação: aportes (inclusive despesas pagas do próprio bolso como
 * aporte), retiradas, lucro distribuído e reembolsos que a operação ainda deve. A sugestão de
 * distribuição divide o resultado real do período pela participação de cada um.
 */
export default function SociosScreen() {
  const app = useApp();
  const [range, setRange] = useState<Range>('ano');
  const operations = [...new Set(app.scopedFarms.filter((f) => app.canSeeFinance(f.operationId)).map((f) => f.operationId))];
  if (operations.length === 0) {
    return (
      <Screen>
        <EmptyState icon="lock-outline" title="Financeiro dos sócios" message="Somente os sócios da operação veem a conta de cada sócio." />
      </Screen>
    );
  }
  const period = range === 'tudo' ? { from: '0000-01-01', to: app.today } : presetPeriod(range, app.today);

  return (
    <Screen>
      <ChipRow>
        {(
          [
            ['ano', 'Este ano'],
            ['12m', '12 meses'],
            ['tudo', 'Desde o início'],
          ] as [Range, string][]
        ).map(([value, label]) => (
          <Chip key={value} label={label} selected={range === value} onPress={() => setRange(value)} />
        ))}
      </ChipRow>
      {operations.map((operationId) => {
        const partners = app.partnersOf(operationId);
        const positions = partnerPositions(operationId, partners, app.payments, app.movements, app.allInstallments, period);
        const farmIds = app.scopedFarms.filter((f) => f.operationId === operationId).map((f) => f.id);
        const dre = buildDre(app.financeBook(farmIds), period);
        const distributed = positions.reduce((acc, p) => acc + p.distributedCents, 0);
        const available = Math.max(0, dre.realResultCents - distributed);
        const suggestion = distributeByShare(available, partners);
        const reimbursements = app.allInstallments.filter((v) => v.operationId === operationId && v.source === 'reembolso' && v.openCents > 0);
        const history = app.movements
          .filter((m) => m.operationId === operationId && m.partnerId && m.occurredAt >= period.from)
          .slice(0, 20);
        return (
          <View key={operationId} style={styles.block}>
            {operations.length > 1 ? <AppText variant="title">{app.operation(operationId)?.name}</AppText> : null}
            {positions.map((p) => (
              <Card key={p.partnerId} style={styles.card}>
                <View style={styles.row}>
                  <AppText variant="bodyStrong" style={styles.flex}>
                    {p.name}
                  </AppText>
                  <AppText variant="caption" tone="muted">
                    {p.sharePct !== null ? `${p.sharePct}%` : 'participação não informada'}
                  </AppText>
                </View>
                <KV label="Aportes" value={formatCents(p.contributedCents)} />
                <KV label="Retiradas" value={`− ${formatCents(p.withdrawnCents)}`} />
                <KV label="Lucro distribuído" value={`− ${formatCents(p.distributedCents)}`} />
                <Divider />
                <KV label="Saldo do sócio" value={formatCents(p.balanceCents)} strong />
                {p.reimbursementOpenCents > 0 ? <KV label="A operação deve a ele" value={formatCents(p.reimbursementOpenCents)} hint="reembolsos" /> : null}
                <View style={styles.row}>
                  <Button title="Aporte" variant="secondary" icon="plus" onPress={() => router.push({ pathname: '/financeiro/movimentar', params: { tipo: 'aporte', operacao: operationId, socio: p.partnerId } })} />
                  <Button title="Retirada" variant="secondary" icon="minus" onPress={() => router.push({ pathname: '/financeiro/movimentar', params: { tipo: 'retirada', operacao: operationId, socio: p.partnerId } })} />
                </View>
              </Card>
            ))}

            <Section title="Distribuição do resultado">
              <Card>
                <KV
                  label={range === 'tudo' ? 'Resultado real até hoje' : `Resultado real · ${formatDate(period.from)} a ${formatDate(period.to)}`}
                  value={formatCents(dre.realResultCents)}
                />
                <KV label="Já distribuído no período" value={formatCents(distributed)} />
                <Divider />
                <KV label="Disponível para distribuir" value={formatCents(available)} strong />
                {available > 0
                  ? partners.map((p) => (
                      <ListRow
                        key={p.id}
                        icon="cash-multiple"
                        title={p.name}
                        subtitle={p.sharePct !== null ? `${p.sharePct}% da participação` : 'em partes iguais'}
                        right={<AppText variant="bodyStrong" numeric>{formatCents(suggestion.get(p.id) ?? 0)}</AppText>}
                        onPress={() =>
                          router.push({
                            pathname: '/financeiro/movimentar',
                            params: { tipo: 'distribuicao', operacao: operationId, socio: p.id, valor: String(suggestion.get(p.id) ?? 0) },
                          })
                        }
                      />
                    ))
                  : null}
              </Card>
              <AppText variant="caption" tone="faint">
                Sugestão pela participação cadastrada em Pessoas. A regra de distribuição ainda será validada com os sócios; distribuir é uma saída de caixa, não muda o resultado.
              </AppText>
            </Section>

            {reimbursements.length > 0 ? (
              <Section title="Reembolsos a pagar">
                <Group>
                  {reimbursements.map((v) => (
                    <InstallmentRow key={v.id} view={v} />
                  ))}
                </Group>
              </Section>
            ) : null}

            {history.length > 0 ? (
              <Section title="Movimentações dos sócios">
                <Group>
                  {history.map((m) => (
                    <ListRow
                      key={m.id}
                      icon={m.kind === 'aporte' ? 'arrow-down-bold-circle-outline' : 'arrow-up-bold-circle-outline'}
                      title={`${MOVEMENT_LABEL[m.kind]} · ${app.userName(m.partnerId ?? '').split(' ')[0]}`}
                      subtitle={formatDate(m.occurredAt)}
                      right={<AppText variant="bodyStrong" numeric>{formatCents(m.cents)}</AppText>}
                      onPress={() => router.push({ pathname: '/financeiro/movimento/[id]', params: { id: m.id } })}
                    />
                  ))}
                </Group>
              </Section>
            ) : (
              <Note icon="information-outline">Aporte, retirada e despesa paga do próprio bolso aparecem aqui. Nenhum deles é receita ou despesa.</Note>
            )}
          </View>
        );
      })}
    </Screen>
  );
}

const styles = StyleSheet.create({
  block: { gap: space.lg },
  card: { gap: space.xs },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  flex: { flex: 1 },
});
