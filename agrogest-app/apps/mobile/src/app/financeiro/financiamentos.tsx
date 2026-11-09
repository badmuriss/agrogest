import { router } from 'expo-router';

import { Button } from '@/components/ui/controls';
import { EmptyState, Group, ListRow, Screen } from '@/components/ui/layout';
import { AppText } from '@/components/ui/text';
import { formatDate } from '@/domain/dates';
import { FINANCING_LINE_LABEL } from '@/domain/finance';
import { formatCents } from '@/domain/format';
import { financingSummary } from '@/domain/treasury';
import { useApp } from '@/state/app-state';

/** Financiamentos e empréstimos rurais das fazendas do contexto. */
export default function FinanciamentosScreen() {
  const app = useApp();
  const farmIds = new Set(app.scopedFarms.map((f) => f.id));
  const list = app.financings.filter((f) => farmIds.has(f.farmId));
  const operationId = app.scopedFarms.find((f) => app.canSeeFinance(f.operationId))?.operationId;

  return (
    <Screen
      footer={
        operationId ? (
          <Button title="Cadastrar financiamento" icon="plus" size="lg" onPress={() => router.push({ pathname: '/financeiro/financiamento/novo', params: { operacao: operationId } })} />
        ) : undefined
      }>
      {list.length === 0 ? (
        <EmptyState
          icon="bank-transfer-in"
          title="Nenhum financiamento"
          message="Custeio, investimento, Pronamp: a liberação entra no caixa sem ser receita, a amortização sai sem ser custo e os juros são despesa financeira."
        />
      ) : (
        <Group>
          {list.map((f) => {
            const s = financingSummary(f, app.movements, app.allInstallments);
            return (
              <ListRow
                key={f.id}
                icon="bank-transfer-in"
                title={`${f.bank} · ${FINANCING_LINE_LABEL[f.line]}`}
                subtitle={
                  <AppText variant="caption" tone="muted">
                    {`Saldo devedor ${formatCents(s.outstandingCents)}${s.toReleaseCents > 0 ? ` · ${formatCents(s.toReleaseCents)} a liberar` : ''}${s.nextDue ? ` · próxima ${formatDate(s.nextDue.dueDate)}` : ''}`}
                  </AppText>
                }
                onPress={() => router.push({ pathname: '/financeiro/financiamento/[id]', params: { id: f.id } })}
              />
            );
          })}
        </Group>
      )}
    </Screen>
  );
}
