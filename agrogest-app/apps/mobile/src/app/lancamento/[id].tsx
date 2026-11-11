import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { CostClassificationPanel } from '@/components/cost-classification';
import { EntryDetails } from '@/components/entry-details';
import { EntryStatusText, HISTORY_LABEL, KIND_META, statusMeta } from '@/components/status';
import { Button, Note } from '@/components/ui/controls';
import { Field, TextField } from '@/components/ui/form';
import { Card, EmptyState, Group, KV, ListRow, Screen, Section } from '@/components/ui/layout';
import { FadeIn, haptics } from '@/components/ui/motion';
import { AppText, IconTile } from '@/components/ui/text';
import { editHref } from '@/components/wizard';
import { isFinancial } from '@/domain/approval';
import { formatDate, formatDateTime } from '@/domain/dates';
import { formatCents } from '@/domain/format';
import type { Decision, Entry } from '@/domain/types';
import { useApp } from '@/state/app-state';
import { space, usePalette, type Tone } from '@/theme';

function decisionFeedback(entry: Entry): { tone: Tone; title: string; message: string } {
  if (entry.pendingDecision) {
    return { tone: 'info', title: 'Decisão guardada no aparelho', message: 'Só vale depois de sincronizar e ser validada.' };
  }
  if (entry.status === 'aprovado') return { tone: 'success', title: 'Aprovado', message: 'Entrou nos saldos e resultados.' };
  if (entry.status === 'rejeitado') return { tone: 'danger', title: 'Recusado', message: 'O autor vê o motivo e pode corrigir.' };
  return { tone: 'conflict', title: 'Não coube no saldo', message: entry.conflictReason ?? 'Virou conflito para revisão.' };
}

export default function LancamentoScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const app = useApp();
  const p = usePalette();
  const [rejecting, setRejecting] = useState(false);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const [feedback, setFeedback] = useState<ReturnType<typeof decisionFeedback> | null>(null);
  const entry = app.entry(id);

  if (!entry) {
    return (
      <Screen>
        <EmptyState icon="file-question-outline" title="Lançamento não encontrado" message="Ele pode ter sido descartado." />
      </Screen>
    );
  }

  const kind = KIND_META[entry.kind];
  const isAuthor = entry.authorId === app.user.id;
  const blockReason = app.blockReason(entry);
  const canDecide = entry.status === 'aguardando_aprovacao' && !entry.pendingDecision && blockReason === null;
  const approvers = app.approversFor(entry);
  const awaiting = entry.status === 'aguardando_aprovacao' || entry.status === 'aguardando_envio';
  const canEdit = isAuthor && (entry.status === 'rascunho' || entry.status === 'rejeitado' || entry.status === 'conflito');
  const canDelete = isAuthor && entry.status === 'aguardando_aprovacao' && !entry.pendingDecision;
  const lotId = entry.kind === 'pesagem' || entry.kind === 'mortalidade' || entry.kind === 'venda' || entry.kind === 'manejo' ? entry.payload.lotId : null;
  const nfWaiting = entry.kind === 'nota_fiscal' && entry.payload.stage === 'aguardando_conexao';

  const decide = async (decision: Decision) => {
    if (busy) return;
    setBusy(true);
    try {
      const updated = await app.decide(entry.id, decision, note.trim());
      setRejecting(false); setNote('');
      if (updated.status === 'aprovado') haptics.success(); else haptics.warning();
      setFeedback(decisionFeedback(updated));
    } catch (error) {
      setFeedback({ tone: 'danger', title: 'Decisão não concluída', message: error instanceof Error ? error.message : 'Tente novamente. O lançamento foi preservado.' });
    } finally { setBusy(false); }
  };

  const discard = async () => {
    if (!confirmDiscard) {
      setConfirmDiscard(true);
      return;
    }
    if (busy) return;
    setBusy(true);
    try {
      await app.discard(entry.id);
      router.back();
    } catch (error) {
      setConfirmDiscard(false);
      setFeedback({ tone: 'danger', title: 'Exclusão não concluída', message: error instanceof Error ? error.message : 'Tente novamente. O lançamento foi preservado.' });
    } finally { setBusy(false); }
  };

  const editLabel =
    entry.status === 'rascunho'
      ? entry.kind === 'nota_fiscal'
        ? 'Revisar nota'
        : 'Continuar'
      : entry.status === 'conflito'
        ? 'Corrigir'
        : 'Corrigir e reenviar';

  let footer = null;
  if (canDecide && rejecting) {
    footer = (
      <>
        <Button title="Cancelar" variant="secondary" onPress={() => setRejecting(false)} />
        <Button title="Confirmar recusa" variant="danger" disabled={!note.trim() || busy} onPress={() => decide('recusar')} />
      </>
    );
  } else if (canDecide) {
    footer = (
      <>
        <Button title="Recusar" variant="secondary" onPress={() => setRejecting(true)} />
        <Button
          title={app.online ? 'Aprovar' : 'Aprovar ao conectar'}
          icon="check"
          disabled={busy}
          onPress={() => decide('aprovar')}
          style={styles.grow}
        />
      </>
    );
  } else if (canDelete) {
    footer = (
      <>
        {confirmDiscard ? <Button title="Cancelar" variant="secondary" onPress={() => setConfirmDiscard(false)} /> : null}
        <Button title={confirmDiscard ? 'Confirmar exclusão' : 'Excluir lançamento'} variant={confirmDiscard ? 'danger' : 'secondary'} icon="delete-outline" disabled={busy} onPress={discard} style={styles.grow} />
      </>
    );
  } else if (canEdit) {
    footer = (
      <>
        {entry.status !== 'rejeitado' ? (
          <Button title={confirmDiscard ? 'Confirmar' : 'Descartar'} variant={confirmDiscard ? 'danger' : 'secondary'} onPress={discard} />
        ) : null}
        {!nfWaiting ? <Button title={editLabel} onPress={() => router.push(editHref(entry))} style={styles.grow} /> : null}
      </>
    );
  }

  return (
    <Screen footer={footer}>
      {entry.kind === 'despesa' && entry.payload.sourceDocumentId ? <Button title="Ver comprovante original" variant="secondary" icon="image-outline" onPress={() => router.push(`/documento/${entry.payload.sourceDocumentId}`)} /> : null}
      <FadeIn index={0} style={styles.header}>
        <View style={styles.kindRow}>
          <IconTile name={kind.icon} size={28} />
          <AppText variant="caption" tone="muted">
            {kind.label} · {formatDate(entry.occurredAt)}
          </AppText>
        </View>
        <AppText variant="title">{entry.title}</AppText>
        {entry.amountCents !== null && (app.canSeeFinance(entry.operationId) || isAuthor) ? (
          <AppText variant="largeTitle" numeric>
            {formatCents(entry.amountCents)}
          </AppText>
        ) : null}
        <EntryStatusText entry={entry} />
        <AppText variant="caption" tone="muted">
          {statusMeta(entry).help}
        </AppText>
      </FadeIn>

      {feedback ? (
        <Note boxed tone={feedback.tone} icon="check-circle-outline" title={feedback.title}>
          {feedback.message}
        </Note>
      ) : null}
      {canDelete ? (
        <Note boxed tone="info" icon="delete-outline" title="Ainda não foi aprovado">
          {`Excluir tira o lançamento da aprovação e não altera custos, estoque nem contas.${entry.kind === 'despesa' && entry.payload.sourceDocumentId ? ' O comprovante fica livre para outro lançamento.' : ''}`}
        </Note>
      ) : null}
      {entry.pendingDecision && entry.pendingDecisionBy ? (
        <Note boxed tone="info" icon="cellphone-arrow-down" title="Decisão aguardando sincronização">
          {`${app.userName(entry.pendingDecisionBy)} decidiu ${entry.pendingDecision === 'aprovar' ? 'aprovar' : 'recusar'} sem internet.`}
        </Note>
      ) : null}
      {entry.status === 'conflito' ? (
        <Note boxed tone="conflict" icon="alert-outline" title="Conflito de saldo">
          {`${entry.conflictReason ?? ''} ${isAuthor ? 'Revise e envie de novo.' : 'O autor precisa revisar.'}`}
        </Note>
      ) : null}
      {entry.status === 'rejeitado' && entry.decisionNote ? (
        <Note boxed tone="danger" icon="close-circle-outline" title="Motivo da recusa">
          {entry.decisionNote}
        </Note>
      ) : null}

      <FadeIn index={1}>
        <View style={styles.gap}>
          <EntryDetails entry={entry} />
          {entry.kind === 'despesa' || entry.kind === 'nota_fiscal' ? <CostClassificationPanel key={entry.id} entry={entry} /> : null}
        </View>
      </FadeIn>

      {canDecide && rejecting ? (
        <Field label="Motivo da recusa" hint="O autor vê este texto para corrigir.">
          <TextField multiline autoFocus value={note} onChangeText={setNote} placeholder="Ex.: valor diferente da nota" />
        </Field>
      ) : null}

      {awaiting ? (
        <Note icon="account-check-outline">
          {approvers.length > 0
            ? `Pode aprovar: ${approvers.map((u) => u.name).join(', ')}.${isFinancial(entry.kind) ? ' Financeiro exige outro sócio.' : ''}`
            : 'Ninguém mais na operação pode aprovar: entra direto ao sincronizar, depois de conferir o saldo.'}
        </Note>
      ) : null}
      {entry.status === 'aguardando_aprovacao' && blockReason && !entry.pendingDecision ? (
        <Note icon="account-lock-outline">{blockReason}</Note>
      ) : null}

      {lotId && app.lotSummary(lotId) ? (
        <Group>
          <ListRow
            icon="cow"
            title={`Origem ${app.lotSummary(lotId)!.lot.code}`}
            subtitle="Ver o lote"
            onPress={() => router.push({ pathname: '/lote/[id]', params: { id: lotId } })}
          />
        </Group>
      ) : null}

      <Section title="Histórico">
        <Card style={styles.timeline}>
          <KV label="Operação" value={app.operation(entry.operationId)?.name ?? ''} />
          <KV label="Fazenda" value={app.farm(entry.farmId)?.name ?? ''} />
          <View style={[styles.sep, { backgroundColor: p.border }]} />
          {entry.history.map((item, i) => (
            <View key={`${item.at}-${i}`} style={styles.event}>
              <View style={[styles.dot, { backgroundColor: i === entry.history.length - 1 ? p.accent : p.fillStrong }]} />
              <View style={styles.flex}>
                <AppText variant="caption">
                  <AppText variant="caption" style={styles.bold}>
                    {app.userName(item.by)}
                  </AppText>{' '}
                  {HISTORY_LABEL[item.action]}
                </AppText>
                {item.note ? (
                  <AppText variant="caption" tone="muted">
                    {item.note}
                  </AppText>
                ) : null}
                <AppText variant="caption" tone="faint">
                  {formatDateTime(item.at)}
                </AppText>
              </View>
            </View>
          ))}
        </Card>
      </Section>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  grow: { flexGrow: 2 },
  bold: { fontWeight: '600' },
  gap: { gap: space.lg },
  header: { gap: space.xs },
  kindRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm, marginBottom: space.xs },
  timeline: { gap: space.md },
  sep: { height: StyleSheet.hairlineWidth },
  event: { flexDirection: 'row', gap: space.md },
  dot: { width: 8, height: 8, borderRadius: 4, marginTop: 5 },
});
