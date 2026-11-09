import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { PurchasePaymentRow } from '@/components/purchase-payment';
import { BarChart } from '@/components/bar-chart';
import { CategoryIcon } from '@/components/cattle-icon';
import { formatGmd, pastureLabel } from '@/components/rows';
import { WeightTag } from '@/components/status';
import { Badge, IconButton, Note, Segmented } from '@/components/ui/controls';
import { Card, Divider, EmptyState, Group, KV, ListRow, Screen, Section } from '@/components/ui/layout';
import { HandCoins, Map as MapIcon, Scale, TriangleAlert } from '@/components/ui/lucide';
import { FadeIn, haptics } from '@/components/ui/motion';
import { QuickActions, type QuickAction } from '@/components/ui/quick-actions';
import { AppText, Icon } from '@/components/ui/text';
import { CRITERION_LABEL } from '@/domain/allocation';
import { breakEvenPerArrobaCents, ESTIMATED_CARCASS_YIELD } from '@/domain/cattle';
import { daysBetween, formatDate, formatDateShort } from '@/domain/dates';
import { formatCents, formatNumber, plural } from '@/domain/format';
import type { LotSummary } from '@/domain/lot-metrics';
import { useApp } from '@/state/app-state';
import { radius, space, usePalette } from '@/theme';

type Tab = 'resumo' | 'custos' | 'peso' | 'vendas';

const restricted = (
  <Note icon="lock-outline" title="Valores restritos">
    Seu vínculo nesta operação não inclui custos e resultados.
  </Note>
);

/** O lote só tem o peso de entrada até a primeira pesagem aprovada. */
const hasWeighing = (s: LotSummary) => s.weighings.length > 1;

export default function LoteScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const app = useApp();
  const p = usePalette();
  const [selected, setSelected] = useState<Tab>('resumo');
  const s = app.lotSummary(id);

  if (!s) {
    return (
      <Screen>
        <EmptyState icon="cow-off" title="Lote não encontrado" />
      </Screen>
    );
  }

  const { lot } = s;
  const finance = app.canSeeFinance(lot.operationId);
  const operationName = app.operation(lot.operationId)?.name;
  const farmName = app.farm(lot.farmId)?.name;
  // A operação criada junto com a fazenda tem o mesmo nome dela: não repete.
  const operationLabel = operationName !== farmName ? operationName : null;
  const edit = finance && !lot.transfer?.incoming && !lot.transfer?.outgoing ? () => router.push({ pathname: '/lote/editar/[id]', params: { id: lot.id } }) : undefined;
  const weighed = hasWeighing(s);
  const days = Math.max(0, daysBetween(lot.purchasedAt, app.today));
  const last = s.lastWeighing;
  const groups = app.lotGroups(lot.id);

  // Só aparecem as abas que têm o que mostrar; sem nenhuma, o resumo basta.
  const tabs: { value: Tab; label: string }[] = [
    { value: 'resumo', label: 'Resumo' },
    ...(finance ? [{ value: 'custos' as const, label: 'Custos' }] : []),
    ...(weighed ? [{ value: 'peso' as const, label: 'Peso' }] : []),
    ...(finance && s.sales.length > 0 ? [{ value: 'vendas' as const, label: 'Vendas' }] : []),
  ];
  const tab = tabs.some((t) => t.value === selected) ? selected : 'resumo';
  const exits = [
    s.headsSold > 0 ? plural(s.headsSold, 'vendida', 'vendidas') : null,
    s.headsDead > 0 ? plural(s.headsDead, 'morte', 'mortes') : null,
    lot.transfer?.outgoing ? plural(lot.transfer.outgoing.heads, 'transferida', 'transferidas') : null,
  ].filter(Boolean);

  // Ações do dia a dia logo abaixo do resumo, como a fileira de um app de banco (Pix, Pagar…).
  const canMove = !lot.transfer?.outgoing && app.farmPastures(lot.farmId).length > 1;
  const actions: QuickAction[] = s.headsCurrent > 0 ? [
    { key: 'pesagem', label: 'Pesagem', icon: Scale, primary: true, onPress: () => router.push({ pathname: '/novo/pesagem', params: { lote: lot.id } }) },
    ...(canMove ? [{ key: 'pasto', label: 'Mudar de pasto', icon: MapIcon, onPress: () => router.push({ pathname: '/novo/manejo', params: { lote: lot.id } }) }] : []),
    { key: 'venda', label: 'Venda', icon: HandCoins, onPress: () => router.push({ pathname: '/novo/venda', params: { lote: lot.id } }) },
    { key: 'morte', label: 'Mortalidade', icon: TriangleAlert, onPress: () => router.push({ pathname: '/novo/mortalidade', params: { lote: lot.id } }) },
  ] : [];
  const openPasture = groups.length > 0 ? () => router.push({ pathname: '/pastos/[id]', params: { id: groups[0].pastureId } }) : undefined;

  return (
    <Screen>
      <FadeIn index={0}>
        <Card style={styles.hero}>
          <View style={styles.heroTop}>
            <View style={[styles.heroIcon, { backgroundColor: p.fill }]}>
              <CategoryIcon category={lot.category} size={48} />
            </View>
            <View style={styles.heroTitle}>
              <View style={styles.badges}>
                <Badge label={lot.category} tone="accent" />
                {s.headsCurrent === 0 ? <Badge label={lot.transfer?.outgoing ? 'Transferido' : 'Encerrado'} /> : null}
              </View>
              <AppText variant="largeTitle">Origem {lot.code}</AppText>
              <AppText variant="caption" tone="muted">
                {[farmName, operationLabel].filter(Boolean).join(' · ')}
              </AppText>
            </View>
            {edit ? <IconButton icon="pencil-outline" accessibilityLabel="Editar lote" onPress={edit} /> : null}
          </View>

          <View style={styles.facts}>
            <Fact icon="map-marker-outline" text={pastureLabel(app, s)} onPress={openPasture} label="Ver ocupação e ganho de peso por pasto" />
            <Fact icon="calendar-outline" text={`Entrada em ${formatDate(lot.purchasedAt)} · ${days === 0 ? 'hoje' : `há ${plural(days, 'dia', 'dias')}`}`} />
          </View>

          <View style={styles.metrics}>
            <Metric label="Cabeças" value={String(s.headsCurrent)} hint={`de ${lot.headsPurchased}`} />
            <Metric
              label={weighed ? 'Peso médio' : 'Peso entrada'}
              value={`${last.method === 'estimado' ? '≈' : ''}${formatNumber(last.kg)} kg`}
              hint={weighed ? `em ${formatDateShort(last.date)}` : 'sem pesagem'}
            />
            {weighed ? <Metric label="Ganho/dia" value={formatGmd(s).replace(' kg/dia', ' kg')} hint="média" /> : null}
          </View>

          {exits.length > 0 ? (
            <AppText variant="caption" tone="muted">
              Saíram do lote: {exits.join(' · ')}
            </AppText>
          ) : null}
        </Card>
      </FadeIn>

      {actions.length > 0 ? (
        <FadeIn index={1}>
          <QuickActions actions={actions} />
        </FadeIn>
      ) : null}

      {lot.transfer?.outgoing ? <Note icon="truck-check-outline" boxed title={`Transferido para ${lot.transfer.outgoing.farmName}`}>
        {`${plural(lot.transfer.outgoing.heads, 'cabeça', 'cabeças')} em ${formatDate(lot.transfer.outgoing.at)}. O histórico permanece nesta fazenda.`}
      </Note> : null}
      {lot.transfer?.outgoing && app.lotSummary(lot.transfer.outgoing.destinationLotId) ? <Group><ListRow icon="arrow-right" title="Ver lote na fazenda de destino"
        onPress={() => router.push({ pathname: '/lote/[id]', params: { id: lot.transfer!.outgoing!.destinationLotId } })} /></Group> : null}
      {lot.transfer?.incoming ? <Group><ListRow icon="truck-delivery-outline" title={`Recebido de ${lot.transfer.incoming.farmName}`}
        subtitle={`Transferência em ${formatDate(lot.transfer.incoming.at)} · custo acumulado na origem`}
        onPress={app.farm(lot.transfer.incoming.farmId) ? () => router.push({ pathname: '/lote/[id]', params: { id: lot.transfer!.incoming!.sourceLotId } }) : undefined} /></Group> : null}
      {s.pendingCount > 0 ? (
        <Note icon="clock-outline" tone="warning">
          {`${plural(s.pendingCount, 'lançamento pendente ainda não entra', 'lançamentos pendentes ainda não entram')} nos números.`}
        </Note>
      ) : null}

      {tabs.length > 1 ? <Segmented accessibilityLabel="Seções do lote" options={tabs} value={tab} onChange={setSelected} /> : null}

      <FadeIn key={tab}>
        <View style={styles.tab}>
          {tab === 'resumo' ? <Resumo s={s} finance={finance} onEdit={edit} /> : null}
          {tab === 'custos' ? <Custos s={s} /> : null}
          {tab === 'peso' ? <Peso s={s} /> : null}
          {tab === 'vendas' ? <Vendas s={s} /> : null}
        </View>
      </FadeIn>

      {finance && !lot.transfer?.outgoing && s.headsCurrent > 0 && app.visibleFarms.length > 1 ? (
        <Group>
          <ListRow
            icon="truck-delivery-outline"
            title="Transferir para outra fazenda"
            subtitle="Mover todos os animais deste lote"
            onPress={() => router.push({ pathname: '/lote/transferir/[id]', params: { id: lot.id } })}
          />
        </Group>
      ) : null}
    </Screen>
  );
}

function Fact({ icon, text, onPress, label }: { icon: 'map-marker-outline' | 'calendar-outline'; text: string; onPress?: () => void; label?: string }) {
  const p = usePalette();
  const content = (
    <>
      <Icon name={icon} size={16} color={onPress ? p.accent : p.textMuted} />
      <AppText variant="caption" tone={onPress ? 'accent' : 'muted'} numberOfLines={1} style={styles.flex}>
        {text}
      </AppText>
      {onPress ? <Icon name="chevron-right" size={16} color={p.accent} /> : null}
    </>
  );
  if (!onPress) return <View style={styles.fact}>{content}</View>;
  return (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel={`${text}. ${label ?? ''}`}
      hitSlop={8}
      onPress={() => {
        haptics.tap();
        onPress();
      }}
      style={({ pressed }) => [styles.fact, { opacity: pressed ? 0.6 : 1 }]}>
      {content}
    </Pressable>
  );
}

/** Indicador do cabeçalho: rótulo, número grande e contexto curto. */
function Metric({ label, value, hint }: { label: string; value: string; hint: string }) {
  const p = usePalette();
  return (
    <View style={[styles.metric, { backgroundColor: p.fill }]}>
      <AppText variant="caption" tone="muted" numberOfLines={1}>
        {label}
      </AppText>
      <AppText variant="heading" numeric numberOfLines={1}>
        {value}
      </AppText>
      <AppText variant="caption" tone="faint" numberOfLines={1}>
        {hint}
      </AppText>
    </View>
  );
}

function Resumo({ s, finance, onEdit }: { s: LotSummary; finance: boolean; onEdit?: () => void }) {
  const { lot } = s;
  const gta = lot.gtaNumbers ?? [];
  const invoices = lot.invoiceNumbers ?? [];
  return (
    <>
      {hasWeighing(s) ? (
        <WeightGain s={s} />
      ) : s.headsCurrent > 0 ? (
        <Note icon="scale-balance" title="Nenhuma pesagem ainda" boxed>
          {`O ganho de peso aparece depois da primeira pesagem. O lote entrou com ${formatNumber(lot.entryWeightKg)} kg em ${formatDate(lot.purchasedAt)}.`}
        </Note>
      ) : null}

      {!finance ? (
        restricted
      ) : s.totalCostCents === 0 && s.sales.length === 0 ? (
        <Note icon="cash" title="Nenhum custo lançado">
          {onEdit ? 'Informe o custo de entrada em Editar ou lance despesas para acompanhar o investimento.' : 'Lance despesas para acompanhar o investimento.'}
        </Note>
      ) : (
        <Money s={s} />
      )}

      <Section title={lot.transfer?.incoming ? 'Dados da entrada por transferência' : 'Dados da compra'} action={onEdit ? { label: 'Editar', onPress: onEdit } : undefined}>
        <Group>
          <ListRow
            icon="scale-balance"
            title={`${plural(lot.headsPurchased, 'cabeça', 'cabeças')} · ${formatNumber(lot.entryWeightKg)} kg`}
            subtitle={`Entrada em ${formatDate(lot.purchasedAt)}`}
          />
          <ListRow icon="account-outline" title={lot.supplier || 'Não informada'} subtitle="Origem dos animais" />
          {finance ? (
            <ListRow
              icon="cash"
              title={s.acquisitionCents > 0 ? formatCents(s.acquisitionCents) : 'Não informado'}
              subtitle={lot.transfer?.incoming ? 'Custo acumulado recebido da origem' : 'Custo de entrada · animais, comissão e frete'}
            />
          ) : null}
          <PurchasePaymentRow lot={lot} />
          {gta.length === 0 && invoices.length === 0 ? (
            <ListRow icon="file-document-outline" title="Nenhum documento" subtitle="GTA e nota fiscal" />
          ) : null}
          {gta.length > 0 ? (
            <ListRow icon="file-document-outline" title={gta.join(', ')} subtitle={gta.length > 1 ? `${gta.length} GTAs` : 'GTA'} />
          ) : null}
          {invoices.length > 0 ? (
            <ListRow
              icon="receipt-text-outline"
              title={invoices.join(', ')}
              subtitle={invoices.length > 1 ? `${invoices.length} notas fiscais` : 'Nota fiscal'}
            />
          ) : null}
        </Group>
      </Section>
    </>
  );
}

/** Ganho de peso: só com pesagem além da entrada. */
function WeightGain({ s }: { s: LotSummary }) {
  const p = usePalette();
  const first = s.weighings[0];
  const last = s.lastWeighing;
  const gain = last.kg - first.kg;
  return (
    <Section title="Ganho de peso">
      <Card>
        <BarChart
          accessibilityLabel={`Evolução do peso: ${s.weighings.map((w) => `${formatDate(w.date)} ${w.kg} kg ${w.method}`).join(', ')}`}
          data={s.weighings.slice(-6).map((w, i) => ({
            key: `${w.date}-${i}`,
            label: formatDateShort(w.date),
            value: w.kg,
            estimated: w.method === 'estimado',
          }))}
          formatValue={(v) => formatNumber(v)}
        />
        <Divider />
        <View style={styles.weightRow}>
          <WeightPoint caption={`Entrada · ${formatDateShort(first.date)}`} kg={first.kg} estimated={false} />
          <Icon name="arrow-right" size={20} color={p.textFaint} />
          <WeightPoint caption={`Última · ${formatDateShort(last.date)}`} kg={last.kg} estimated={last.method === 'estimado'} />
        </View>
        <Divider />
        <KV
          label="Ganho médio diário"
          value={formatGmd(s)}
          strong
          hint={s.gmdEstimated ? 'com base em estimativa' : undefined}
        />
        <KV
          label="Ganho no período"
          value={`${gain >= 0 ? '+' : '−'}${formatNumber(Math.abs(gain))} kg`}
          hint={`em ${plural(daysBetween(first.date, last.date), 'dia', 'dias')}`}
        />
      </Card>
    </Section>
  );
}

function WeightPoint({ caption, kg, estimated }: { caption: string; kg: number; estimated: boolean }) {
  return (
    <View style={styles.weightCol}>
      <AppText variant="caption" tone="faint">
        {caption}
      </AppText>
      <AppText variant="title" numeric>
        {estimated ? '≈' : ''}
        {formatNumber(kg)} kg
      </AppText>
      <WeightTag method={estimated ? 'estimado' : 'medido'} />
    </View>
  );
}

/** Dinheiro do lote: antes da venda, quanto já custou; depois, o resultado. */
function Money({ s }: { s: LotSummary }) {
  const sold = s.sales.length > 0;
  const breakEven = breakEvenPerArrobaCents(s.remainingCostCents, s.headsCurrent, s.lastWeighing.kg);
  return (
    <Section title={sold ? 'Resultado' : 'Investimento'}>
      <Card>
        {sold ? (
          <>
            <Highlight
              label="Resultado real das vendas"
              value={formatCents(s.realResultCents)}
              tone={s.realResultCents >= 0 ? 'success' : 'danger'}
            />
            <Divider />
            <KV label="Receita das vendas" value={formatCents(s.revenueCents)} />
            <KV label="Custo acumulado" value={formatCents(s.totalCostCents)} />
            <KV label="Com aluguel de pastagem" value={formatCents(s.adjustedResultCents)} hint="custo de oportunidade, não é caixa" />
          </>
        ) : (
          <Highlight label="Custo acumulado" value={formatCents(s.totalCostCents)} />
        )}
        {s.headsCurrent > 0 ? (
          <KV label="Custo por cabeça hoje" value={formatCents(s.costPerHeadCents)} hint={sold ? 'dos que continuam no lote' : undefined} />
        ) : null}
        {breakEven !== null ? (
          <KV
            label="Para empatar"
            value={`${formatCents(breakEven)}/@`}
            strong
            hint={`preço da @ vendendo hoje · estimativa com ${formatNumber(ESTIMATED_CARCASS_YIELD * 100)}% de rendimento`}
          />
        ) : null}
        {!sold && s.expensesCents > 0 ? (
          <KV label="Despesas depois da compra" value={formatCents(s.expensesCents)} hint={plural(s.expenseItems.length, 'lançamento', 'lançamentos')} />
        ) : null}
        {!sold ? (
          <AppText variant="caption" tone="faint">
            O resultado aparece depois da primeira venda.
          </AppText>
        ) : null}
      </Card>
    </Section>
  );
}

function Highlight({ label, value, tone }: { label: string; value: string; tone?: 'success' | 'danger' }) {
  return (
    <View style={styles.highlight}>
      <AppText variant="caption" tone="muted">
        {label}
      </AppText>
      <AppText variant="title" numeric tone={tone}>
        {value}
      </AppText>
    </View>
  );
}

function Custos({ s }: { s: LotSummary }) {
  const [perHead, setPerHead] = useState(false);
  const div = perHead ? s.lot.headsPurchased : 1;
  const fmt = (cents: number) => formatCents(Math.round(cents / div));
  const soldCost = s.sales.reduce((acc, sale) => acc + sale.soldCostCents, 0);

  return (
    <>
      <Segmented
        accessibilityLabel="Unidade dos custos"
        options={[
          { value: 'total', label: 'Total' },
          { value: 'cabeca', label: 'Por cabeça' },
        ]}
        value={perHead ? 'cabeca' : 'total'}
        onChange={(v) => setPerHead(v === 'cabeca')}
      />
      <Card>
        <KV label="Custo acumulado" value={fmt(s.totalCostCents)} strong />
        {soldCost > 0 ? <KV label="Saiu com as vendas" value={`− ${fmt(soldCost)}`} /> : null}
        {soldCost > 0 ? <KV label="Fica com os remanescentes" value={fmt(s.remainingCostCents)} strong /> : null}
      </Card>
      <Section title="Compra">
        <Card>
          <KV label="Animais" value={fmt(s.lot.purchaseCents)} />
          <KV label="Comissão" value={fmt(s.lot.commissionCents)} />
          <KV label="Frete" value={fmt(s.lot.freightCents)} />
        </Card>
      </Section>
      <Section title="Despesas apropriadas">
        {s.expenseItems.length === 0 ? (
          <AppText tone="faint">Nenhuma despesa aprovada para este lote ainda.</AppText>
        ) : (
          <Group>
            {s.expenseItems.map((item) => (
              <ListRow
                key={item.entryId}
                title={item.title}
                subtitle={`${formatDate(item.date)} · ${CRITERION_LABEL[item.criterion].toLowerCase()}`}
                right={
                  <AppText numeric variant="bodyStrong">
                    {fmt(item.cents)}
                  </AppText>
                }
                onPress={() => router.push({ pathname: '/lancamento/[id]', params: { id: item.entryId } })}
              />
            ))}
          </Group>
        )}
      </Section>
      {s.pastureRentAccruedCents > 0 ? (
        <Note icon="sprout-outline" title={`Aluguel simbólico: ${fmt(s.pastureRentAccruedCents)}`}>
          Cabeça-dia × tarifa da fazenda. Só entra no resultado ajustado; não é caixa.
        </Note>
      ) : null}
    </>
  );
}

function Peso({ s }: { s: LotSummary }) {
  return (
    <>
      <Card>
        <BarChart
          accessibilityLabel={`Evolução do peso: ${s.weighings.map((w) => `${formatDate(w.date)} ${w.kg} kg ${w.method}`).join(', ')}`}
          data={s.weighings.map((w, i) => ({
            key: `${w.date}-${i}`,
            label: formatDateShort(w.date),
            value: w.kg,
            estimated: w.method === 'estimado',
          }))}
          formatValue={(v) => formatNumber(v)}
        />
        {s.weighings.some((w) => w.method === 'estimado') ? (
          <AppText variant="caption" tone="faint">
            Barras vazadas com ≈ são estimativas visuais.
          </AppText>
        ) : null}
      </Card>
      <Group>
        {[...s.weighings].reverse().map((w, i) => (
          <ListRow
            key={`${w.date}-${i}`}
            title={`${formatNumber(w.kg, 1)} kg`}
            subtitle={`${formatDate(w.date)} · ${w.entryId ? `${w.heads} cab. avaliadas` : 'entrada na compra'}`}
            right={<WeightTag method={w.method} />}
            onPress={w.entryId ? () => router.push({ pathname: '/lancamento/[id]', params: { id: w.entryId! } }) : undefined}
          />
        ))}
      </Group>
    </>
  );
}

function Vendas({ s }: { s: LotSummary }) {
  return (
    <>
      {s.sales.map((sale) => (
        <Section key={sale.entryId} title={`${formatDate(sale.date)} · ${plural(sale.heads, 'cabeça', 'cabeças')} · ${sale.buyer}`}>
          <Card>
            <Highlight
              label="Resultado real"
              value={formatCents(sale.realResultCents)}
              tone={sale.realResultCents >= 0 ? 'success' : 'danger'}
            />
            <Divider />
            <KV label="Carcaça" value={`${formatNumber(sale.carcassKg)} kg · ${formatNumber(sale.arrobas, 2)} @`} />
            <KV label="Preço negociado" value={`${formatCents(sale.pricePerArrobaCents)}/@`} />
            <KV label="Receita bruta" value={formatCents(sale.grossCents)} />
            <KV label="Deduções" value={`− ${formatCents(sale.deductionsCents)}`} />
            <KV label="Custo dos vendidos" value={`− ${formatCents(sale.soldCostCents)}`} />
            <KV label="Com aluguel de pastagem" value={formatCents(sale.adjustedResultCents)} hint={`− ${formatCents(sale.pastureRentCents)} simbólico`} />
          </Card>
        </Section>
      ))}
      {s.headsCurrent > 0 ? (
        <Note>{`Venda parcial não encerra o lote: ${plural(s.headsCurrent, 'cabeça segue', 'cabeças seguem')} com ${formatCents(s.costPerHeadCents)} de custo cada.`}</Note>
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  hero: { gap: space.md },
  heroTop: { flexDirection: 'row', alignItems: 'flex-start', gap: space.md },
  heroIcon: { width: 60, height: 60, borderRadius: radius.lg, alignItems: 'center', justifyContent: 'flex-end', paddingBottom: 4 },
  heroTitle: { flex: 1, gap: space.xs },
  badges: { flexDirection: 'row', gap: space.xs, marginBottom: 2 },
  facts: { gap: space.xs },
  fact: { flexDirection: 'row', alignItems: 'center', gap: space.xs },
  metrics: { flexDirection: 'row', gap: space.sm },
  metric: { flex: 1, borderRadius: radius.lg, paddingHorizontal: space.sm + 2, paddingVertical: space.sm, gap: 2 },
  highlight: { gap: 2 },
  tab: { gap: space.lg },
  weightRow: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  weightCol: { flex: 1, gap: space.xs },
});
