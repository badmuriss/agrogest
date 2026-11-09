import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { ToggleGroup } from '@/components/fields';
import { Button, Chip, ChipRow, Note } from '@/components/ui/controls';
import { Card, Divider, EmptyState, KV, Section } from '@/components/ui/layout';
import { haptics } from '@/components/ui/motion';
import { AppText } from '@/components/ui/text';
import { formatDate } from '@/domain/dates';
import { accountantPackage, dreSheet, reportHtml, toCsv, toSpreadsheet, type Sheet } from '@/domain/export';
import { formatCents, plural } from '@/domain/format';
import {
  aging,
  AGING_LABEL,
  buildDre,
  GROUP_LABEL,
  presetPeriod,
  resultToCashBridge,
  type AgingBucket,
} from '@/domain/reports';
import { SpendingReport } from './spending';
import { sharePdf, shareTextFile } from '@/services/file-export';
import { useApp } from '@/state/app-state';
import { space } from '@/theme';

type Tab = 'dre' | 'idade' | 'gastos';
type Range = 'mes' | 'trimestre' | 'ano' | '12m';

const RANGES: [Range, string][] = [
  ['mes', 'Este mês'],
  ['trimestre', 'Trimestre'],
  ['ano', 'Este ano'],
  ['12m', '12 meses'],
];
const AGING_ORDER: AgingBucket[] = ['a_vencer', '1_30', '31_60', '60_mais'];

/**
 * Relatórios gerenciais das fazendas do contexto: DRE por competência com a ponte para o caixa,
 * contas por idade e gastos por categoria, fornecedor e centro de custo, comparados com o período
 * anterior. Exporta PDF, planilha e o pacote para o contador.
 */
export function ResultsReport() {
  const app = useApp();
  const [tab, setTab] = useState<Tab>('dre');
  const [range, setRange] = useState<Range>('ano');
  const [busy, setBusy] = useState<string | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const book = app.financeBook();
  if (book.operationIds.size === 0) {
    return <EmptyState icon="lock-outline" title="Financeiro dos sócios" message="Os relatórios financeiros aparecem só para os sócios da operação." />;
  }
  const period = presetPeriod(range, app.today);
  const scope = app.contextFarm?.name ?? 'Todas as fazendas';
  const subtitle = `${scope} · ${formatDate(period.from)} a ${formatDate(period.to)}`;
  const names = {
    user: (id: string) => app.userName(id),
    account: (id: string | null) => app.accounts.find((a) => a.id === id)?.name ?? '',
    farm: (id: string) => app.farm(id)?.name ?? '',
  };
  const fileBase = `agrogest-${(app.contextFarm?.name ?? 'fazendas').toLowerCase().replace(/[^a-z0-9]+/gi, '-')}-${period.from}-a-${period.to}`;

  const run = async (key: string, work: () => Promise<void>) => {
    setBusy(key);
    setFailure(null);
    try {
      await work();
      haptics.success();
    } catch (e) {
      setFailure(e instanceof Error ? e.message : 'Não foi possível exportar.');
    } finally {
      setBusy(null);
    }
  };

  const agingSheet = (): Sheet => {
    const a = aging(book);
    return {
      name: 'Contas por idade',
      rows: [
        ['Idade', 'A pagar (qtd.)', 'A pagar', 'A receber (qtd.)', 'A receber'],
        ...AGING_ORDER.map((k) => [AGING_LABEL[k], a.pagar[k].count, { cents: a.pagar[k].cents }, a.receber[k].count, { cents: a.receber[k].cents }]),
      ],
    };
  };

  const dre = buildDre(book, period);
  const bridge = resultToCashBridge(book, period);

  return (
    <>
      <ToggleGroup<Tab>
        accessibilityLabel="Relatório"
        options={[
          { value: 'dre', label: 'Resultado' },
          { value: 'idade', label: 'Por idade' },
          { value: 'gastos', label: 'Gastos' },
        ]}
        value={tab}
        onChange={setTab}
      />
      {tab !== 'idade' ? (
        <ChipRow>
          {RANGES.map(([value, label]) => (
            <Chip key={value} label={label} selected={range === value} onPress={() => setRange(value)} />
          ))}
        </ChipRow>
      ) : null}
      <AppText variant="caption" tone="muted">
        {tab === 'idade' ? `${scope} · hoje` : subtitle}
      </AppText>

      {tab === 'dre' ? (
        <>
          <Section title="DRE gerencial (competência)">
            <Card>
              {dre.lines.filter((line) => line.total || line.cents !== 0 || line.key === 'bruta').map((line) => (
                <View key={line.key}>
                  {line.total ? <Divider /> : null}
                  <KV label={line.label} value={formatCents(line.cents)} strong={line.total} />
                  {line.details && line.details.length > 1
                    ? line.details.map((d) => (
                        <View key={d.label} style={styles.detail}>
                          <KV label={d.label} value={formatCents(line.key === 'financeiro' ? d.cents : d.cents * (line.cents < 0 ? -1 : 1))} />
                        </View>
                      ))
                    : null}
                </View>
              ))}
            </Card>
            {dre.outsideResult.length > 0 ? (
              <Card>
                <AppText variant="label" tone="muted">
                  Fora do resultado
                </AppText>
                {dre.outsideResult.map((x) => (
                  <KV key={x.label} label={x.label} value={formatCents(x.cents)} />
                ))}
              </Card>
            ) : null}
            <AppText variant="caption" tone="faint">
              Custo dos animais vendidos pela média de compra por cabeça. Compras para o estoque viram custo no consumo. Pagar uma parcela não é custo; aporte, empréstimo e transferência não são receita.
            </AppText>
          </Section>
          <Section title="Do resultado ao caixa">
            <Card>
              <KV label="Resultado real" value={formatCents(bridge.resultCents)} />
              {bridge.rows.map((r) => (
                <KV
                  key={r.group}
                  label={GROUP_LABEL[r.group]}
                  value={`${r.differenceCents >= 0 ? '+' : '−'} ${formatCents(Math.abs(r.differenceCents))}`}
                  hint={`resultado ${formatCents(r.resultCents)} · caixa ${formatCents(r.cashCents)}`}
                />
              ))}
              <Divider />
              <KV label="Variação do caixa" value={formatCents(bridge.cashCents)} strong />
            </Card>
            <AppText variant="caption" tone="faint">
              Cada linha mostra quanto aquele grupo pôs ou tirou de caixa além do que entrou no resultado: contas ainda não pagas, pagamentos de meses anteriores, compras de animais e de estoque, sócios e financiamentos.
            </AppText>
          </Section>
        </>
      ) : null}

      {tab === 'idade'
        ? (() => {
            const a = aging(book);
            return (
              <>
                {(['pagar', 'receber'] as const).map((direction) => (
                  <Section key={direction} title={direction === 'pagar' ? 'A pagar' : 'A receber'}>
                    <Card>
                      {AGING_ORDER.map((k) => (
                        <KV key={k} label={AGING_LABEL[k]} value={formatCents(a[direction][k].cents)} hint={a[direction][k].count > 0 ? plural(a[direction][k].count, 'parcela', 'parcelas') : undefined} />
                      ))}
                      <Divider />
                      <KV label="Total em aberto" value={formatCents(AGING_ORDER.reduce((acc, k) => acc + a[direction][k].cents, 0))} strong />
                    </Card>
                  </Section>
                ))}
              </>
            );
          })()
        : null}

      {tab === 'gastos' ? <SpendingReport book={book} period={period} /> : null}

      <Section title="Exportar">
        <View style={styles.buttons}>
          <Button
            title={busy === 'pdf' ? 'Gerando…' : 'Relatório em PDF'}
            variant="secondary"
            icon="file-pdf-box"
            disabled={busy !== null}
            onPress={() => void run('pdf', () => sharePdf(`${fileBase}.pdf`, reportHtml('Relatório financeiro', subtitle, [dreSheet(book, period), agingSheet()])))}
          />
          <Button
            title={busy === 'xls' ? 'Gerando…' : 'Pacote do contador (planilha)'}
            variant="secondary"
            icon="file-excel-box"
            disabled={busy !== null}
            onPress={() =>
              void run('xls', () => shareTextFile(`${fileBase}-contador.xls`, toSpreadsheet([...accountantPackage(book, period, names), agingSheet()]), 'application/vnd.ms-excel'))
            }
          />
          <Button
            title={busy === 'csv' ? 'Gerando…' : 'DRE em CSV'}
            variant="secondary"
            icon="file-delimited-outline"
            disabled={busy !== null}
            onPress={() => void run('csv', () => shareTextFile(`${fileBase}-dre.csv`, toCsv(dreSheet(book, period).rows), 'text/csv'))}
          />
        </View>
        <AppText variant="caption" tone="faint">
          O pacote traz lançamentos, parcelas, baixas com o comprovante informado, movimentações, fluxo de caixa e DRE, uma aba cada. Os arquivos de comprovante ainda não são enviados pelo app.
        </AppText>
        {failure ? (
          <Note boxed tone="danger" icon="alert-circle-outline">
            {failure}
          </Note>
        ) : null}
      </Section>
    </>
  );
}

const styles = StyleSheet.create({
  detail: { paddingLeft: space.md, opacity: 0.85 },
  buttons: { gap: space.sm },
});
