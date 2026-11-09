import { router } from 'expo-router';
import { useState } from 'react';
import { Modal } from 'react-native';

import { BrandPreview } from '@/components/brand';
import { AnimatedSplash } from '@/components/splash';
import { Button, Segmented, SwitchRow } from '@/components/ui/controls';
import { Card, Group, ListRow, Screen, Section } from '@/components/ui/layout';
import { AppText } from '@/components/ui/text';
import { useApp } from '@/state/app-state';
import { useSyncStatus } from '@/state/sync-status';
import { useBrandPreference, type BrandVersion } from '@/state/brand-preference';

const BRANDS: { value: BrandVersion; label: string }[] = [
  { value: 'v1', label: 'V1' },
  { value: 'v2', label: 'V2' },
];

/** O que só existe para testar o protótipo fica aqui, fora do caminho de quem usa o app. */
export default function PrototipoScreen() {
  const app = useApp();
  const sync = useSyncStatus();
  const brand = useBrandPreference();
  const [previewSplash, setPreviewSplash] = useState(false);
  const [confirmWipe, setConfirmWipe] = useState(false);
  const account = app.account;

  // Quem divide alguma operação com a conta logada (inclui ela mesma).
  const accountOps = new Set(account ? app.membershipsOf(account.id).map((m) => m.operation.id) : []);
  const people = app.users.filter(
    (u) => u.id === account?.id || app.membershipsOf(u.id).some((m) => accountOps.has(m.operation.id)),
  );
  const describe = (userId: string) =>
    app
      .membershipsOf(userId)
      .filter((m) => accountOps.has(m.operation.id))
      .map((m) => `${m.role === 'socio' ? 'Sócio' : 'Funcionário'} · ${m.operation.name}`)
      .join('\n');

  return (
    <Screen>
      {!app.cloudMode ? <Section title="Conexão simulada">
        <Card>
          <SwitchRow
            label="Internet"
            description="Desligue para testar o uso sem sinal: tudo fica salvo no aparelho e sincroniza depois."
            value={app.online}
            onValueChange={(value) => app.setOnline(value)}
          />
        </Card>
      </Section> : null}

      {!app.cloudMode ? <Section title="Ver como outra pessoa">
        {people.length > 1 ? (
          <>
            <Group>
              {people.map((u) => (
                <ListRow
                  key={u.id}
                  title={u.id === account?.id ? `${u.name} (você)` : u.name}
                  subtitle={describe(u.id) || undefined}
                  selected={u.id === app.user.id}
                  onPress={() => app.switchUser(u.id)}
                />
              ))}
            </Group>
            <AppText variant="caption" tone="muted">
              Quem cria não aprova. Despesas só com outro sócio da operação.
            </AppText>
          </>
        ) : (
          <AppText tone="muted">
            Só você por enquanto. Carregue os dados de exemplo ou simule o aceite de um convite em Pessoas para testar
            aprovações.
          </AppText>
        )}
      </Section> : null}

      <Section title="Marca do aplicativo">
        <Segmented accessibilityLabel="Versão da marca" options={BRANDS} value={brand.version} onChange={brand.setVersion} />
        <Card>
          <BrandPreview />
        </Card>
        <Button title="Ver tela de abertura" variant="secondary" onPress={() => setPreviewSplash(true)} />
      </Section>

      <Section title="Ilustrações do aplicativo">
        <Group>
          <ListRow icon="motion-play-outline" title="Ver animações" subtitle="Fazenda, rebanho e cada atividade do dia a dia" onPress={() => router.push('/animacoes')} />
        </Group>
      </Section>

      <Section title="Recomeçar">
        <Button
          disabled={app.cloudMode && sync.pendingCommands > 0}
          title={confirmWipe ? 'Toque de novo para apagar tudo' : 'Apagar tudo deste aparelho'}
          variant={confirmWipe ? 'danger' : 'secondary'}
          icon="delete-outline"
          onPress={async () => {
            if (!confirmWipe) {
              setConfirmWipe(true);
              return;
            }
            await app.wipeDevice();
          }}
        />
        <AppText variant="caption" tone="muted">
          {app.cloudMode ? 'Limpa os dados locais e sai da conta. Os registros já sincronizados continuam na nuvem. Sincronize a fila antes de limpar.' : 'Remove a conta, as fazendas e os registros. Volta para a tela de boas-vindas.'}
        </AppText>
      </Section>

      <Modal visible={previewSplash} transparent animationType="none" onRequestClose={() => setPreviewSplash(false)}>
        {previewSplash ? <AnimatedSplash ready onDone={() => setPreviewSplash(false)} /> : null}
      </Modal>
    </Screen>
  );
}
