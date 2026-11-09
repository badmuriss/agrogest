import { randomUUID } from 'expo-crypto';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { CategoryIcon } from '@/components/cattle-icon';
import { PasturePicker } from '@/components/pasture-form';
import { Button, Note } from '@/components/ui/controls';
import { Field, TextField } from '@/components/ui/form';
import { Card, EmptyState, Group, ListRow, Screen, Section } from '@/components/ui/layout';
import { haptics } from '@/components/ui/motion';
import { AppText, Icon, IconTile } from '@/components/ui/text';
import { StepHeader } from '@/components/wizard';
import { formatDate } from '@/domain/dates';
import { formatCents, formatNumber, plural } from '@/domain/format';
import type { TransferLotInput } from '@/domain/lot-transfer';
import { useApp } from '@/state/app-state';
import { useSyncStatus } from '@/state/sync-status';
import { radius, space, usePalette } from '@/theme';

export default function TransferirLoteScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const app = useApp();
  const sync = useSyncStatus();
  const [destinationId, setDestinationId] = useState('');
  const [code, setCode] = useState(() => app.nextLotCode());
  const [pastureId, setPastureId] = useState<string | null>(null);
  const [review, setReview] = useState<TransferLotInput | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [commandId] = useState(randomUUID);
  const [destinationLotId] = useState(randomUUID);
  const summary = app.lotSummary(id);
  if (!summary) return <Screen><EmptyState icon="cow-off" title="Lote não encontrado" /></Screen>;
  const { lot } = summary;
  if (!app.canSeeFinance(lot.operationId)) return <Screen><EmptyState icon="lock-outline" title="Transferência por um sócio" message="Um sócio nas duas fazendas pode realizar a transferência." /></Screen>;
  if (lot.transfer?.outgoing || summary.headsCurrent <= 0) return <Screen><EmptyState icon="truck-check-outline" title="Lote sem animais para transferir" message="Este lote foi encerrado ou já foi transferido." /></Screen>;
  const farms = app.visibleFarms.filter((f) => f.id !== lot.farmId && app.canSeeFinance(f.operationId));
  if (farms.length === 0) return <Screen><EmptyState icon="barn" title="Nenhuma fazenda de destino" message="Você precisa participar como sócio de outra fazenda para transferir o lote." /></Screen>;
  const destination = farms.find((f) => f.id === destinationId);
  const pasture = destination && pastureId ? app.farmPastures(destination.id).find((p) => p.id === pastureId) : undefined;
  const blocked = summary.pendingCount > 0 || (app.cloudMode && (!app.online || sync.pendingCommands > 0));
  const heads = review?.expectedHeads ?? summary.headsCurrent;
  const confirm = async () => {
    if (!review || busy) return;
    setBusy(true); setError(null);
    try {
      const received = await app.transferLot(lot.id, review);
      haptics.success();
      router.replace({ pathname: '/lote/[id]', params: { id: received.id } });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Não foi possível confirmar a transferência.');
    } finally { setBusy(false); }
  };
  return <Screen footer={<Button disabled={busy || blocked || !destination || !code.trim() || !pasture}
    title={busy ? 'Transferindo…' : review ? 'Confirmar transferência' : 'Revisar transferência'} icon={review ? 'truck-check-outline' : 'arrow-right'}
    onPress={review ? confirm : () => {
      setError(null);
      if (!pasture) return;
      setReview({ destinationFarmId: destinationId, code: code.trim(), managementGroup: pasture.name, pastureId: pasture.id, commandId, destinationLotId,
        expectedHeads: summary.headsCurrent, expectedCostCents: summary.remainingCostCents, expectedWeightKg: summary.lastWeighing.kg, date: app.today });
    }} />}>
    <StepHeader steps={['Para onde vai o lote', 'Confira a transferência']} current={review ? 1 : 0} />
    {summary.pendingCount > 0 ? <Note boxed tone="warning" icon="alert-outline">Resolva os lançamentos pendentes do lote antes de transferir.</Note> : null}
    {app.cloudMode && !app.online ? <Note boxed tone="warning" icon="wifi-off">Conecte-se à internet para confirmar a transferência.</Note> : null}
    {app.cloudMode && sync.pendingCommands > 0 ? <Note boxed tone="warning" icon="cloud-upload-outline">Sincronize os registros pendentes antes de transferir.</Note> : null}
    {error ? <Note boxed tone="danger" icon="alert-circle-outline">{error}</Note> : null}
    <Card style={styles.route}>
      <View style={styles.lotHead}>
        <CategoryIcon category={lot.category} size={40} />
        <View style={styles.flex}>
          <AppText variant="heading">Lote {lot.code}</AppText>
          <AppText variant="caption" tone="muted">{plural(heads, 'cabeça', 'cabeças')} · {lot.category}</AppText>
        </View>
      </View>
      <RouteStop label="SAI DE" title={app.farm(lot.farmId)?.name ?? 'Fazenda de origem'}
        detail={app.lotGroups(lot.id).map((g) => app.pastureName(g.pastureId)).join(', ') || lot.managementGroup} />
      <RouteLink />
      <RouteStop label="VAI PARA" title={destination?.name} detail={destination ? `Lote ${code.trim() || '—'} · ${pasture?.name ?? 'escolha o pasto'}` : undefined} arriving />
    </Card>
    {review ? <>
      <Section title="O que vai junto" action={busy ? undefined : { label: 'Alterar', onPress: () => setReview(null) }}>
        <View style={styles.grid}>
          <Metric icon="cow" label="Animais" value={String(review.expectedHeads)} />
          <Metric icon="scale-balance" label="Peso médio" value={`${formatNumber(review.expectedWeightKg)} kg`} />
          <Metric icon="cash-multiple" label="Custo acumulado" value={formatCents(review.expectedCostCents)} />
          <Metric icon="calendar-outline" label="Data" value={formatDate(review.date)} />
        </View>
      </Section>
      <Note boxed tone="info" icon="history" title="O histórico fica na origem">
        {`Pesagens, vendas, perdas e despesas anteriores continuam no lote ${lot.code}. Os animais e o custo passam para o novo lote sem registrar compra nem venda.`}
      </Note>
    </> : <>
      <Section title="Fazenda de destino"><Group>{farms.map((farm) => <ListRow key={farm.id} icon="barn" iconTone={destinationId === farm.id ? 'accent' : 'neutral'} title={farm.name}
        subtitle={app.farmCaption(farm)} selected={destinationId === farm.id} onPress={() => { setDestinationId(farm.id); setPastureId(null); }} />)}</Group></Section>
      <Section title="No destino">
        <View style={styles.fields}>
          <Field label="Código do novo lote"><TextField accessibilityLabel="Código do novo lote" value={code} onChangeText={setCode} maxLength={100} /></Field>
        </View>
      </Section>
      {destination ? <PasturePicker farmId={destination.id} value={pastureId} onChange={setPastureId} title="Pasto de chegada" /> : null}
      <Note icon="truck-outline">Todos os animais vão juntos, com o peso mais recente e o custo acumulado.</Note>
    </>}
  </Screen>;
}

function RouteStop({ label, title, detail, arriving }: { label: string; title?: string; detail?: string; arriving?: boolean }) {
  const p = usePalette();
  const empty = !title;
  return <View style={styles.stop}>
    {empty
      ? <View style={[styles.placeholder, { borderColor: p.textFaint }]}><Icon name="map-marker-question-outline" size={20} color={p.textFaint} /></View>
      : <IconTile name={arriving ? 'map-marker-check-outline' : 'barn'} tone={arriving ? 'accent' : 'neutral'} size={40} />}
    <View style={styles.flex}>
      <AppText variant="label" tone={arriving && !empty ? 'accent' : 'muted'}>{label}</AppText>
      <AppText variant="bodyStrong" tone={empty ? 'faint' : 'default'} numberOfLines={1}>{title ?? 'Escolha a fazenda abaixo'}</AppText>
      {detail ? <AppText variant="caption" tone="muted" numberOfLines={1}>{detail}</AppText> : null}
    </View>
  </View>;
}

function RouteLink() {
  const p = usePalette();
  return <View style={styles.link}>
    <View style={[styles.line, { borderColor: p.border }]} />
    <Icon name="truck-fast-outline" size={18} color={p.textMuted} />
    <View style={[styles.line, { borderColor: p.border }]} />
  </View>;
}

function Metric({ icon, label, value }: { icon: Parameters<typeof Icon>[0]['name']; label: string; value: string }) {
  const p = usePalette();
  return <View style={[styles.metric, { backgroundColor: p.fill }]}>
    <View style={styles.metricLabel}><Icon name={icon} size={16} color={p.textMuted} /><AppText variant="caption" tone="muted">{label}</AppText></View>
    <AppText variant="heading" numeric numberOfLines={1} adjustsFontSizeToFit>{value}</AppText>
  </View>;
}

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0, gap: 2 },
  route: { gap: space.md },
  lotHead: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingBottom: space.xs },
  stop: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  placeholder: { width: 40, height: 40, borderRadius: 12, borderWidth: 1.5, borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center' },
  link: { width: 40, alignItems: 'center', gap: space.xs, marginVertical: -space.xs },
  line: { height: 8, borderLeftWidth: 2, borderStyle: 'dotted' },
  fields: { gap: space.md },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  metric: { flexBasis: '47%', flexGrow: 1, padding: space.md, borderRadius: radius.lg, gap: space.xs },
  metricLabel: { flexDirection: 'row', alignItems: 'center', gap: space.xs },
});
