import { router, type Href } from 'expo-router';
import { Fragment } from 'react';

import { Badge, BadgeText } from '@/components/gluestack/badge';
import { Button, ButtonText } from '@/components/gluestack/button';
import { Card } from '@/components/gluestack/card';
import { Divider } from '@/components/gluestack/divider';
import { Heading } from '@/components/gluestack/heading';
import { HStack } from '@/components/gluestack/hstack';
import { Pressable } from '@/components/gluestack/pressable';
import { Progress, ProgressFilledTrack } from '@/components/gluestack/progress';
import { Text } from '@/components/gluestack/text';
import { VStack } from '@/components/gluestack/vstack';
import { InviteCard } from '@/components/invite-card';
import { useNotifications } from '@/components/notifications';
import { EmptyState, Section } from '@/components/ui/layout';
import { FadeIn, haptics } from '@/components/ui/motion';
import { AppText, Icon } from '@/components/ui/text';
import { plural } from '@/domain/format';
import { useApp } from '@/state/app-state';
import { usePalette } from '@/theme';

/**
 * Conta nova, sem fazenda: um único próximo passo, ou explorar um exemplo pronto. Com convite
 * recebido, o convite vem antes: quem foi chamado para uma fazenda quase sempre quer entrar nela.
 */
export function StartWithFarm() {
  const app = useApp();
  const p = usePalette();
  const { invites } = useNotifications();
  if (invites.length > 0) return <StartWithInvite />;
  return (
    <FadeIn index={1}>
      <EmptyState
        icon="barn"
        illustration="farm"
        tone="accent"
        title="Comece pela sua fazenda"
        message="Cadastre a fazenda e, depois, os lotes de animais. Leva menos de um minuto.">
        <Button size="lg" onPress={() => router.push('/fazenda/nova')}>
          <Icon name="plus" size={20} color={p.onAccent} />
          <ButtonText>Criar fazenda</ButtonText>
        </Button>
        {!app.cloudMode && !app.hasSampleData ? (
          <Button variant="ghost" onPress={() => app.loadSampleData()}>
            <ButtonText className="text-primary">Explorar com dados de exemplo</ButtonText>
          </Button>
        ) : null}
      </EmptyState>
    </FadeIn>
  );
}

/** Primeiro acesso com convite: o convite (com quem chamou e para onde) e, abaixo, a alternativa. */
function StartWithInvite() {
  const { invites } = useNotifications();
  return (
    <>
      <FadeIn index={1}>
        <Section title={invites.length === 1 ? 'Você foi convidado para uma fazenda' : `Você tem ${invites.length} convites`}>
          <AppText tone="muted">Aceite para ver os lotes e registrar junto com a equipe. Quem convidou confirma a sua entrada.</AppText>
          {invites.map((invite) => <InviteCard key={invite.id} invite={invite} />)}
        </Section>
      </FadeIn>
      <FadeIn index={2}>
        <Card className="gap-3">
          <VStack className="gap-1">
            <Text className="font-semibold">Tem uma fazenda própria?</Text>
            <Text size="sm" className="text-muted-foreground">
              Você pode criar a sua agora ou depois de responder ao convite.
            </Text>
          </VStack>
          <Button variant="secondary" onPress={() => router.push('/fazenda/nova')}>
            <ButtonText>Criar minha fazenda</ButtonText>
          </Button>
        </Card>
      </FadeIn>
    </>
  );
}

interface Step {
  title: string;
  /** O que fazer, em uma linha. */
  hint: string;
  done: boolean;
  href: Href;
  optional?: boolean;
  /** Sem permissão para este passo: some o toque e a linha explica quem faz. */
  blocked?: boolean;
}

export function useFirstSteps() {
  const app = useApp();
  const hasLots = app.visibleFarms.some((f) => app.farmLotSummaries(f.id).length > 0);
  const hasTeam =
    app.invites.length > 0 || app.visibleFarms.some((f) => app.peopleIn(f.operationId).length > 1);
  // Na nuvem, lote e convite são de sócio (lote/novo e pessoas/nova pedem o financeiro).
  const isPartner = !app.cloudMode || app.visibleFarms.some((f) => app.canSeeFinance(f.operationId));
  const steps: Step[] = [
    { title: 'Criar a fazenda', hint: 'Feito', done: app.visibleFarms.length > 0, href: '/fazenda/nova' },
    {
      title: 'Cadastrar o primeiro lote',
      hint: isPartner ? 'Categoria, cabeças, peso médio e pasto. Custo e documentos podem ficar para depois.' : 'Um sócio da operação cadastra os lotes.',
      done: hasLots,
      href: '/lote/novo',
      blocked: !isPartner,
    },
    {
      title: 'Convidar sócio ou funcionário',
      hint: isPartner ? 'Só com você, tudo entra direto.' : 'Um sócio da operação convida as pessoas.',
      done: hasTeam,
      href: '/pessoas/nova',
      optional: true,
      blocked: !isPartner,
    },
  ];
  return { steps, hasLots, visible: !hasLots };
}

/** Primeiros passos com barra de progresso: some sozinho quando o essencial estiver feito. */
export function FirstSteps() {
  const p = usePalette();
  const { steps } = useFirstSteps();
  const required = steps.filter((s) => !s.optional);
  const doneCount = required.filter((s) => s.done).length;
  const next = steps.find((s) => !s.done && !s.optional && !s.blocked);

  return (
    <FadeIn index={1}>
      <Card className="gap-0 overflow-hidden p-0">
        <VStack className="gap-3 p-4">
          <HStack className="items-center justify-between gap-2">
            <Heading size="sm">Primeiros passos</Heading>
            <Badge variant="soft">
              <BadgeText>{`${doneCount} de ${required.length}`}</BadgeText>
            </Badge>
          </HStack>
          <Progress
            value={(doneCount / required.length) * 100}
            accessibilityLabel={`${doneCount} de ${required.length} passos obrigatórios feitos`}>
            <ProgressFilledTrack />
          </Progress>
        </VStack>
        {steps.map((step) => {
          const isNext = step === next;
          const inert = step.done || step.blocked;
          return (
            <Fragment key={step.title}>
              <Divider />
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`${step.title}${step.optional ? ', opcional' : ''}${step.done ? ', feito.' : `. ${step.hint}`}`}
                accessibilityState={{ disabled: inert, checked: step.done }}
                disabled={inert}
                onPress={() => {
                  haptics.tap();
                  router.push(step.href);
                }}
                className="min-h-16 flex-row items-center gap-3 px-4 py-3 data-[active=true]:bg-secondary data-[disabled=true]:opacity-100">
                <Icon
                  name={step.done ? 'check-circle' : isNext ? 'arrow-right-circle' : step.blocked ? 'lock-outline' : 'circle-outline'}
                  size={26}
                  color={step.done ? p.accent : isNext ? p.text : p.textFaint}
                />
                <VStack className="flex-1 gap-px">
                  <HStack className="flex-wrap items-center gap-2">
                    <Text
                      strikeThrough={step.done}
                      className={step.done ? 'font-semibold text-muted-foreground' : 'font-semibold'}>
                      {step.title}
                    </Text>
                    {step.optional && !step.done ? (
                      <Badge variant="outline">
                        <BadgeText>Opcional</BadgeText>
                      </Badge>
                    ) : null}
                  </HStack>
                  <Text size="sm" className="text-muted-foreground">
                    {step.hint}
                  </Text>
                </VStack>
                {!inert ? <Icon name="chevron-right" size={20} color={p.textFaint} /> : null}
              </Pressable>
            </Fragment>
          );
        })}
        {next ? (
          <VStack className="p-4 pt-1">
            <Button size="lg" onPress={() => router.push(next.href)}>
              <ButtonText>{next.title}</ButtonText>
            </Button>
          </VStack>
        ) : null}
      </Card>
    </FadeIn>
  );
}

/**
 * Logo depois do primeiro lote, enquanto nada foi registrado: o que já existe (lote, cabeças,
 * pasto) e só as próximas ações que a pessoa pode fazer. Some no primeiro lançamento.
 */
export function useFirstLot() {
  const app = useApp();
  const farmIds = new Set(app.scopedFarms.map((f) => f.id));
  const summaries = app.lotSummaries.filter((s) => farmIds.has(s.lot.farmId));
  const hasEntries = app.visibleEntries.some((e) => farmIds.has(e.farmId));
  return summaries.length === 1 && !hasEntries ? summaries[0] : null;
}

export function FirstLotNext() {
  const app = useApp();
  const p = usePalette();
  const first = useFirstLot();
  if (!first) return null;

  const { lot, headsCurrent } = first;
  const pasture = lot.pastureId ? app.pasture(lot.pastureId)?.name : lot.managementGroup;
  const payment = app.pendingPurchases.find((l) => l.id === lot.id);
  const alone = app.peopleIn(lot.operationId).length <= 1 && !app.invites.some((i) => i.operationId === lot.operationId);
  const canInvite = !app.cloudMode || app.canSeeFinance(lot.operationId);

  return (
    <FadeIn index={1}>
      <Card className="gap-4">
        <HStack className="items-center gap-3">
          <Icon name="check-circle" size={26} color={p.accent} />
          <VStack className="flex-1 gap-px">
            <Text className="font-semibold" accessibilityRole="header">
              Primeiro lote cadastrado
            </Text>
            <Text size="sm" className="text-muted-foreground">
              {[`Origem ${lot.code}`, plural(headsCurrent, 'cabeça', 'cabeças'), pasture].filter(Boolean).join(' · ')}
            </Text>
          </VStack>
        </HStack>
        <Text size="sm" className="text-muted-foreground">
          {payment
            ? 'Falta dizer como a compra foi paga. Depois, registre o dia a dia: pesagem, despesa ou mudança de pasto, quando acontecer.'
            : 'Agora é o dia a dia: registre pesagem, despesa ou mudança de pasto quando acontecer.'}
        </Text>
        <VStack className="gap-2">
          {payment ? (
            <Button onPress={() => router.push({ pathname: '/lote/pagamento/[id]', params: { id: lot.id } })}>
              <ButtonText>Informar pagamento da compra</ButtonText>
            </Button>
          ) : null}
          <Button variant={payment ? 'secondary' : 'default'} onPress={() => router.push({ pathname: '/lote/[id]', params: { id: lot.id } })}>
            <ButtonText>Ver o lote</ButtonText>
          </Button>
          {alone && canInvite ? (
            <Button variant="ghost" onPress={() => router.push('/pessoas/nova')}>
              <ButtonText className="text-primary">Convidar sócio ou funcionário (opcional)</ButtonText>
            </Button>
          ) : null}
        </VStack>
      </Card>
    </FadeIn>
  );
}
