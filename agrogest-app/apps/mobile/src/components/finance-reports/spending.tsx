import { router } from 'expo-router';
import { useState } from 'react';

import { FormField, ToggleGroup } from '@/components/fields';
import { Button, Chip, ChipWrap, Note } from '@/components/ui/controls';
import { DateField } from '@/components/ui/form';
import { Card, Divider, Group, KV, ListRow, Section } from '@/components/ui/layout';
import { AppText } from '@/components/ui/text';
import { formatDate } from '@/domain/dates';
import { toCsv } from '@/domain/export';
import { formatCents } from '@/domain/format';
import { previousPeriod, spending, spendingDetails, type FinanceBook, type Period, type SpendingDimension } from '@/domain/reports';
import { shareTextFile } from '@/services/file-export';
import { space } from '@/theme';

export function SpendingReport({ book, period }: { book: FinanceBook; period: Period }) {
  const [basis, setBasis] = useState<'competencia' | 'caixa'>('competencia');
  const [dimension, setDimension] = useState<SpendingDimension>('centro');
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [costCenterId, setCostCenterId] = useState<string | null>(null);
  const [custom, setCustom] = useState<Period | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [detailPage, setDetailPage] = useState(0);
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const range = custom ?? period;
  const valid = range.from <= range.to;
  const filter = { basis, categoryId, costCenterId };
  const rows = valid ? spending(book, range, dimension, filter) : [];
  const details = valid ? spendingDetails(book, range, filter) : [];
  const page = Math.min(detailPage, Math.max(0, Math.ceil(details.length / 30) - 1));
  const categories = book.categories.filter((c) => c.operationId === null || (c.operationId && book.operationIds.has(c.operationId)));
  const centers = (book.costCenters ?? []).filter((c) => book.operationIds.has(c.operationId));
  const prev = previousPeriod(range);
  const exportDetails = async () => {
    setBusy(true); setFailure(null);
    try {
      await shareTextFile(`agrogest-gastos-${basis}-${range.from}-${range.to}.csv`, toCsv([
        ['Data', 'Lançamento', 'Categoria', 'Centro de custo', 'Agrupamento', 'Valor', 'ID', 'Baixa', 'Pagamento da fatura'],
        ...details.map((d) => [d.date, d.title, d.category, d.center, d.group, { cents: d.cents }, d.entryId, d.paymentId ?? '', d.movementId ?? '']),
      ]), 'text/csv');
    } catch (e) { setFailure(e instanceof Error ? e.message : 'Não foi possível exportar.'); }
    finally { setBusy(false); }
  };
  return <Section title="Análise de gastos">
    <ToggleGroup accessibilityLabel="Base dos gastos" value={basis} onChange={setBasis} options={[
      { value: 'competencia', label: 'Competência' }, { value: 'caixa', label: 'Pagamentos (caixa)' },
    ]} />
    <Button title={expanded ? 'Recolher filtros' : 'Filtrar período, categoria e centro'} variant="secondary" onPress={() => setExpanded(!expanded)} />
    {expanded ? <Card style={{ gap: space.md }}>
      <DateField label="De" value={range.from} onChange={(from) => setCustom({ ...range, from })} />
      <DateField label="Até" value={range.to} onChange={(to) => setCustom({ ...range, to })} />
      <Button title="Usar período do relatório" variant="ghost" onPress={() => setCustom(null)} />
      <FormField label="Categoria"><ChipWrap>
        <Chip label="Todas" selected={!categoryId} onPress={() => setCategoryId(null)} />
        {categories.map((c) => <Chip key={c.id} label={c.name} selected={categoryId === c.id} onPress={() => setCategoryId(c.id)} />)}
      </ChipWrap></FormField>
      <FormField label="Centro ou agrupamento"><ChipWrap>
        <Chip label="Todos" selected={costCenterId === null} onPress={() => setCostCenterId(null)} />
        <Chip label="Sem centro de custo" selected={costCenterId === ''} onPress={() => setCostCenterId('')} />
        {centers.map((c) => <Chip key={c.id} label={`${c.name}${c.isGroup ? ' (grupo)' : ''}${c.active ? '' : ' (inativo)'}`} selected={costCenterId === c.id} onPress={() => setCostCenterId(c.id)} />)}
      </ChipWrap></FormField>
    </Card> : null}
    <ChipWrap>{([
      ['categoria', 'Categoria'], ['centro', 'Centro de custo'], ['agrupamento', 'Agrupamento'],
      ['categoria_centro', 'Categoria × centro'], ['fornecedor', 'Fornecedor'], ['lote', 'Apropriação por lote'],
    ] as [SpendingDimension, string][]).map(([id, label]) => <Chip key={id} label={label} selected={dimension === id} onPress={() => setDimension(id)} />)}</ChipWrap>
    {!valid ? <Note tone="danger">A data final deve ser igual ou posterior à inicial.</Note> : null}
    <AppText variant="caption" tone="muted">{`${formatDate(range.from)} a ${formatDate(range.to)}. Comparado com ${formatDate(prev.from)} a ${formatDate(prev.to)}. A fazenda segue o contexto do relatório.`}</AppText>
    <Card>{rows.map((r) => <KV key={r.key} label={r.label} value={formatCents(r.cents)} hint={`antes ${formatCents(r.previousCents)}`} />)}
      {!rows.length ? <AppText tone="muted">Nenhum gasto encontrado.</AppText> : null}
      <Divider /><KV label="Total" value={formatCents(rows.reduce((sum, r) => sum + r.cents, 0))} strong hint={`antes ${formatCents(rows.reduce((sum, r) => sum + r.previousCents, 0))}`} />
    </Card>
    <AppText variant="caption" tone="muted">{basis === 'competencia'
      ? 'Compras e serviços aprovados pela data de ocorrência, inclusive estoque e investimentos.'
      : 'Somente valores baixados no período, incluindo juros, multas e descontos proporcionais. Pagamentos por sócio contam quando pagos ao fornecedor; reembolsos não repetem a despesa. Compras no cartão contam somente na quitação da fatura, proporcionalmente.'}</AppText>
    <AppText variant="caption" tone="muted">Categoria, centro e lote são visões dos mesmos gastos. Seus totais não devem ser somados entre si.</AppText>
    <Section title="Lançamentos do período"><Group>
      {details.slice(page * 30, (page + 1) * 30).map((d, i) => <ListRow key={`${d.paymentId ?? d.entryId}:${i}`} icon="file-document-outline" title={d.title}
        subtitle={`${formatDate(d.date)} · ${d.category} · ${d.center} · ${formatCents(d.cents)}`}
        onPress={() => router.push({ pathname: '/lancamento/[id]', params: { id: d.entryId } })} />)}
    </Group></Section>
    {details.length > 30 ? <>
      <AppText variant="caption" tone="muted">{`${page * 30 + 1}–${Math.min((page + 1) * 30, details.length)} de ${details.length} lançamentos`}</AppText>
      <Button title="Página anterior" variant="secondary" disabled={page === 0} onPress={() => setDetailPage(page - 1)} />
      <Button title="Próxima página" variant="secondary" disabled={(page + 1) * 30 >= details.length} onPress={() => setDetailPage(page + 1)} />
    </> : null}
    <Button title={busy ? 'Exportando…' : 'Exportar gastos filtrados (CSV)'} variant="secondary" disabled={busy || !valid} onPress={exportDetails} />
    {failure ? <Note tone="danger">{failure}</Note> : null}
  </Section>;
}
