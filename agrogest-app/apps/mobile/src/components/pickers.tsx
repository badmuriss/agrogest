import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { formatNumber } from '@/domain/format';
import { useApp } from '@/state/app-state';
import { usePalette } from '@/theme';

import { CategoryIcon } from './cattle-icon';
import { pastureLabel } from './rows';
import { Button } from './ui/controls';
import { EmptyState, Group, ListRow, Section } from './ui/layout';

/**
 * Fazenda com a operação responsável sempre visível. Com uma fazenda só, vira uma linha
 * informativa (sem escolha a fazer). Depois da escolha, recolhe e mostra só a escolhida.
 */
export function FarmPicker({ value, onChange }: { value: string | null; onChange: (farmId: string) => void }) {
  const app = useApp();
  const [open, setOpen] = useState(!value);
  if (app.visibleFarms.length === 1) {
    const farm = app.visibleFarms[0];
    return (
      <Group>
        <ListRow icon="barn" title={farm.name} subtitle={app.farmCaption(farm)} />
      </Group>
    );
  }
  const chosen = app.visibleFarms.find((farm) => farm.id === value);
  const shown = open || !chosen ? app.visibleFarms : [chosen];
  return (
    <Section title="Fazenda" action={!open && chosen ? { label: 'Trocar', onPress: () => setOpen(true) } : undefined}>
      <Group>
        {shown.map((farm) => (
          <ListRow
            key={farm.id}
            icon="barn"
            title={farm.name}
            subtitle={app.farmCaption(farm)}
            selected={open ? farm.id === value : undefined}
            onPress={
              open
                ? () => {
                    onChange(farm.id);
                    setOpen(false);
                  }
                : () => setOpen(true)
            }
            chevron={false}
          />
        ))}
      </Group>
    </Section>
  );
}

/** Lotes com animais da fazenda; recolhe no escolhido para os campos do formulário subirem. */
export function LotPicker({
  farmId,
  value,
  onChange,
}: {
  farmId: string;
  value: string | null;
  onChange: (lotId: string) => void;
}) {
  const app = useApp();
  const p = usePalette();
  const lots = app.farmLotSummaries(farmId).filter((s) => s.headsCurrent > 0);
  // Com um lote só, não há o que escolher (como a fazenda única): já vem marcado e recolhido.
  const onlyLot = lots.length === 1 ? lots[0].lot.id : null;
  const [open, setOpen] = useState(!value && !onlyLot);
  useEffect(() => {
    if (onlyLot && !value) onChange(onlyLot);
  }, [onlyLot, value, onChange]);
  if (lots.length === 0) {
    return (
      <EmptyState icon="cow" title="Nenhum lote com animais" message="Cadastre o lote antes de registrar no rebanho.">
        <Button
          title="Cadastrar lote"
          icon="plus"
          onPress={() => router.push({ pathname: '/lote/novo', params: farmId ? { fazenda: farmId } : {} })}
        />
      </EmptyState>
    );
  }
  const chosen = lots.find((s) => s.lot.id === value);
  const expanded = open || !chosen;
  const shown = expanded ? lots : [chosen];
  return (
    <Section title="Lote" action={!expanded ? { label: 'Trocar', onPress: () => setOpen(true) } : undefined}>
      <Group>
        {shown.map((s) => {
          const w = s.lastWeighing;
          return (
            <ListRow
              key={s.lot.id}
              leading={
                <View style={[styles.icon, { backgroundColor: p.fill }]}>
                  <CategoryIcon category={s.lot.category} size={28} />
                </View>
              }
              title={`Origem ${s.lot.code}`}
              subtitle={`${s.headsCurrent} cab. · ${pastureLabel(app, s)} · ${w.method === 'estimado' ? '≈' : ''}${formatNumber(w.kg)} kg`}
              selected={expanded ? s.lot.id === value : undefined}
              chevron={false}
              onPress={
                expanded
                  ? () => {
                      onChange(s.lot.id);
                      setOpen(false);
                    }
                  : () => setOpen(true)
              }
            />
          );
        })}
      </Group>
    </Section>
  );
}

/**
 * Grupo do lote por pasto. Com o lote num pasto só, o grupo é ele e nada é perguntado; dividido,
 * a pessoa escolhe de qual pasto é o registro (pesagem, morte ou venda), para não atribuir
 * a um pasto o que aconteceu em outro.
 */
export function useLotGroup(lotId: string | null, chosen: string | null) {
  const app = useApp();
  const groups = lotId ? app.lotGroups(lotId) : [];
  const pastureId = groups.length === 1 ? groups[0].pastureId : groups.some((g) => g.pastureId === chosen) ? chosen : null;
  return { groups, pastureId, heads: groups.find((g) => g.pastureId === pastureId)?.heads ?? null, split: groups.length > 1 };
}

export function LotGroupPicker({
  lotId,
  value,
  onChange,
  title = 'De qual pasto?',
}: {
  lotId: string;
  value: string | null;
  onChange: (pastureId: string) => void;
  title?: string;
}) {
  const app = useApp();
  const groups = app.lotGroups(lotId);
  if (groups.length <= 1) return null;
  return (
    <Section title={title}>
      <Group>
        {groups.map((g) => (
          <ListRow
            key={g.pastureId}
            icon="grass"
            iconTone={value === g.pastureId ? 'accent' : 'neutral'}
            title={app.pastureName(g.pastureId)}
            subtitle={`${g.heads} cab. deste lote neste pasto`}
            selected={value === g.pastureId}
            onPress={() => onChange(g.pastureId)}
          />
        ))}
      </Group>
    </Section>
  );
}

const styles = StyleSheet.create({
  icon: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'flex-end', paddingBottom: 2 },
});
