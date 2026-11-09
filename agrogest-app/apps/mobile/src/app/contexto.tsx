import { router, useFocusEffect } from 'expo-router';
import { useCallback, useRef, useState } from 'react';

import { Group, ListRow, Screen } from '@/components/ui/layout';
import { AppText } from '@/components/ui/text';
import { useApp } from '@/state/app-state';

export default function ContextoScreen() {
  const app = useApp();
  const active = useRef(false);
  const choosing = useRef(false);
  const [error, setError] = useState<string | null>(null);
  useFocusEffect(useCallback(() => {
    active.current = true;
    return () => { active.current = false; };
  }, []));
  const choose = async (farmId: string | null) => {
    if (!active.current || choosing.current) return;
    choosing.current = true;
    setError(null);
    try {
      await app.enterFarm(farmId);
      if (active.current) router.back();
    } catch {
      choosing.current = false;
      if (active.current) setError('Não foi possível trocar de fazenda. Tente novamente.');
    }
  };

  return (
    <Screen>
      {error ? <AppText tone="danger" accessibilityLiveRegion="polite">{error}</AppText> : null}
      <Group>
        {app.visibleFarms.map((farm) => (
          <ListRow
            key={farm.id}
            icon="barn"
            title={farm.name}
            subtitle={app.farmCaption(farm)}
            selected={app.contextFarm?.id === farm.id}
            onPress={() => choose(farm.id)}
          />
        ))}
        {app.visibleFarms.length > 1 ? (
          <ListRow
            icon="view-grid-outline"
            title="Visão geral"
            subtitle="Todas as fazendas juntas"
            selected={app.contextFarm === null}
            onPress={() => choose(null)}
          />
        ) : null}
      </Group>
      <Group>
        <ListRow icon="plus" iconTone="accent" title="Nova fazenda" onPress={() => router.replace('/fazenda/nova')} />
      </Group>
    </Screen>
  );
}
