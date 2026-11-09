import { router } from 'expo-router';
import { useState, type ReactNode } from 'react';

import { Headline, MoveRow, PastureListItem } from '@/components/pasture-report';
import { FarmPicker } from '@/components/pickers';
import { Button, Note } from '@/components/ui/controls';
import { EmptyState, Group, Screen, Section } from '@/components/ui/layout';
import { FadeIn } from '@/components/ui/motion';
import { formatNumber, plural } from '@/domain/format';
import { NO_FILTER, pastureStatus } from '@/domain/pasture';
import { useApp } from '@/state/app-state';

/**
 * Aba Pastos do Rebanho. A pergunta é "onde estão os animais e qual pasto está livre": o total de
 * cabeças em destaque, depois os pastos com animais e os em descanso (o que está descansando há
 * mais tempo primeiro, candidato natural à próxima mudança).
 */
export function PasturesPanel({ header, initialFarmId }: { header: ReactNode; initialFarmId?: string }) {
  const app = useApp();
  // Com uma fazenda escolhida no topo, a aba segue ela; só na visão "Todas" a pessoa escolhe aqui.
  const [chosen, setChosen] = useState(initialFarmId ?? app.defaultFarmId);
  const farmId = app.contextFarm?.id ?? chosen;
  const farm = app.farm(farmId);

  if (!farm) {
    return (
      <Screen tab header={header}>
        <EmptyState icon="barn" illustration="farm" title="Crie uma fazenda primeiro" message="Os pastos ficam dentro de uma fazenda.">
          <Button title="Criar fazenda" icon="plus" onPress={() => router.push('/fazenda/nova')} />
        </EmptyState>
      </Screen>
    );
  }

  const manage = app.canManagePastures(farm.operationId);
  const { reports } = app.pastureReport([farm.id], NO_FILTER);
  const all = app.farmPastures(farm.id, true);
  const active = reports.filter((r) => r.pasture?.active);
  const occupied = active.filter((r) => r.currentHeads > 0).sort((a, b) => b.currentHeads - a.currentHeads);
  const resting = active
    .filter((r) => r.currentHeads === 0)
    .map((r) => ({ r, status: pastureStatus(r, app.today) }))
    .sort((a, b) => (b.status.kind === 'descanso' ? b.status.days : -1) - (a.status.kind === 'descanso' ? a.status.days : -1))
    .map(({ r }) => r);
  const inactive = reports.filter((r) => r.pasture && !r.pasture.active);
  // Lote sem referência estruturada aparece à parte, sem ser perdido.
  const unknown = reports.filter((r) => !r.pasture && r.currentHeads > 0);
  const area = all.filter((p) => p.active).reduce((acc, p) => acc + (p.areaHa ?? 0), 0);
  const heads = reports.reduce((acc, r) => acc + r.currentHeads, 0);
  const pending = app.visibleEntries
    .filter((e) => e.kind === 'manejo' && e.farmId === farm.id && (e.status === 'aguardando_aprovacao' || e.status === 'aguardando_envio' || e.status === 'conflito'))
    .slice(0, 5);
  const canMove = app.farmLotSummaries(farm.id).some((s) => s.headsCurrent > 0) && active.length > 1;

  return (
    <Screen
      tab
      header={header}
      footer={
        canMove || manage ? (
          <>
            {canMove ? <Button title="Mover animais" icon="swap-horizontal" onPress={() => router.push('/novo/manejo')} /> : null}
            {manage ? (
              <Button
                title="Novo pasto"
                variant={canMove ? 'secondary' : 'primary'}
                icon="plus"
                onPress={() => router.push({ pathname: '/pastos/editar', params: { fazenda: farm.id } })}
              />
            ) : null}
          </>
        ) : undefined
      }>
      {app.contextFarm ? null : <FarmPicker value={farmId} onChange={setChosen} />}

      {all.length === 0 ? (
        <EmptyState
          icon="grass"
          tone="accent"
          title="Nenhum pasto cadastrado"
          message={manage ? 'Cadastre os pastos com área e capim para acompanhar a ocupação e o ganho de peso em cada um.' : 'Peça a um sócio para cadastrar os pastos desta fazenda.'}
        />
      ) : (
        <>
          <FadeIn index={0}>
            <Headline
              label="Cabeças nos pastos hoje"
              value={formatNumber(heads)}
              caption={`${occupied.length} de ${plural(active.length, 'pasto ativo ocupado', 'pastos ativos ocupados')}`}
              stats={[
                { label: 'área de pasto', value: area > 0 ? `${formatNumber(area, 1)} ha` : '—' },
                { label: 'lotação média', value: area > 0 ? `${formatNumber(heads / area, 1)} cab./ha` : '—' },
              ]}
              action={{
                label: 'Relatório e ganho de peso (GMD)',
                icon: 'chart-bar',
                onPress: () => router.push({ pathname: '/pastos/relatorio', params: { fazenda: farm.id } }),
              }}
            />
          </FadeIn>

          {pending.length > 0 ? (
            <Section title="Precisa de atenção">
              <Note boxed tone="warning" icon="clock-outline" title={plural(pending.length, 'mudança aguardando', 'mudanças aguardando')}>
                Só entram na ocupação depois de aprovadas e enviadas.
              </Note>
              <Group>
                {pending.map((entry) => (
                  <MoveRow key={entry.id} entry={entry} />
                ))}
              </Group>
            </Section>
          ) : null}

          {occupied.length > 0 || unknown.length > 0 ? (
            <FadeIn index={1}>
              <Section title={`Com animais · ${occupied.length + unknown.length}`}>
                <Group>
                  {[...occupied, ...unknown].map((report) => (
                    <PastureListItem key={report.pastureId || 'unknown'} report={report} />
                  ))}
                </Group>
              </Section>
            </FadeIn>
          ) : null}

          {resting.length > 0 ? (
            <FadeIn index={2}>
              <Section title={`Vazios · ${resting.length}`}>
                <Group>
                  {resting.map((report) => (
                    <PastureListItem key={report.pastureId} report={report} />
                  ))}
                </Group>
              </Section>
            </FadeIn>
          ) : null}

          {inactive.length > 0 ? (
            <Section title={`Inativos · ${inactive.length}`}>
              <Group>
                {inactive.map((report) => (
                  <PastureListItem key={report.pastureId} report={report} />
                ))}
              </Group>
            </Section>
          ) : null}
        </>
      )}
    </Screen>
  );
}
