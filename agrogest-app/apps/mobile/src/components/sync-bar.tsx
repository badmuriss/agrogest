import { StyleSheet, View } from 'react-native';

import { formatDateTime } from '@/domain/dates';
import { plural } from '@/domain/format';
import { useApp } from '@/state/app-state';
import { useSyncStatus } from '@/state/sync-status';
import { radius, space, usePalette } from '@/theme';

import { PressableScale } from './ui/motion';
import { AppText, Icon } from './ui/text';

/** Situação da sincronização numa linha (Tela F, enxuta). */
export function SyncBar() {
  const app = useApp();
  const sync = useSyncStatus();
  const p = usePalette();
  const { unsent, intents, conflicts } = app.counts;
  const queued = app.cloudMode ? sync.pendingCommands : unsent + intents;
  const detail = [
    queued > 0 ? plural(queued, 'item na fila', 'itens na fila') : null,
    conflicts > 0 ? plural(conflicts, 'conflito', 'conflitos') : null,
  ]
    .filter(Boolean)
    .join(' · ');
  const last = sync.lastSyncAt ? `sincronizado ${formatDateTime(sync.lastSyncAt)}` : 'nunca sincronizado';

  return (
    <View style={[styles.bar, { backgroundColor: p.fill }]}>
      <Icon name={app.online ? 'cloud-check-outline' : 'cloud-off-outline'} size={22} color={app.online ? p.accent : p.textMuted} />
      <View style={styles.text}>
        <AppText variant="bodyStrong">{sync.syncing ? 'Sincronizando…' : app.online ? 'Online' : 'Sem internet'}</AppText>
        <AppText variant="caption" tone="muted" numberOfLines={1}>
          {(sync.syncError ?? detail) || last}
        </AppText>
      </View>
      <PressableScale
        accessibilityRole="button"
        disabled={sync.syncing}
        onPress={() => {
          if (app.online) app.sync();
          else app.setOnline(true);
        }}
        style={[styles.action, { backgroundColor: p.surface }]}>
        <AppText variant="label">{app.online ? 'Sincronizar' : 'Conectar'}</AppText>
      </PressableScale>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.md, borderRadius: radius.xl },
  text: { flex: 1 },
  action: { paddingHorizontal: space.md, paddingVertical: space.sm, borderRadius: radius.pill },
});
