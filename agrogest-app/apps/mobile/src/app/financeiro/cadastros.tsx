import { router } from 'expo-router';

import { EmptyState, Group, ListRow, Screen, Section } from '@/components/ui/layout';
import { FadeIn } from '@/components/ui/motion';
import { plural } from '@/domain/format';
import { useApp } from '@/state/app-state';

/**
 * O que se configura uma vez e depois só se consulta: quem vende e compra, o plano de contas, os
 * sócios e as despesas que se repetem todo mês. Fica fora do dia a dia do hub financeiro.
 */
export default function CadastrosScreen() {
  const app = useApp();
  const operations = new Set(app.scopedFarms.filter((f) => app.canSeeFinance(f.operationId)).map((f) => f.operationId));
  if (operations.size === 0) {
    return (
      <Screen>
        <EmptyState icon="lock-outline" title="Financeiro dos sócios" message="Os cadastros financeiros aparecem só para os sócios da operação." />
      </Screen>
    );
  }
  const contacts = app.counterparties.filter((c) => operations.has(c.operationId)).length;
  const partners = new Set(
    [...operations].flatMap((op) => app.peopleIn(op).filter((m) => m.role === 'socio').map((m) => m.user.id)),
  ).size;
  const recurring = app.recurrences.filter((r) => operations.has(r.operationId)).length;

  return (
    <Screen>
      <FadeIn>
        <Section title="Pessoas e empresas">
          <Group>
            <ListRow
              icon="card-account-details-outline"
              title="Fornecedores e clientes"
              subtitle={contacts > 0 ? plural(contacts, 'contato', 'contatos') : 'Quem vende e quem compra da fazenda'}
              onPress={() => router.push('/financeiro/contatos')}
            />
            <ListRow
              icon="account-group-outline"
              title="Sócios"
              subtitle={`${plural(partners, 'sócio', 'sócios')} · aportes, retiradas e distribuição`}
              onPress={() => router.push('/financeiro/socios')}
            />
          </Group>
        </Section>
      </FadeIn>
      <FadeIn index={1}>
        <Section title="Organização">
          <Group>
            <ListRow
              icon="file-tree-outline"
              title="Plano de contas"
              subtitle="Categorias de receita e despesa"
              onPress={() => router.push('/financeiro/categorias')}
            />
            <ListRow icon="file-tree-outline" title="Centros de custo" subtitle="Finalidades e agrupamentos" onPress={() => router.push('/financeiro/centros')} />
            <ListRow
              icon="calendar-sync-outline"
              title="Despesas recorrentes"
              subtitle={recurring > 0 ? plural(recurring, 'despesa recorrente', 'despesas recorrentes') : 'Salário, energia, arrendamento'}
              onPress={() => router.push('/financeiro/recorrencias')}
            />
          </Group>
        </Section>
      </FadeIn>
    </Screen>
  );
}
