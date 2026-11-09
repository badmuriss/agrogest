import { useState } from 'react';
import { StyleSheet } from 'react-native';

import { FieldInput, FormField } from '@/components/fields';
import { Button, Chip, ChipWrap, Note } from '@/components/ui/controls';
import { Card, EmptyState, Group, ListRow, Screen, Section } from '@/components/ui/layout';
import { haptics } from '@/components/ui/motion';
import { AppText } from '@/components/ui/text';
import { NATURE_LABEL } from '@/domain/finance';
import type { CategoryNature } from '@/domain/types';
import { useApp } from '@/state/app-state';
import { space } from '@/theme';

const NATURES = Object.keys(NATURE_LABEL) as CategoryNature[];

/**
 * Plano de contas: categorias padrão (iguais em todas as operações) e as criadas pela operação.
 * A natureza separa custo de produção, investimento, compra para estoque e o que não é resultado.
 */
export default function CategoriasScreen() {
  const app = useApp();
  const operationId = app.scopedFarms.find((f) => app.canSeeFinance(f.operationId))?.operationId ?? null;
  const [name, setName] = useState('');
  const [nature, setNature] = useState<CategoryNature>('custo_producao');
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);

  if (!operationId) {
    return (
      <Screen>
        <EmptyState icon="lock-outline" title="Plano de contas dos sócios" />
      </Screen>
    );
  }
  const visible = app.categories.filter((c) => c.operationId === null || c.operationId === operationId);
  const byNature = NATURES.map((n) => ({ nature: n, items: visible.filter((c) => c.nature === n) })).filter((g) => g.items.length > 0);

  const create = async () => {
    setBusy(true);
    setFailure(null);
    try {
      await app.createCategory(operationId, name, nature);
      haptics.success();
      setName('');
    } catch (e) {
      setFailure(e instanceof Error ? e.message : 'Não foi possível criar a categoria.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen>
      {byNature.map((group) => (
        <Section key={group.nature} title={NATURE_LABEL[group.nature]}>
          <Group>
            {group.items.map((c) => (
              <ListRow key={c.id} icon={c.operationId ? 'tag-outline' : 'tag'} title={c.name} subtitle={c.operationId ? 'Criada nesta operação' : undefined} chevron={false} />
            ))}
          </Group>
        </Section>
      ))}
      <Section title="Nova categoria">
        <Card style={styles.card}>
          <FormField label="Nome">
            <FieldInput value={name} onChangeText={setName} placeholder="Ex.: Arrendamento de pasto" maxLength={80} autoCapitalize="sentences" />
          </FormField>
          <FormField label="Natureza">
            <ChipWrap>
              {NATURES.map((n) => (
                <Chip key={n} label={NATURE_LABEL[n]} selected={nature === n} onPress={() => setNature(n)} />
              ))}
            </ChipWrap>
          </FormField>
          <AppText variant="caption" tone="muted">
            Custo de produção entra no resultado dos lotes; investimento, compra para estoque e movimentações de sócio não.
          </AppText>
          {failure ? (
            <Note tone="danger" icon="alert-circle-outline">
              {failure}
            </Note>
          ) : null}
          <Button title={busy ? 'Salvando…' : 'Criar categoria'} icon="plus" disabled={busy || !name.trim()} onPress={create} />
        </Card>
      </Section>
    </Screen>
  );
}

const styles = StyleSheet.create({ card: { gap: space.md } });
