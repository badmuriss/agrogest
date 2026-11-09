import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useSQLiteContext } from 'expo-sqlite';
import { readDocumentDraft, saveDocumentDraft, type DocumentDraft } from '@/services/documents';
import { Pressable, StyleSheet, View } from 'react-native';

import {
  AllocationEditor,
  initialAllocationState,
  resolveAllocation,
  type AllocationState,
} from '@/components/allocation-editor';
import { ToggleGroup } from '@/components/fields';
import { CounterpartyField } from '@/components/finance-ui';
import { FarmPicker } from '@/components/pickers';
import { draftsFrom, resolveStockItems, StockItemsEditor, type StockItemDraft } from '@/components/stock-ui';
import { Button, Chip, ChipWrap, Note, Segmented } from '@/components/ui/controls';
import { BigMoneyField, DateField, Field, TextField } from '@/components/ui/form';
import { Card, Divider, KV, Screen, Section } from '@/components/ui/layout';
import { FadeIn, haptics, PressableScale } from '@/components/ui/motion';
import { AppText, Icon, type IconName } from '@/components/ui/text';
import { DoneState, SubmitButtons } from '@/components/wizard';
import { CRITERION_LABEL, monthlyInstallments } from '@/domain/allocation';
import { formatDate } from '@/domain/dates';
import { categoryOf, EXPENSE_NATURES, STOCK_CATEGORY_ID } from '@/domain/finance';
import { formatCents, plural } from '@/domain/format';
import { formatQty } from '@/domain/stock';
import type { Entry, Installment, NfDestination } from '@/domain/types';
import { CostCenterField } from '@/components/cost-center-field';
import { useApp } from '@/state/app-state';
import { radius, space, usePalette } from '@/theme';

/** Ícone de cada categoria padrão; as criadas pela pessoa usam a etiqueta. */
const CATEGORY_ICON: Record<string, IconName> = {
  'cat-alimentacao': 'sack',
  'cat-mao-de-obra': 'account-hard-hat-outline',
  'cat-medicamentos': 'needle',
  'cat-cercas': 'fence',
  'cat-pastagem': 'grass',
  'cat-combustivel': 'gas-station-outline',
  'cat-frete': 'truck-outline',
  'cat-animais': 'cow',
  'cat-administrativas': 'file-document-outline',
  'cat-impostos': 'bank-outline',
  'cat-investimentos': 'tractor-variant',
  'cat-outros': 'dots-horizontal',
};

/** Quantas categorias aparecem antes de "Ver todas" (as mais usadas primeiro). */
const TOP_CATEGORIES = 6;

/**
 * Despesa numa tela só, como lançar um gasto no Organizze ou um Pix no Nubank: valor grande,
 * descrição, categoria e data. Fazenda, fornecedor, pagamento, rateio entre lotes e compra para o
 * estoque ficam em "Mais detalhes", já preenchidos pelo padrão (à vista, dividido por cabeça entre
 * os lotes ativos). Antes de registrar, o impacto e quem aprova ficam à vista.
 */
export default function DespesaScreen() {
  const app = useApp();
  const p = usePalette();
  const db = useSQLiteContext();
  const loadedImport = useRef<string | null>(null);
  const [imported, setImported] = useState<DocumentDraft | null>(null);
  const params = useLocalSearchParams<{ id?: string; destino?: string; recorrencia?: string; mes?: string; importacao?: string }>();
  const existing = params.id ? app.entry(params.id) : undefined;
  const initial = existing?.kind === 'despesa' ? existing : undefined;
  // Lançar o mês de uma despesa recorrente: o modelo preenche o formulário.
  const template = !initial && params.recorrencia ? app.recurrences.find((r) => r.id === params.recorrencia) : undefined;
  const recurrence = initial?.payload.recurrence ?? (template && params.mes ? { id: template.id, month: params.mes } : null);
  const templateDue = template && params.mes ? `${params.mes}-${String(template.dayOfMonth).padStart(2, '0')}` : null;
  const initialFarm = initial?.farmId ?? template?.farmId ?? app.defaultFarmId;
  const activeLots = (farmId: string) => app.farmLotSummaries(farmId).filter((s) => s.headsCurrent > 0);

  const [destination, setDestination] = useState<NfDestination>(
    initial?.payload.destination ?? (params.destino === 'estoque' ? 'estoque' : 'despesa'),
  );
  const [categoryId, setCategoryId] = useState<string | null>(() =>
    initial ? (categoryOf(initial.payload, app.categories)?.id ?? null) : (template?.categoryId ?? null),
  );
  const [costCenterId, setCostCenterId] = useState<string | null>(initial?.payload.costCenterId ?? template?.costCenterId ?? null);
  const [amountCents, setAmountCents] = useState(initial?.amountCents ?? template?.cents ?? 0);
  const [description, setDescription] = useState(
    initial?.payload.description ?? (template && params.mes ? `${template.title} · ${params.mes.slice(5, 7)}/${params.mes.slice(0, 4)}` : ''),
  );
  const [date, setDate] = useState(initial?.occurredAt ?? (templateDue && templateDue < app.today ? templateDue : app.today));
  const [farmId, setFarmId] = useState(initialFarm);
  const [supplier, setSupplier] = useState(initial?.payload.supplier ?? template?.counterparty ?? '');
  const [counterpartyId, setCounterpartyId] = useState<string | null>(initial?.payload.counterpartyId ?? template?.counterpartyId ?? null);
  const [document, setDocument] = useState(initial?.payload.document ?? '');
  const [parcelado, setParcelado] = useState((initial?.payload.installments.length ?? 1) > 1);
  const [count, setCount] = useState(Math.max(2, initial?.payload.installments.length ?? 2));
  const [firstDue, setFirstDue] = useState(initial?.payload.installments[0]?.dueDate ?? templateDue ?? app.today);
  const [alloc, setAlloc] = useState<AllocationState>(() =>
    initial
      ? {
          criterion: initial.payload.criterion,
          selectedIds: initial.payload.allocations.map((a) => a.lotId),
          manualPct:
            initial.payload.criterion === 'manual'
              ? Object.fromEntries(initial.payload.allocations.map((a) => [a.lotId, String(a.basis)]))
              : {},
        }
      : initialAllocationState(activeLots(initialFarm)),
  );
  const [items, setItems] = useState<StockItemDraft[]>(() => {
    const restored = draftsFrom(initial?.payload.stockItems);
    return restored.length > 0 ? restored : [{ supplyId: null, quantityText: '', unit: null, cents: 0 }];
  });
  // Editando, compra para o estoque ou vinda de uma recorrência: os detalhes já importam, abrem abertos.
  const [detailsOpen, setDetailsOpen] = useState(!!initial || params.destino === 'estoque' || !!template);
  const [allCategories, setAllCategories] = useState(false);
  const [touched, setTouched] = useState(false);
  const [busy, setBusy] = useState(false);
  const [saveFailed, setSaveFailed] = useState(false);
  const [saved, setSaved] = useState<Entry | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  useEffect(() => {
    if (!params.importacao || loadedImport.current === params.importacao) return;
    loadedImport.current = params.importacao;
    void readDocumentDraft(db, params.importacao).then((draft) => {
      if (!draft?.extraction || !draft.reviewed || !draft.serverId) { setImportError('Reabra a captura e conclua a leitura e revisão antes de importar.'); return; }
      if (draft.entryId && app.entry(draft.entryId)) { router.replace(`/lancamento/${draft.entryId}`); return; }
      setImported(draft); setFarmId(draft.farmId);
      setAmountCents(draft.reviewed.amountCents ?? 0);
      setDate(draft.reviewed.occurredAt ?? app.today); setFirstDue(draft.reviewed.occurredAt ?? app.today);
      setDescription(draft.reviewed.description ?? ''); setSupplier(draft.reviewed.supplier ?? ''); setDocument(draft.reviewed.document ?? '');
      setAlloc(initialAllocationState(app.farmLotSummaries(draft.farmId).filter((x) => x.headsCurrent > 0)));
      setDetailsOpen(true);
    }).catch(() => setImportError('Não foi possível abrir a captura salva.'));
  }, [db, params.importacao, app]);

  const stock = destination === 'estoque';
  const farm = app.farm(farmId);
  const lots = activeLots(farmId);
  const allocation = resolveAllocation(lots, amountCents, alloc);
  // Um item só já começa com o valor da compra: o caso mais comum (um caminhão de sal).
  const itemDrafts = items.length === 1 && items[0].cents === 0 ? [{ ...items[0], cents: amountCents }] : items;
  const stockItems = resolveStockItems(itemDrafts, amountCents, (id) => app.supply(id));
  const installments: Installment[] = parcelado
    ? monthlyInstallments(amountCents, count, firstDue)
    : [{ dueDate: firstDue, cents: amountCents }];
  const approvers = farm
    ? app.approversFor({ authorId: initial?.authorId ?? app.user.id, operationId: farm.operationId, kind: 'despesa' })
    : [];
  const options = app.categories.filter(
    (c) => c.active && EXPENSE_NATURES.includes(c.nature) && c.id !== STOCK_CATEGORY_ID && (c.operationId === null || c.operationId === farm?.operationId),
  );
  const category = stock ? app.categories.find((c) => c.id === STOCK_CATEGORY_ID) : options.find((c) => c.id === categoryId);
  const partner = farm ? app.canSeeFinance(farm.operationId) : false;

  // As mais usadas por esta pessoa primeiro; a escolhida sempre à vista, mesmo fora das primeiras.
  const usage = useMemo(() => {
    const counts = new Map<string, number>();
    for (const e of app.visibleEntries) {
      if (e.kind !== 'despesa' || e.authorId !== app.user.id) continue;
      const id = categoryOf(e.payload, app.categories)?.id;
      if (id) counts.set(id, (counts.get(id) ?? 0) + 1);
    }
    return counts;
  }, [app.visibleEntries, app.categories, app.user.id]);
  const ranked = [...options].sort((a, b) => (usage.get(b.id) ?? 0) - (usage.get(a.id) ?? 0));
  const shownCategories = allCategories ? ranked : ranked.slice(0, TOP_CATEGORIES);
  if (category && !stock && !shownCategories.includes(category)) shownCategories.push(category);

  const missing = [
    amountCents > 0 ? null : 'o valor',
    description.trim() ? null : 'a descrição',
    category ? null : 'a categoria',
    farm ? null : 'a fazenda',
  ].filter((m): m is string => m !== null);
  const detailError = stock ? stockItems.error : allocation.error;
  const canSave = missing.length === 0 && !detailError;

  if (saved) {
    return (
      <Screen>
        <DoneState entry={saved} againLabel="Outra despesa" onAgain={() => router.replace('/novo/despesa')} />
      </Screen>
    );
  }

  const save = async (submit: boolean) => {
    if (busy) return;
    setTouched(true);
    if (importError || !canSave || !farm || !category) {
      if (detailError) setDetailsOpen(true);
      return;
    }
    setSaveFailed(false);
    const sourceId = imported?.serverId ?? initial?.payload.sourceDocumentId;
    if (sourceId && app.visibleEntries.some((e) => e.id !== initial?.id && e.kind === 'despesa' && e.payload.sourceDocumentId === sourceId)) { setImportError('Este comprovante já está em outra despesa. Abra a despesa existente.'); return; }
    setBusy(true);
    try {
      const entry = await app.saveEntry(
        {
          kind: 'despesa',
          payload: {
            ...(sourceId ? { sourceDocumentId: sourceId } : {}),
            category: category.name,
            categoryId: category.id,
            costCenterId,
            description: description.trim(),
            supplier: supplier.trim(),
            counterpartyId,
            document: document.trim(),
            installments,
            criterion: alloc.criterion,
            allocations: stock ? [] : allocation.allocations,
            ...(stock ? { destination: 'estoque' as const, stockItems: stockItems.items } : {}),
            ...(recurrence && !stock ? { recurrence } : {}),
          },
          operationId: farm.operationId,
          farmId: farm.id,
          title: description.trim(),
          amountCents,
          occurredAt: date,
        },
        { submit, existingId: initial?.id },
      );
      if (imported) await saveDocumentDraft(db, { ...imported, entryId: entry.id, reviewed: { amountCents, occurredAt: date, description: description.trim(), supplier: supplier.trim(), document: document.trim() } });
      setSaved(entry);
    } catch {
      setSaveFailed(true);
    } finally {
      setBusy(false);
    }
  };

  const selectedLots = stock ? 0 : allocation.allocations.length;
  const detailSummary = [
    app.visibleFarms.length > 1 && farm ? farm.name : null,
    parcelado ? `${count}x, 1ª vence ${formatDate(firstDue)}` : `À vista, vence ${formatDate(firstDue)}`,
    stock
      ? 'entra no estoque'
      : lots.length === 0
        ? 'despesa geral da fazenda'
        : selectedLots > 0
          ? `dividida entre ${plural(selectedLots, 'lote', 'lotes')} ${CRITERION_LABEL[alloc.criterion].toLowerCase()}`
          : 'sem lote escolhido',
    supplier.trim() ? supplier.trim() : null,
  ].filter(Boolean).join(' · ');

  return (
    <Screen
      footer={
        // Usa as mesmas regras do salvamento para não oferecer um rascunho que não será salvo.
        <SubmitButtons
          disabled={busy}
          draftDisabled={busy || !canSave}
          busy={busy}
          onSave={save}
          scope={farm ? { operationId: farm.operationId, kind: 'despesa' } : undefined}
        />
      }>
      {importError ? <Note tone="danger">{importError}</Note> : null}
      {imported ? <Note title="Comprovante revisado">Confira a categoria, as parcelas e o rateio. A despesa seguirá a aprovação normal da operação.</Note> : !initial ? <Button title="Importar imagem de comprovante" variant="secondary" icon="camera-outline" onPress={() => router.push('/novo/importar-despesa')} /> : null}
      <FadeIn index={0} style={styles.amount}>
        <BigMoneyField
          accessibilityLabel="Valor da despesa"
          cents={amountCents}
          onChange={setAmountCents}
          autoFocus={!initial && !template}
          invalid={touched && amountCents === 0}
        />
        <TextField
          accessibilityLabel="Descrição"
          value={description}
          onChangeText={setDescription}
          placeholder={stock ? 'Ex.: Caminhão de sal mineral' : 'Ex.: Diária de outubro'}
          invalid={touched && !description.trim()}
        />
      </FadeIn>

      {farm ? <CostCenterField operationId={farm.operationId} value={costCenterId} onChange={setCostCenterId} /> : null}
      <FadeIn index={1}>
        {stock ? (
          <Note icon="silo">O valor entra no estoque e vira conta a pagar. Os lotes recebem o custo quando você apontar o consumo.</Note>
        ) : (
          <Field label="Categoria" error={touched && !category ? 'Escolha a categoria.' : null}>
            <View style={styles.grid} accessibilityRole="radiogroup">
              {shownCategories.map((c) => {
                const selected = c.id === categoryId;
                return (
                  <PressableScale
                    key={c.id}
                    accessibilityRole="radio"
                    accessibilityState={{ checked: selected }}
                    accessibilityLabel={c.name}
                    onPress={() => {
                      haptics.tap();
                      setCategoryId(c.id);
                    }}
                    scaleTo={0.96}
                    containerStyle={styles.cell}
                    style={[
                      styles.tile,
                      { backgroundColor: selected ? p.accentSoft : p.surface, borderColor: selected ? p.accent : p.border },
                    ]}>
                    <Icon name={CATEGORY_ICON[c.id] ?? 'tag-outline'} size={24} color={selected ? p.accent : p.text} />
                    <AppText variant="caption" numberOfLines={2} style={[styles.tileLabel, { color: selected ? p.accent : p.text }]}>
                      {c.name}
                    </AppText>
                  </PressableScale>
                );
              })}
            </View>
            {ranked.length > TOP_CATEGORIES ? (
              <Pressable accessibilityRole="button" onPress={() => setAllCategories((v) => !v)} hitSlop={8} style={({ pressed }) => [styles.more, pressed && { opacity: 0.6 }]}>
                <AppText variant="bodyStrong" tone="accent">
                  {allCategories ? 'Ver menos' : `Ver todas (${ranked.length})`}
                </AppText>
              </Pressable>
            ) : null}
          </Field>
        )}
      </FadeIn>

      <FadeIn index={2}>
        <DateField label="Quando aconteceu" value={date} onChange={setDate} />
      </FadeIn>

      <FadeIn index={3}>
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ expanded: detailsOpen }}
          accessibilityLabel={`Mais detalhes: ${detailSummary}`}
          onPress={() => {
            haptics.tap();
            setDetailsOpen((v) => !v);
          }}
          style={({ pressed }) => [styles.details, { backgroundColor: p.surface, borderColor: detailError && touched ? p.danger : p.border, opacity: pressed ? 0.8 : 1 }]}>
          <View style={styles.flex}>
            <AppText variant="bodyStrong">Mais detalhes</AppText>
            <AppText variant="caption" tone="muted">
              {detailSummary}
            </AppText>
          </View>
          <Icon name={detailsOpen ? 'chevron-up' : 'chevron-down'} size={22} color={p.textMuted} />
        </Pressable>
      </FadeIn>

      {detailsOpen ? (
        <FadeIn style={styles.detailBody}>
          <ToggleGroup
            accessibilityLabel="Para onde vai"
            options={[
              { value: 'despesa', label: 'Custo dos lotes' },
              { value: 'estoque', label: 'Compra para o estoque' },
            ]}
            value={destination}
            onChange={setDestination}
          />
          <FarmPicker
            value={farmId}
            onChange={(id) => {
              setFarmId(id);
              if (app.farm(id)?.operationId !== farm?.operationId) setCostCenterId(null);
              setAlloc(initialAllocationState(activeLots(id)));
              setCounterpartyId(null);
            }}
          />
          {farm && partner ? (
            <CounterpartyField
              operationId={farm.operationId}
              kind="fornecedor"
              label="Fornecedor"
              name={supplier}
              counterpartyId={counterpartyId}
              onChange={(name, id) => {
                setSupplier(name);
                setCounterpartyId(id);
              }}
            />
          ) : (
            <Field label="Fornecedor">
              <TextField value={supplier} onChangeText={setSupplier} placeholder="Opcional" />
            </Field>
          )}
          <Field label="Documento">
            <TextField value={document} onChangeText={setDocument} placeholder="Nº da nota ou recibo (opcional)" />
          </Field>

          <Section title="Pagamento">
            <Segmented
              accessibilityLabel="Forma de pagamento"
              options={[
                { value: 'avista', label: 'À vista' },
                { value: 'parcelado', label: 'Parcelado' },
              ]}
              value={parcelado ? 'parcelado' : 'avista'}
              onChange={(v) => setParcelado(v === 'parcelado')}
            />
            {parcelado ? (
              <Field label="Parcelas">
                <ChipWrap>
                  {[2, 3, 4, 5, 6, 10, 12].map((n) => (
                    <Chip key={n} label={`${n}x`} selected={count === n} onPress={() => setCount(n)} />
                  ))}
                </ChipWrap>
              </Field>
            ) : null}
            <DateField label={parcelado ? 'Primeiro vencimento' : 'Vencimento'} value={firstDue} onChange={setFirstDue} />
            {parcelado && amountCents > 0 ? (
              <Card>
                {installments.map((item, i) => (
                  <KV key={i} label={`${i + 1}ª · ${formatDate(item.dueDate)}`} value={formatCents(item.cents)} />
                ))}
              </Card>
            ) : null}
          </Section>

          <Section title={stock ? 'O que entra no estoque' : 'Dividir entre lotes'}>
            {stock ? (
              farm ? <StockItemsEditor operationId={farm.operationId} drafts={itemDrafts} onChange={setItems} totalCents={amountCents} /> : null
            ) : lots.length === 0 ? (
              <Note>Esta fazenda não tem lotes ativos. Fica como despesa geral.</Note>
            ) : (
              <AllocationEditor lots={lots} totalCents={amountCents} state={alloc} onChange={setAlloc} />
            )}
          </Section>
        </FadeIn>
      ) : null}

      {/* Antes de registrar: onde entra, o impacto nos lotes e quem aprova (critério de UX da seção 9). */}
      {farm && amountCents > 0 && category ? (
        <FadeIn index={4}>
          <Section title="Antes de registrar">
            <Card>
              <KV label="Operação" value={app.operation(farm.operationId)?.name ?? ''} strong />
              <KV label="Fazenda" value={farm.name} />
              <Divider />
              {stock ? (
                stockItems.items.map((item, i) => {
                  const s = app.supply(item.supplyId);
                  return <KV key={i} label={s?.name ?? 'Insumo'} hint={formatQty(item.quantity, s?.unit ?? '')} value={`+ ${formatCents(item.cents)}`} />;
                })
              ) : allocation.allocations.length === 0 ? (
                <KV label="Despesa geral da fazenda" value={formatCents(amountCents)} />
              ) : (
                allocation.allocations.map((a) => (
                  <KV
                    key={a.lotId}
                    label={`Origem ${lots.find((s) => s.lot.id === a.lotId)?.lot.code ?? ''}`}
                    value={`+ ${formatCents(a.cents)}`}
                  />
                ))
              )}
              <Divider />
              <KV
                label="Conta a pagar"
                value={plural(installments.length, 'parcela', 'parcelas')}
                hint={`a 1ª vence em ${formatDate(installments[0].dueDate)}`}
              />
              {stock ? <KV label="Custo nos lotes agora" value={formatCents(0)} hint="vem no consumo" /> : null}
            </Card>
            <Note icon="account-check-outline">
              {approvers.length > 0
                ? `Precisa da aprovação de outro sócio: ${approvers.map((u) => u.name).join(', ')}.`
                : 'Não há outro sócio para aprovar: entra direto.'}
            </Note>
          </Section>
        </FadeIn>
      ) : null}

      {touched && missing.length > 0 ? (
        <Note tone="danger" icon="alert-circle-outline">{`Falta informar ${missing.join(', ').replace(/, ([^,]*)$/, ' e $1')}.`}</Note>
      ) : touched && detailError ? (
        <Note tone="danger" icon="alert-circle-outline">{detailError}</Note>
      ) : null}
      {saveFailed ? <Note tone="danger" icon="alert-circle-outline">Não foi possível salvar a despesa. Confira os dados e tente novamente.</Note> : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, gap: 2 },
  amount: { gap: space.md },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  cell: { width: '48%', flexGrow: 1 },
  tile: {
    minHeight: 60,
    borderRadius: radius.lg,
    borderWidth: 1.5,
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
  },
  tileLabel: { flex: 1 },
  more: { alignSelf: 'flex-start', minHeight: 44, justifyContent: 'center' },
  details: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    padding: space.lg,
    minHeight: 64,
  },
  detailBody: { gap: space.xl },
});
