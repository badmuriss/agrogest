import { CRITERION_LABEL } from '@/domain/allocation';
import { carcassArrobas, saleGrossCents } from '@/domain/cattle';
import { formatDate } from '@/domain/dates';
import { saleInstallments } from '@/domain/finance';
import { formatCents, formatNumber, plural } from '@/domain/format';
import { lotAllocations } from '@/domain/lot-metrics';
import { formatQty, LOSS_TO_LOTS } from '@/domain/stock';
import type { Entry, Installment, StockItem } from '@/domain/types';
import { useApp } from '@/state/app-state';

import { WeightTag } from './status';
import { Note } from './ui/controls';
import { Card, Divider, KV, Section } from './ui/layout';

function Installments({ items, title = 'Pagamento' }: { items: Installment[]; title?: string }) {
  if (items.length === 0) return null;
  return (
    <Section title={`${title} · ${plural(items.length, 'parcela', 'parcelas')}`}>
      <Card>
        {items.map((item, i) => (
          <KV key={`${item.dueDate}-${i}`} label={`Vence ${formatDate(item.dueDate)}`} value={formatCents(item.cents)} />
        ))}
      </Card>
    </Section>
  );
}

function StockItems({ items, finance }: { items: StockItem[]; finance: boolean }) {
  const app = useApp();
  return (
    <Section title="Entra no estoque">
      <Card>
        {items.map((item, i) => {
          const supply = app.supply(item.supplyId);
          return (
            <KV
              key={`${item.supplyId}-${i}`}
              label={supply?.name ?? 'Insumo'}
              hint={item.purchaseUnit !== supply?.unit ? `${formatNumber(item.purchaseQuantity, 3)} ${item.purchaseUnit}` : undefined}
              value={`${formatQty(item.quantity, supply?.unit ?? '')}${finance ? ` · ${formatCents(item.cents)}` : ''}`}
            />
          );
        })}
      </Card>
    </Section>
  );
}

function basisText(criterion: string, basis: number, period: boolean): string {
  if (criterion === 'manual') return `${formatNumber(basis, 2)}%`;
  if (criterion === 'peso') return `${formatNumber(basis)} kg`;
  return `${formatNumber(basis)} ${period ? 'cab.-dia' : 'cab.'}`;
}

/** Conteúdo e impacto do lançamento, para o autor e o aprovador. */
export function EntryDetails({ entry }: { entry: Entry }) {
  const app = useApp();
  const finance = app.canSeeFinance(entry.operationId) || entry.authorId === app.user.id;
  const lotName = (lotId: string) => `Origem ${app.lotSummary(lotId)?.lot.code ?? ''}`;
  const allocations = lotAllocations(entry);

  if (!finance && entry.amountCents !== null) {
    return (
      <Note icon="lock-outline" title="Valores restritos">
        Seu vínculo nesta operação não inclui dados financeiros.
      </Note>
    );
  }

  const allocationSection =
    allocations.length > 0 && 'criterion' in entry.payload ? (
      <Section title={`Impacto nos lotes · ${CRITERION_LABEL[entry.payload.criterion].toLowerCase()}`}>
        <Card>
          {allocations.map((a) => (
            <KV key={a.lotId} label={lotName(a.lotId)} value={`+ ${formatCents(a.cents)}`} />
          ))}
          <Divider />
          <KV label="Total" value={formatCents(allocations.reduce((acc, a) => acc + a.cents, 0))} strong />
        </Card>
      </Section>
    ) : null;

  const pastureRow = (pastureId?: string | null) => (pastureId ? <KV label="Pasto" value={app.pastureName(pastureId)} /> : null);

  switch (entry.kind) {
    case 'manejo': {
      const { payload } = entry;
      const from = app.lotGroups(payload.lotId).find((g) => g.pastureId === payload.fromPastureId)?.heads ?? 0;
      return (
        <>
          <Card>
            <KV label="Lote" value={lotName(payload.lotId)} />
            <KV label="Sai de" value={app.pastureName(payload.fromPastureId)} />
            <KV label="Vai para" value={app.pastureName(payload.toPastureId)} strong />
            <KV label="Cabeças" value={String(payload.heads)} strong />
            {payload.notes ? <KV label="Observação" value={payload.notes} /> : null}
            {entry.status !== 'aprovado' ? (
              <KV label="Na origem, se aprovado" value={`${from} → ${Math.max(0, from - payload.heads)} cab.`} hint="saldo confirmado hoje" />
            ) : null}
          </Card>
          <Note icon="swap-horizontal">
            Mudança de pasto na mesma fazenda: o lote, os custos e o histórico continuam os mesmos. Não é compra, venda nem transferência.
          </Note>
        </>
      );
    }
    case 'pesagem': {
      const s = app.lotSummary(entry.payload.lotId);
      return (
        <Card>
          <KV label="Lote" value={lotName(entry.payload.lotId)} />
          {pastureRow(entry.payload.pastureId)}
          <KV label="Método" value={<WeightTag method={entry.payload.method} />} />
          <KV label="Peso médio" value={`${formatNumber(entry.payload.avgWeightKg, 1)} kg vivo`} strong />
          <KV label="Cabeças avaliadas" value={String(entry.payload.headsWeighed)} />
          {s ? (
            <KV
              label="Último aprovado"
              value={`${formatNumber(s.lastWeighing.kg)} kg`}
              hint={`${s.lastWeighing.method} em ${formatDate(s.lastWeighing.date)}`}
            />
          ) : null}
          {entry.payload.notes ? <KV label="Observação" value={entry.payload.notes} /> : null}
        </Card>
      );
    }
    case 'mortalidade': {
      const s = app.lotSummary(entry.payload.lotId);
      return (
        <Card>
          <KV label="Lote" value={lotName(entry.payload.lotId)} />
          {pastureRow(entry.payload.pastureId)}
          <KV label="Cabeças" value={String(entry.payload.heads)} strong />
          <KV label="Causa" value={entry.payload.cause} />
          {entry.payload.notes ? <KV label="Observação" value={entry.payload.notes} /> : null}
          {s && entry.status !== 'aprovado' ? (
            <KV label="Saldo, se aprovado" value={`${s.headsCurrent} → ${s.headsCurrent - entry.payload.heads} cab.`} />
          ) : null}
        </Card>
      );
    }
    case 'venda': {
      const { payload } = entry;
      const gross = saleGrossCents(payload.carcassKg, payload.pricePerArrobaCents);
      const s = app.lotSummary(payload.lotId);
      return (
        <>
          <Card>
            <KV label="Lote" value={lotName(payload.lotId)} />
            {pastureRow(payload.pastureId)}
            <KV label="Comprador" value={payload.buyer} />
            <KV label="Cabeças" value={String(payload.heads)} />
            <KV
              label="Carcaça (romaneio)"
              value={`${formatNumber(payload.carcassKg)} kg`}
              hint={`${formatNumber(carcassArrobas(payload.carcassKg), 2)} @`}
            />
            <KV label="Preço negociado" value={`${formatCents(payload.pricePerArrobaCents)}/@`} />
            <Divider />
            <KV label="Receita bruta" value={formatCents(gross)} />
            <KV label="Deduções" value={`− ${formatCents(payload.deductionsCents)}`} />
            <KV label="Receita líquida" value={formatCents(gross - payload.deductionsCents)} strong />
            {s && entry.status !== 'aprovado' ? (
              <KV label="Saldo, se aprovado" value={`${s.headsCurrent} → ${Math.max(0, s.headsCurrent - payload.heads)} cab.`} />
            ) : null}
          </Card>
          <Installments items={saleInstallments(entry)} title="Recebimento" />
        </>
      );
    }
    case 'despesa':
      if (entry.payload.destination === 'estoque') {
        return (
          <>
            <Card>
              <KV label="Categoria" value={entry.payload.category} />
              {entry.payload.supplier ? <KV label="Fornecedor" value={entry.payload.supplier} /> : null}
              {entry.payload.document ? <KV label="Documento" value={entry.payload.document} /> : null}
              <KV label="Valor" value={formatCents(entry.amountCents ?? 0)} strong />
            </Card>
            <StockItems items={entry.payload.stockItems ?? []} finance={finance} />
            <Note icon="silo">Compra não é consumo: o custo vai para os lotes quando o insumo for usado.</Note>
            <Installments items={entry.payload.installments} />
          </>
        );
      }
      return (
        <>
          <Card>
            <KV label="Categoria" value={entry.payload.category} />
            {entry.payload.supplier ? <KV label="Fornecedor" value={entry.payload.supplier} /> : null}
            {entry.payload.document ? <KV label="Documento" value={entry.payload.document} /> : null}
            <KV label="Valor" value={formatCents(entry.amountCents ?? 0)} strong />
          </Card>
          {allocationSection ?? (
            <Note>Despesa geral da fazenda, sem rateio entre lotes.</Note>
          )}
          <Installments items={entry.payload.installments} />
        </>
      );
    case 'receita':
      return (
        <>
          <Card>
            <KV label="Categoria" value={entry.payload.category} />
            {entry.payload.counterparty ? <KV label="Cliente" value={entry.payload.counterparty} /> : null}
            {entry.payload.document ? <KV label="Documento" value={entry.payload.document} /> : null}
            <KV label="Valor" value={formatCents(entry.amountCents ?? 0)} strong />
          </Card>
          <Note>Receita fora da venda de animais: entra no resultado da operação, fora dos lotes.</Note>
          <Installments items={entry.payload.installments} title="Recebimento" />
        </>
      );
    case 'nota_fiscal': {
      const { payload } = entry;
      if (!payload.extraction) {
        return (
          <Note icon="cloud-upload-outline" title="Aguardando internet para leitura">
            {`"${payload.fileName}" está guardado no aparelho. A IA só lê depois do envio.`}
          </Note>
        );
      }
      const x = payload.extraction;
      return (
        <>
          <Card>
            <KV label="Fornecedor" value={x.supplier} />
            <KV label="CNPJ" value={x.supplierDoc} />
            <KV label="Número" value={`${x.number} · série ${x.series}`} />
            <KV label="Emissão" value={formatDate(x.issuedAt)} />
          </Card>
          <Section title="Itens">
            <Card>
              {x.items.map((item) => (
                <KV
                  key={item.description}
                  label={item.description}
                  hint={`${item.quantity} ${item.unit} × ${formatCents(item.unitPriceCents)}`}
                  value={formatCents(item.totalCents)}
                />
              ))}
              <Divider />
              <KV label="Total" value={formatCents(x.totalCents)} strong />
            </Card>
          </Section>
          {payload.destination === 'estoque' && payload.stockItems?.length ? <StockItems items={payload.stockItems} finance={finance} /> : null}
          {payload.destination === 'estoque' ? (
            <Note icon="warehouse" title="Entrada em estoque">
              Compra não é consumo: o custo vai para os lotes quando o insumo for usado.
            </Note>
          ) : (
            allocationSection
          )}
          <Installments items={payload.installments} />
        </>
      );
    }
    case 'consumo': {
      const { payload } = entry;
      const supply = app.supply(payload.supplyId);
      const unit = supply?.unit ?? '';
      const costs = entry.derivedAllocations ?? [];
      return (
        <>
          <Card>
            <KV label="Insumo" value={supply?.name ?? 'Insumo'} />
            <KV label="Quantidade" value={formatQty(payload.quantity, unit)} strong />
            {payload.periodStart ? <KV label="Período" value={`${formatDate(payload.periodStart)} a ${formatDate(entry.occurredAt)}`} /> : null}
            {finance && entry.derivedCents !== undefined ? <KV label="Custo pelo custo médio" value={formatCents(entry.derivedCents)} strong /> : null}
            {payload.notes ? <KV label="Observação" value={payload.notes} /> : null}
          </Card>
          <Section title={`Rateio · ${CRITERION_LABEL[payload.criterion].toLowerCase()}`}>
            <Card>
              {payload.targets.map((t) => (
                <KV
                  key={t.lotId}
                  label={lotName(t.lotId)}
                  hint={basisText(payload.criterion, t.basis, payload.periodStart !== null)}
                  value={finance ? `+ ${formatCents(costs.find((c) => c.lotId === t.lotId)?.cents ?? 0)}` : ''}
                />
              ))}
            </Card>
          </Section>
          {entry.status !== 'aprovado' ? (
            <Note icon="silo">O estoque baixa e o custo vai para os lotes quando o consumo for aprovado.</Note>
          ) : null}
        </>
      );
    }
    case 'ajuste_estoque': {
      const supply = app.supply(entry.payload.supplyId);
      return (
        <>
          <Card>
            <KV label="Insumo" value={supply?.name ?? 'Insumo'} />
            <KV label={entry.payload.delta < 0 ? 'Saída' : 'Entrada'} value={formatQty(Math.abs(entry.payload.delta), supply?.unit ?? '')} strong />
            <KV label="Motivo" value={entry.payload.reason} />
            {finance && entry.derivedCents !== undefined ? <KV label="Valor pelo custo médio" value={formatCents(Math.abs(entry.derivedCents))} /> : null}
          </Card>
          {entry.payload.delta < 0 && !LOSS_TO_LOTS ? <Note icon="information-outline">A perda sai do estoque e não vira custo dos lotes.</Note> : null}
        </>
      );
    }
    case 'transferencia_estoque': {
      const supply = app.supply(entry.payload.supplyId);
      return (
        <Card>
          <KV label="Insumo" value={supply?.name ?? 'Insumo'} />
          <KV label="Quantidade" value={formatQty(entry.payload.quantity, supply?.unit ?? '')} strong />
          <KV label="De" value={app.farm(entry.farmId)?.name ?? ''} />
          <KV label="Para" value={app.farm(entry.payload.toFarmId)?.name ?? ''} />
          {entry.payload.notes ? <KV label="Observação" value={entry.payload.notes} /> : null}
        </Card>
      );
    }
  }
}
