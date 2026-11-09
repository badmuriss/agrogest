import * as DocumentPicker from 'expo-document-picker';
import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button, Note, StatusText } from '@/components/ui/controls';
import { Card, EmptyState, Group, ListRow, Screen, Section } from '@/components/ui/layout';
import { haptics } from '@/components/ui/motion';
import { AppText } from '@/components/ui/text';
import { parseStatement, suggestMatches, type BankLine, type MatchSuggestion } from '@/domain/bank-import';
import { formatDate } from '@/domain/dates';
import { ACCOUNT_KIND_LABEL } from '@/domain/finance';
import { formatCents } from '@/domain/format';
import { readPickedFile } from '@/services/file-export';
import { useApp } from '@/state/app-state';
import { space } from '@/theme';

/**
 * Conciliação bancária: importa o extrato (OFX ou CSV) de uma conta e sugere, para cada linha, a
 * parcela em aberto com o mesmo valor e vencimento próximo. Confirmar registra a baixa com o
 * identificador da linha como comprovante (importar de novo não duplica). O que sobrar fica
 * para classificar: virar despesa, receita ou movimentação.
 */
export default function ConciliacaoScreen() {
  const app = useApp();
  const operationId = app.scopedFarms.find((f) => app.canSeeFinance(f.operationId))?.operationId;
  const [accountId, setAccountId] = useState<string | null>(app.accounts.find((a) => a.operationId === operationId && a.active && a.kind !== 'cartao')?.id ?? null);
  const [lines, setLines] = useState<BankLine[]>([]);
  const [fileName, setFileName] = useState<string | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  if (!operationId) {
    return (
      <Screen>
        <EmptyState icon="lock-outline" title="Financeiro dos sócios" message="A conciliação aparece só para os sócios da operação." />
      </Screen>
    );
  }
  const accounts = app.accounts.filter((a) => a.operationId === operationId && a.active);
  const account = accounts.find((a) => a.id === accountId);
  const views = app.installments.filter((v) => v.operationId === operationId && v.openCents > 0);
  const suggestions = suggestMatches(lines, views, app.payments.filter((p) => p.operationId === operationId));
  const pending = suggestions.filter((s) => !s.imported);

  const pick = async () => {
    setFailure(null);
    const result = await DocumentPicker.getDocumentAsync({ type: ['application/x-ofx', 'text/csv', 'text/plain', 'application/octet-stream', '*/*'], copyToCacheDirectory: true });
    if (result.canceled || !result.assets[0]) return;
    const asset = result.assets[0];
    try {
      const parsed = parseStatement(asset.name, await readPickedFile(asset.uri));
      if (parsed.error) setFailure(parsed.error);
      setLines(parsed.lines);
      setFileName(asset.name);
    } catch {
      setFailure('Não foi possível ler o arquivo. Exporte o extrato em OFX ou CSV pelo banco.');
    }
  };

  const confirm = async (s: MatchSuggestion) => {
    const view = s.candidates[0];
    if (!view || !account) return;
    setBusy(s.line.id);
    setFailure(null);
    try {
      await app.registerPayment({
        operationId,
        direction: view.direction,
        accountId: account.id,
        partnerId: null,
        partnerMode: null,
        advanceId: null,
        paidAt: s.line.date,
        items: [{ entryId: view.entryId, index: view.index, cents: view.openCents }],
        interestCents: 0,
        fineCents: 0,
        discountCents: 0,
        method: 'transferencia',
        proof: s.line.id,
        notes: `Conciliado do extrato: ${s.line.description}`.slice(0, 500),
      });
      haptics.success();
    } catch (e) {
      setFailure(e instanceof Error ? e.message : 'Não foi possível registrar a baixa.');
    } finally {
      setBusy(null);
    }
  };

  return (
    <Screen footer={<Button title={fileName ? 'Escolher outro extrato' : 'Importar extrato (OFX ou CSV)'} icon="file-upload-outline" size="lg" onPress={() => void pick()} />}>
      <Section title="Conta do extrato">
        <Group>
          {accounts.map((a) => (
            <ListRow key={a.id} icon={a.kind === 'cartao' ? 'credit-card-outline' : 'bank-outline'} title={a.name} subtitle={ACCOUNT_KIND_LABEL[a.kind]} selected={accountId === a.id} onPress={() => setAccountId(a.id)} chevron={false} />
          ))}
        </Group>
      </Section>
      {fileName ? (
        <AppText variant="caption" tone="muted">
          {`${fileName} · ${lines.length} lançamentos · ${pending.length} a conciliar`}
        </AppText>
      ) : (
        <Note icon="information-outline">
          No internet banking, exporte o extrato em OFX (Money/Quicken) ou CSV. Para cada linha, o app sugere a conta em aberto com o mesmo valor e vencimento até 10 dias antes ou depois.
        </Note>
      )}
      {failure ? (
        <Note boxed tone="danger" icon="alert-circle-outline">
          {failure}
        </Note>
      ) : null}
      {suggestions.length > 0 ? (
        <Section title="Linhas do extrato">
          {suggestions.map((s) => {
            const match = s.candidates[0];
            return (
              <Card key={s.line.id} style={styles.card}>
                <View style={styles.row}>
                  <AppText variant="bodyStrong" style={styles.flex} numberOfLines={2}>
                    {s.line.description}
                  </AppText>
                  <AppText variant="bodyStrong" numeric tone={s.line.cents > 0 ? 'success' : 'default'}>
                    {`${s.line.cents > 0 ? '+' : '−'} ${formatCents(Math.abs(s.line.cents))}`}
                  </AppText>
                </View>
                <AppText variant="caption" tone="muted">
                  {formatDate(s.line.date)}
                </AppText>
                {s.imported ? (
                  <StatusText label="Já conciliada" tone="success" />
                ) : match ? (
                  <>
                    <AppText variant="caption">{`Sugestão: ${match.title}${match.count > 1 ? ` · ${match.position}/${match.count}` : ''}${match.counterparty ? ` · ${match.counterparty}` : ''} · vence ${formatDate(match.dueDate)}`}</AppText>
                    <Button title={busy === s.line.id ? 'Registrando…' : 'Confirmar baixa'} icon="check" disabled={busy !== null || !account} onPress={() => void confirm(s)} />
                  </>
                ) : (
                  <View style={styles.row}>
                    <StatusText label="A classificar" tone="warning" />
                    <View style={styles.flex} />
                    {s.line.cents < 0 ? (
                      <Button title="Lançar despesa" variant="ghost" onPress={() => router.push('/novo/despesa')} />
                    ) : (
                      <Button title="Lançar receita" variant="ghost" onPress={() => router.push('/novo/receita')} />
                    )}
                    <Button title="Movimentação" variant="ghost" onPress={() => router.push({ pathname: '/financeiro/movimentar', params: { operacao: operationId, valor: String(Math.abs(s.line.cents)) } })} />
                  </View>
                )}
              </Card>
            );
          })}
        </Section>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: { gap: space.xs },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  flex: { flex: 1 },
});
