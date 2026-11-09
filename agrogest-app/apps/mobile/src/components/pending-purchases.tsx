import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Badge } from '@/components/ui/controls';
import { Group, ListRow, Section } from '@/components/ui/layout';
import { haptics } from '@/components/ui/motion';
import { ChevronDown, ChevronUp, TriangleAlert } from '@/components/ui/lucide';
import { AppText } from '@/components/ui/text';
import { formatCents, plural } from '@/domain/format';
import type { Lot } from '@/domain/types';
import { useApp } from '@/state/app-state';
import { elevation, radius, soft, space, usePalette } from '@/theme';

const purchaseCents = (lot: Lot) => lot.purchaseCents + lot.commissionCents + lot.freightCents;

/**
 * Falta informação de pagamento; o valor da compra ainda não é uma dívida confirmada.
 * `compact`: uma faixa só, que abre a lista ao tocar (telas onde o aviso não é o assunto).
 */
export function PendingPurchases({ lots, compact }: { lots: Lot[]; compact?: boolean }) {
  const app = useApp();
  const p = usePalette();
  const [open, setOpen] = useState(false);
  if (lots.length === 0) return null;
  const rows = (
    <Group>
      {lots.map((lot) => (
        <ListRow
          key={lot.id}
          icon="cash-clock"
          title={`Origem ${lot.code}`}
          subtitle={`${app.farm(lot.farmId)?.name ?? 'Fazenda de origem'} · ${formatCents(purchaseCents(lot))}${lot.transfer?.outgoing ? ' · Animais transferidos' : ''}`}
          right={<Badge label="Informar" tone="warning" />}
          onPress={() => router.push({ pathname: '/lote/pagamento/[id]', params: { id: lot.id } })}
        />
      ))}
    </Group>
  );
  if (compact) {
    const total = lots.reduce((acc, lot) => acc + purchaseCents(lot), 0);
    return (
      <View style={styles.compact}>
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ expanded: open }}
          onPress={() => {
            haptics.tap();
            setOpen(!open);
          }}
          style={({ pressed }) => [styles.banner, { backgroundColor: p.surface, opacity: pressed ? 0.85 : 1 }, elevation(p)]}>
          {/* Só o ícone carrega o alerta; o texto segue neutro, para não competir com o resto da aba. */}
          <View style={[styles.bannerIcon, { backgroundColor: soft(p.warning) }]}>
            <TriangleAlert size={20} color={p.warning} strokeWidth={2.2} />
          </View>
          <View style={styles.bannerText}>
            <AppText variant="bodyStrong">
              {`${plural(lots.length, 'compra', 'compras')} sem pagamento informado`}
            </AppText>
            <AppText variant="caption" tone="muted" numeric>
              {`${formatCents(total)} fora das contas a pagar até você informar`}
            </AppText>
          </View>
          {open ? <ChevronUp size={22} color={p.warning} /> : <ChevronDown size={22} color={p.warning} />}
        </Pressable>
        {open ? rows : null}
      </View>
    );
  }
  return (
    <Section title={`Compras sem pagamento informado · ${lots.length}`}>
      <AppText variant="caption" tone="muted">
        Informe se já foram pagas. Sem isso, não entram nas contas a pagar.
      </AppText>
      {rows}
    </Section>
  );
}

const styles = StyleSheet.create({
  compact: { gap: space.sm },
  banner: { flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.md, borderRadius: radius.xl },
  bannerText: { flex: 1, gap: 1 },
  bannerIcon: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
});
