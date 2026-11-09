import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { MoneyInput } from '@/components/fields';
import { Button, Note } from '@/components/ui/controls';
import { Card, Divider, EmptyState, KV, Section } from '@/components/ui/layout';
import { haptics } from '@/components/ui/motion';
import { AppText } from '@/components/ui/text';
import { monthTitle } from '@/domain/dates';
import { EXPENSE_NATURES } from '@/domain/finance';
import { formatCents } from '@/domain/format';
import { budgetReport } from '@/domain/reports';
import { shiftMonth } from '@/domain/treasury';
import { useApp } from '@/state/app-state';
import { space } from '@/theme';

/** Orçamento do mês por categoria, comparado com o realizado (competência) e a variação. */
export function BudgetReport() {
  const app = useApp();
  const [month, setMonth] = useState(app.today.slice(0, 7));
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState(0);
  const [failure, setFailure] = useState<string | null>(null);
  const operationId = app.scopedFarms.find((f) => app.canSeeFinance(f.operationId))?.operationId;
  if (!operationId) {
    return <EmptyState icon="lock-outline" title="Financeiro dos sócios" message="O orçamento aparece só para os sócios da operação." />;
  }
  const book = app.financeBook(app.scopedFarms.filter((f) => f.operationId === operationId).map((f) => f.id));
  const rows = budgetReport(book, month);
  const categories = app.categories.filter((c) => c.active && EXPENSE_NATURES.includes(c.nature) && (c.operationId === null || c.operationId === operationId));
  const budgeted = rows.reduce((acc, r) => acc + r.budgetCents, 0);
  const actual = rows.reduce((acc, r) => acc + r.actualCents, 0);

  const save = async (categoryId: string) => {
    setFailure(null);
    try {
      await app.setBudget(operationId, categoryId, month, draft);
      haptics.success();
      setEditing(null);
    } catch (e) {
      setFailure(e instanceof Error ? e.message : 'Não foi possível salvar.');
    }
  };
  const copyPrevious = async () => {
    const previous = book.budgets.filter((b) => b.month === shiftMonth(month, -1));
    for (const b of previous) await app.setBudget(operationId, b.categoryId, month, b.cents);
    haptics.success();
  };

  return (
    <>
      <View style={styles.row}>
        <Button title="‹" variant="secondary" onPress={() => setMonth(shiftMonth(month, -1))} />
        <AppText variant="title" style={styles.center}>
          {monthTitle(`${month}-01`)}
        </AppText>
        <Button title="›" variant="secondary" onPress={() => setMonth(shiftMonth(month, 1))} />
      </View>
      <Card>
        <KV label="Orçado" value={formatCents(budgeted)} />
        <KV label="Realizado" value={formatCents(actual)} />
        <Divider />
        <KV label={actual > budgeted ? 'Acima do orçado' : 'Dentro do orçado'} value={formatCents(Math.abs(actual - budgeted))} strong />
      </Card>
      {rows.length === 0 && book.budgets.some((b) => b.month === shiftMonth(month, -1)) ? (
        <Button title="Copiar o orçamento do mês anterior" variant="secondary" icon="content-copy" onPress={() => void copyPrevious()} />
      ) : null}
      <Section title="Categorias">
        {categories.map((c) => {
          const row = rows.find((r) => r.categoryId === c.id);
          const over = row ? row.varianceCents > 0 && row.budgetCents > 0 : false;
          return (
            <Card key={c.id} style={styles.card}>
              <View style={styles.row}>
                <AppText variant="bodyStrong" style={styles.flex}>
                  {c.name}
                </AppText>
                {editing !== c.id ? (
                  <Button
                    title={row?.budgetCents ? 'Editar' : 'Orçar'}
                    variant="ghost"
                    onPress={() => {
                      setEditing(c.id);
                      setDraft(row?.budgetCents ?? 0);
                    }}
                  />
                ) : null}
              </View>
              {editing === c.id ? (
                <View style={styles.row}>
                  <View style={styles.flex}>
                    <MoneyInput cents={draft} onChange={setDraft} accessibilityLabel={`Orçamento de ${c.name}`} />
                  </View>
                  <Button title="Salvar" onPress={() => void save(c.id)} />
                </View>
              ) : (
                <AppText variant="caption" tone={over ? 'danger' : 'muted'}>
                  {`Orçado ${formatCents(row?.budgetCents ?? 0)} · realizado ${formatCents(row?.actualCents ?? 0)}${row && row.budgetCents > 0 ? ` · ${row.varianceCents > 0 ? '+' : ''}${formatCents(row.varianceCents)}` : ''}`}
                </AppText>
              )}
            </Card>
          );
        })}
      </Section>
      {failure ? (
        <Note boxed tone="danger" icon="alert-circle-outline">
          {failure}
        </Note>
      ) : null}
      <AppText variant="caption" tone="faint">Realizado pela competência das despesas aprovadas do mês, nas fazendas do contexto.</AppText>
    </>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  flex: { flex: 1 },
  center: { flex: 1, textAlign: 'center' },
  card: { gap: space.sm },
});
