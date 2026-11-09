import { router } from 'expo-router';

import { Text } from '@/components/gluestack/text';
import { useNotifications } from '@/components/notifications';
import { EntryRow } from '@/components/rows';
import { SyncBar } from '@/components/sync-bar';
import { Group, ListRow, Section } from '@/components/ui/layout';
import type { IconName } from '@/components/ui/text';
import type { Tone } from '@/theme';
import { useApp } from '@/state/app-state';

/**
 * Só o que pede ação agora, com os mesmos itens do sino (a soma das linhas é o número dele).
 * Sem nada pendente, o bloco não aparece.
 */
export function AttentionRows() {
  const app = useApp();
  const pending = useNotifications();
  const { unsent, intents } = app.counts;
  const rows: { key: string; title: string; count: number; tone: Tone; icon: IconName; filtro: 'voce' | 'convites' }[] = [
    { key: 'convites', title: 'Convites para responder', count: pending.invites.length, tone: 'accent', icon: 'email-outline', filtro: 'convites' },
    { key: 'aprovar', title: 'Para você aprovar', count: pending.toApprove.length, tone: 'accent', icon: 'checkbox-multiple-blank-outline', filtro: 'voce' },
    { key: 'conflitos', title: 'Conflitos para revisar', count: pending.conflicts.length, tone: 'conflict', icon: 'alert-outline', filtro: 'voce' },
    { key: 'compras', title: 'Compras sem pagamento informado', count: pending.purchases.length, tone: 'warning', icon: 'cash-clock', filtro: 'voce' },
    { key: 'recusados', title: 'Recusados para corrigir', count: pending.rejected.length, tone: 'danger', icon: 'close-circle-outline', filtro: 'voce' },
    { key: 'rascunhos', title: 'Rascunhos', count: pending.drafts.length, tone: 'neutral', icon: 'file-document-edit-outline', filtro: 'voce' },
  ];
  const visible = rows.filter((r) => r.count > 0);
  const queue = unsent + intents > 0 || !app.online;
  if (visible.length === 0 && !queue) return null;

  return (
    <Section title="Precisa de você">
      {visible.length > 0 ? (
        <Group>
          {visible.map((row) => (
            <ListRow
              key={row.key}
              icon={row.icon}
              iconTone={row.tone}
              title={row.title}
              right={
                <Text className="font-semibold tabular-nums">{row.count}</Text>
              }
              onPress={() => router.navigate({ pathname: '/atividade', params: { filtro: row.filtro } })}
            />
          ))}
        </Group>
      ) : null}
      {queue ? <SyncBar /> : null}
    </Section>
  );
}

/** Últimos lançamentos do contexto atual. */
export function RecentEntries({ limit = 3 }: { limit?: number }) {
  const app = useApp();
  const farmIds = new Set(app.scopedFarms.map((f) => f.id));
  const recent = app.visibleEntries.filter((e) => farmIds.has(e.farmId)).slice(0, limit);
  if (recent.length === 0) return null;
  return (
    <Section title="Recentes" action={{ label: 'Ver tudo', onPress: () => router.navigate({ pathname: '/atividade', params: { filtro: 'registros' } }) }}>
      <Group>
        {recent.map((entry) => (
          <EntryRow key={entry.id} entry={entry} />
        ))}
      </Group>
    </Section>
  );
}
