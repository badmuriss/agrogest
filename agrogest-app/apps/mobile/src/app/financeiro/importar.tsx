import * as DocumentPicker from 'expo-document-picker';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { FarmPicker } from '@/components/pickers';
import { Button, Note } from '@/components/ui/controls';
import { Card, Divider, EmptyState, KV, Screen, Section } from '@/components/ui/layout';
import { haptics } from '@/components/ui/motion';
import { AppText } from '@/components/ui/text';
import { formatDate } from '@/domain/dates';
import { formatCents } from '@/domain/format';
import { parseSheet, SHEET_TEMPLATE, type SheetRow } from '@/domain/sheet-import';
import { readPickedFile, shareTextFile } from '@/services/file-export';
import { useApp } from '@/state/app-state';
import { space } from '@/theme';

/**
 * Importação da planilha usada hoje: parcelas em aberto (a pagar e a receber) e saldos iniciais das
 * contas. As parcelas entram como saldo de abertura: viram contas a pagar ou a receber, mas não
 * custo nem receita no app (o fato aconteceu antes). Importar de novo não duplica.
 */
export default function ImportarScreen() {
  const app = useApp();
  const [farmId, setFarmId] = useState(app.scopedFarms.find((f) => app.canSeeFinance(f.operationId))?.id ?? app.defaultFarmId);
  const [rows, setRows] = useState<SheetRow[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const [fileName, setFileName] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const farm = app.farm(farmId);
  if (!farm || !app.canSeeFinance(farm.operationId)) {
    return (
      <Screen>
        <EmptyState icon="lock-outline" title="Financeiro dos sócios" message="Somente um sócio da operação importa a planilha." />
      </Screen>
    );
  }

  const pick = async () => {
    setFailure(null);
    setResult(null);
    const picked = await DocumentPicker.getDocumentAsync({ type: ['text/csv', 'text/plain', 'text/comma-separated-values', '*/*'], copyToCacheDirectory: true });
    if (picked.canceled || !picked.assets[0]) return;
    try {
      const parsed = parseSheet(await readPickedFile(picked.assets[0].uri), app.categories);
      setRows(parsed.rows);
      setErrors(parsed.errors);
      setFileName(picked.assets[0].name);
    } catch {
      setFailure('Não foi possível ler o arquivo. Salve a planilha como CSV (separado por ponto e vírgula).');
    }
  };

  const save = async () => {
    setBusy(true);
    setFailure(null);
    try {
      const done = await app.importSheet(farm.operationId, farm.id, rows);
      haptics.success();
      setResult(
        `${done.imported} ${done.imported === 1 ? 'conta importada' : 'contas importadas'}` +
          (done.skipped ? `, ${done.skipped} já estavam no app` : '') +
          (done.accounts ? `, ${done.accounts} ${done.accounts === 1 ? 'conta bancária criada' : 'contas bancárias criadas'}` : '') +
          '.',
      );
      setRows([]);
      setFileName(null);
    } catch (e) {
      setFailure(e instanceof Error ? e.message : 'Não foi possível importar.');
    } finally {
      setBusy(false);
    }
  };

  const titles = rows.filter((r): r is Extract<SheetRow, { kind: 'titulo' }> => r.kind === 'titulo');
  const balances = rows.filter((r): r is Extract<SheetRow, { kind: 'saldo' }> => r.kind === 'saldo');
  const sum = (direction: 'pagar' | 'receber') => titles.filter((t) => t.direction === direction).reduce((acc, t) => acc + t.cents, 0);

  return (
    <Screen
      footer={
        rows.length > 0 ? (
          <Button title={busy ? 'Importando…' : `Importar ${rows.length} linhas`} icon="check" size="lg" disabled={busy} onPress={() => void save()} />
        ) : (
          <Button title="Escolher planilha (CSV)" icon="file-upload-outline" size="lg" onPress={() => void pick()} />
        )
      }>
      <FarmPicker value={farmId} onChange={setFarmId} />
      <Note icon="file-table-outline">
        Uma linha por parcela em aberto: tipo (pagar ou receber), descrição, fornecedor ou cliente, vencimento, valor, categoria e competência. Linhas com tipo “saldo” criam as contas bancárias com o saldo inicial.
      </Note>
      <Button title="Baixar o modelo da planilha" variant="secondary" icon="download-outline" onPress={() => void shareTextFile('modelo-importacao-agrogest.csv', '﻿' + SHEET_TEMPLATE, 'text/csv')} />

      {fileName ? (
        <Section title={fileName}>
          <Card>
            <KV label="A pagar" value={formatCents(sum('pagar'))} hint={`${titles.filter((t) => t.direction === 'pagar').length} parcelas`} />
            <KV label="A receber" value={formatCents(sum('receber'))} hint={`${titles.filter((t) => t.direction === 'receber').length} parcelas`} />
            {balances.length > 0 ? (
              <>
                <Divider />
                {balances.map((b) => (
                  <KV key={b.line} label={b.name} value={formatCents(b.cents)} hint={`saldo em ${formatDate(b.date)}`} />
                ))}
              </>
            ) : null}
          </Card>
          {titles.slice(0, 8).map((t) => (
            <View key={t.line} style={styles.line}>
              <AppText variant="caption" tone="muted" numberOfLines={1}>
                {`${t.direction === 'pagar' ? 'Pagar' : 'Receber'} · ${t.title}${t.counterparty ? ` · ${t.counterparty}` : ''} · ${formatDate(t.dueDate)} · ${formatCents(t.cents)}`}
              </AppText>
            </View>
          ))}
          {titles.length > 8 ? <AppText variant="caption" tone="faint">{`e mais ${titles.length - 8}.`}</AppText> : null}
        </Section>
      ) : null}
      {errors.length > 0 ? (
        <Note boxed tone="warning" icon="alert-outline" title={`${errors.length} ${errors.length === 1 ? 'aviso' : 'avisos'}`}>
          {errors.slice(0, 10).join('\n')}
        </Note>
      ) : null}
      {result ? (
        <Note boxed tone="success" icon="check-circle-outline">
          {result}
        </Note>
      ) : null}
      {failure ? (
        <Note boxed tone="danger" icon="alert-circle-outline">
          {failure}
        </Note>
      ) : null}
      <AppText variant="caption" tone="faint">
        As contas importadas não viram custo nem receita: o fato aconteceu antes do app. Elas aparecem em A pagar e A receber até a baixa. Despesas já lançadas no app não precisam ser importadas.
      </AppText>
    </Screen>
  );
}

const styles = StyleSheet.create({
  line: { paddingVertical: space.xs },
});
