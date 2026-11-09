import { useState } from 'react';

import { Button, Note } from '@/components/ui/controls';
import { Screen, Section } from '@/components/ui/layout';
import { AppText } from '@/components/ui/text';
import { SyncBar } from '@/components/sync-bar';
import { useApp } from '@/state/app-state';
import { useSyncStatus } from '@/state/sync-status';

export default function SincronizacaoScreen() {
  const app = useApp();
  const sync = useSyncStatus();
  const [confirm, setConfirm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const discard = async () => {
    if (!confirm) { setConfirm(true); return; }
    setBusy(true); setError(null);
    try { await app.discardPendingChanges(); setConfirm(false); }
    catch (e) { setError(e instanceof Error ? e.message : 'Não foi possível descartar a fila.'); }
    finally { setBusy(false); }
  };
  return <Screen>
    <SyncBar />
    {sync.syncError ? <Note tone="warning" title="Confira o envio">{sync.syncError}</Note> : null}
    <AppText>Registros salvos sem sinal permanecem neste aparelho. O servidor confirma os dados e verifica as permissões quando a conexão volta.</AppText>
    {app.cloudMode && sync.pendingCommands > 0 ? <Section title="Resolver a fila">
      <Note>Se um vínculo mudou ou os dados precisam ser refeitos, você pode descartar as alterações pendentes deste aparelho e carregar os registros confirmados.</Note>
      {confirm ? <Note tone="danger">Isso descarta todos os registros ainda na fila deste aparelho. O que já foi confirmado no servidor será preservado. Esta ação exige conexão.</Note> : null}
      <Button title={confirm ? 'Confirmar descarte da fila' : 'Descartar alterações pendentes'} variant={confirm ? 'danger' : 'secondary'} disabled={busy || sync.syncing || !app.online} onPress={discard} />
      {confirm ? <Button title="Manter a fila" variant="ghost" onPress={() => setConfirm(false)} /> : null}
      {error ? <AppText tone="danger" accessibilityLiveRegion="polite">{error}</AppText> : null}
    </Section> : null}
  </Screen>;
}
