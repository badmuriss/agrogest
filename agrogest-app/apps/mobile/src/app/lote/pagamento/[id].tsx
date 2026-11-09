import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';

import { InstallmentRow } from '@/components/finance-ui';
import { goBack } from '@/components/navigation';
import { buildPurchase, initialDrafts, PurchasePaymentEditor, type PartDraft } from '@/components/purchase-payment';
import { Button, Note } from '@/components/ui/controls';
import { Card, EmptyState, Group, KV, Screen, Section } from '@/components/ui/layout';
import { haptics } from '@/components/ui/motion';
import { AppText } from '@/components/ui/text';
import { formatDate } from '@/domain/dates';
import { formatCents } from '@/domain/format';
import { useApp } from '@/state/app-state';

/**
 * Pagamento da compra do lote: logo depois do cadastro, ou quando o sócio informa um lote antigo.
 * As parcelas viram contas a pagar; o que já foi pago vira baixa na conta. Com alguma parcela
 * paga, o plano fica travado (estorne a baixa para mudar).
 */
export default function PagamentoCompraScreen() {
  const app = useApp();
  const params = useLocalSearchParams<{ id: string; novo?: string }>();
  const lot = app.lotSummary(params.id)?.lot;
  const firstAccount = lot ? (app.accounts.find((a) => a.operationId === lot.operationId && a.active)?.id ?? null) : null;
  const [drafts, setDrafts] = useState<PartDraft[]>(() => (lot ? initialDrafts(lot, firstAccount) : []));
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);

  if (!lot || !app.canSeeFinance(lot.operationId)) {
    return (
      <Screen>
        <EmptyState icon="lock-outline" title="Pagamento da compra" message="Só os sócios da operação informam como a compra foi paga." />
      </Screen>
    );
  }
  const total = lot.purchaseCents + lot.commissionCents + lot.freightCents;
  const goToLot = () => router.replace({ pathname: '/lote/[id]', params: { id: lot.id } });

  if (total <= 0 || lot.transfer?.incoming) {
    return (
      <Screen footer={<Button title="Ver o lote" size="lg" onPress={goToLot} />}>
        <EmptyState icon="cash-off" title="Nada a pagar" message={lot.transfer?.incoming ? 'O lote veio de uma transferência: não houve compra.' : 'O lote não tem valor de compra. Informe em Editar, se houver.'} />
      </Screen>
    );
  }

  const views = app.allInstallments.filter((v) => v.entryId === lot.id);
  if (lot.purchasePlan && app.lotPurchasePaid(lot.id)) {
    return (
      <Screen footer={<Button title="Abrir o financeiro" variant="secondary" icon="cash-multiple" onPress={() => router.push('/financeiro')} />}>
        <Card>
          <KV label="Compra" value={formatCents(total)} strong />
          <KV label="Pago" value={formatCents(views.reduce((acc, v) => acc + v.paidCents, 0))} />
          <KV label="Em aberto" value={formatCents(views.reduce((acc, v) => acc + v.openCents, 0))} />
        </Card>
        <Section title="Parcelas">
          <Group>
            {views.map((v) => (
              <InstallmentRow key={v.id} view={v} />
            ))}
          </Group>
        </Section>
        <Note icon="lock-outline">Já há pagamento registrado. Para mudar as parcelas, estorne as baixas da compra.</Note>
      </Screen>
    );
  }

  const result = buildPurchase(lot, drafts);
  const save = async () => {
    setFailure(null);
    if (result.error) {
      setFailure(result.error);
      return;
    }
    setBusy(true);
    try {
      await app.setLotPurchasePlan(lot.id, result.plan, result.paid);
      haptics.success();
      // Logo após o cadastro, segue para o lote; aberto do Início ou de uma lista, volta para lá.
      if (params.novo) goToLot();
      else goBack();
    } catch (e) {
      setFailure(e instanceof Error ? e.message : 'Não foi possível salvar o pagamento.');
      setBusy(false);
    }
  };

  return (
    <Screen
      footer={
        <>
          {params.novo ? <Button title="Depois" variant="secondary" disabled={busy} onPress={goToLot} /> : null}
          <Button title={busy ? 'Salvando…' : 'Salvar pagamento'} icon="check" size="lg" disabled={busy} onPress={save} style={{ flexGrow: 2 }} />
        </>
      }>
      {params.novo ? (
        <Note boxed tone="success" icon="check-circle-outline" title={`Origem ${lot.code} cadastrado`}>
          Agora diga como a compra foi ou será paga. As parcelas entram no financeiro como contas a pagar.
        </Note>
      ) : (
        <AppText tone="muted">{`Compra de ${formatDate(lot.purchasedAt)} · Origem ${lot.code} · ${formatCents(total)}`}</AppText>
      )}
      <PurchasePaymentEditor lot={lot} drafts={drafts} onChange={setDrafts} />
      <Note icon="information-outline">
        A compra de animais é investimento no rebanho: não entra nos custos do mês. Vira custo do resultado quando os animais forem vendidos.
      </Note>
      {failure ? (
        <Note boxed tone="danger" icon="alert-circle-outline" title="Não foi possível salvar">
          {failure}
        </Note>
      ) : null}
    </Screen>
  );
}
