import { router } from 'expo-router';

import { Button } from '@/components/ui/controls';
import { EmptyState, Group, ListRow, Screen, Section } from '@/components/ui/layout';
import { COUNTERPARTY_KIND_LABEL } from '@/domain/finance';
import { useApp } from '@/state/app-state';

/** Fornecedores e clientes da operação: frigoríficos, revendas, transportadoras, diaristas. */
export default function ContatosScreen() {
  const app = useApp();
  const operationIds = new Set(app.scopedFarms.map((f) => f.operationId).filter((id) => app.canSeeFinance(id)));
  const contacts = app.counterparties.filter((c) => operationIds.has(c.operationId));
  const open = (id?: string) => router.push({ pathname: '/financeiro/contato', params: id ? { id } : {} });

  if (operationIds.size === 0) {
    return (
      <Screen>
        <EmptyState icon="lock-outline" title="Cadastro dos sócios" />
      </Screen>
    );
  }
  return (
    <Screen footer={<Button title="Novo contato" icon="plus" size="lg" onPress={() => open()} />}>
      {contacts.length === 0 ? (
        <EmptyState
          icon="card-account-details-outline"
          title="Nenhum contato ainda"
          message="Cadastre quem vende para a fazenda e quem compra os animais, com CNPJ e chave Pix. Ao registrar uma despesa ou venda, é só escolher."
        />
      ) : (
        <Section>
          <Group>
            {contacts.map((c) => (
              <ListRow
                key={c.id}
                icon={c.kind === 'cliente' ? 'account-cash-outline' : 'store-outline'}
                title={c.name}
                subtitle={[COUNTERPARTY_KIND_LABEL[c.kind], c.document || null, c.active ? null : 'inativo'].filter(Boolean).join(' · ')}
                onPress={() => open(c.id)}
              />
            ))}
          </Group>
        </Section>
      )}
    </Screen>
  );
}
