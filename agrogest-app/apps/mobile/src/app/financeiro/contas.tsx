import { router } from 'expo-router';

import { Button, Note } from '@/components/ui/controls';
import { Card, Divider, EmptyState, Group, KV, ListRow, Screen, Section } from '@/components/ui/layout';
import { AppText } from '@/components/ui/text';
import { ACCOUNT_KIND_LABEL, isCashAccount } from '@/domain/finance';
import { formatCents } from '@/domain/format';
import { useApp } from '@/state/app-state';

/**
 * Contas da operação com o saldo de hoje: saldo inicial + recebimentos − pagamentos ± movimentações.
 * O cartão de crédito aparece à parte: é dívida (fatura), não caixa.
 */
export default function ContasScreen() {
  const app = useApp();
  const operationIds = [...new Set(app.scopedFarms.map((f) => f.operationId))].filter((id) => app.canSeeFinance(id));
  if (operationIds.length === 0) {
    return (
      <Screen>
        <EmptyState icon="lock-outline" title="Financeiro dos sócios" message="As contas e os saldos aparecem só para os sócios." />
      </Screen>
    );
  }
  const newAccount = (operationId: string) => router.push({ pathname: '/financeiro/conta/editar', params: { operacao: operationId } });

  return (
    <Screen>
      {operationIds.map((operationId) => {
        const accounts = app.accounts.filter((a) => a.operationId === operationId);
        const active = accounts.filter((a) => a.active);
        const total = active.filter(isCashAccount).reduce((acc, a) => acc + app.accountBalance(a.id), 0);
        const cardDebt = active.filter((a) => !isCashAccount(a)).reduce((acc, a) => acc + Math.max(0, -app.accountBalance(a.id)), 0);
        return (
          <Section key={operationId} title={operationIds.length > 1 ? app.operation(operationId)?.name : undefined}>
            {accounts.length === 0 ? (
              <EmptyState icon="bank-outline" title="Nenhuma conta ainda" message="Cadastre o banco, a poupança ou o caixa em dinheiro, com o saldo de hoje. As baixas passam a mexer nesse saldo.">
                <Button title="Cadastrar conta" icon="plus" onPress={() => newAccount(operationId)} />
              </EmptyState>
            ) : (
              <>
                <Card>
                  <KV label="Saldo em caixa" value={formatCents(total)} strong hint="bancos, caixa e investimentos" />
                  {cardDebt > 0 ? (
                    <>
                      <Divider />
                      <KV label="Faturas de cartão em aberto" value={formatCents(cardDebt)} />
                    </>
                  ) : null}
                </Card>
                <Group>
                  {accounts.map((a) => (
                    <ListRow
                      key={a.id}
                      icon={a.kind === 'caixa' ? 'cash' : a.kind === 'cartao' ? 'credit-card-outline' : 'bank-outline'}
                      iconTone={a.active ? 'neutral' : 'neutral'}
                      title={a.name}
                      subtitle={`${ACCOUNT_KIND_LABEL[a.kind]}${a.bank ? ` · ${a.bank}` : ''}${a.active ? '' : ' · inativa'}`}
                      right={
                        <AppText variant="bodyStrong" numeric tone={isCashAccount(a) && app.accountBalance(a.id) < 0 ? 'danger' : 'default'}>
                          {isCashAccount(a) ? formatCents(app.accountBalance(a.id)) : `fatura ${formatCents(Math.max(0, -app.accountBalance(a.id)))}`}
                        </AppText>
                      }
                      onPress={() => router.push({ pathname: '/financeiro/conta/[id]', params: { id: a.id } })}
                    />
                  ))}
                  <ListRow icon="plus" iconTone="accent" title="Cadastrar conta" onPress={() => newAccount(operationId)} />
                </Group>
                <Group>
                  <ListRow icon="swap-horizontal" title="Movimentar" subtitle="Transferência, aporte, retirada, fatura do cartão" onPress={() => router.push({ pathname: '/financeiro/movimentar', params: { operacao: operationId } })} />
                  <ListRow icon="bank-check" title="Conciliar com o extrato" subtitle="OFX ou CSV do banco" onPress={() => router.push('/financeiro/conciliacao')} />
                </Group>
              </>
            )}
          </Section>
        );
      })}
      <Note icon="information-outline">Transferência, aporte e pagamento da fatura mudam os saldos, nunca o resultado.</Note>
    </Screen>
  );
}
