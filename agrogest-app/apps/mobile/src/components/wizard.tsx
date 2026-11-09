import { router, type Href } from 'expo-router';
import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeInDown, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import type { Entry, EntryKind } from '@/domain/types';
import { isDirect } from '@/domain/workflow';
import { useApp } from '@/state/app-state';
import { space, usePalette } from '@/theme';

import { AppLottie } from './animation';
import { goBack } from './navigation';
import { statusMeta } from './status';
import { Button } from './ui/controls';
import { haptics, useMotion } from './ui/motion';
import { AppText, IconTile } from './ui/text';

export function StepHeader({ steps, current }: { steps: string[]; current: number }) {
  const p = usePalette();
  const motion = useMotion();
  const progress = useSharedValue((current + 1) / steps.length);
  useEffect(() => {
    const next = (current + 1) / steps.length;
    progress.set(motion ? withTiming(next, { duration: 320 }) : next);
  }, [current, steps.length, progress, motion]);
  const barStyle = useAnimatedStyle(() => ({ width: `${progress.get() * 100}%` }));

  return (
    <View style={styles.stepHeader}>
      <View style={[styles.track, { backgroundColor: p.fill }]}>
        <Animated.View style={[styles.bar, { backgroundColor: p.accent }, barStyle]} />
      </View>
      <AppText variant="caption" tone="faint">
        {current + 1} de {steps.length}
      </AppText>
      <AppText variant="title" accessibilityRole="header">
        {steps[current]}
      </AppText>
    </View>
  );
}

/** Operação e tipo do lançamento, para saber se alguém precisa aprovar. */
export interface EntryScope {
  operationId: string;
  kind: EntryKind;
}

/**
 * Rascunho e envio ficam separados; offline, "enviar" vira fila. Sem outra pessoa para
 * aprovar, o envio é "Registrar": entra direto.
 */
export function SubmitButtons({
  disabled,
  draftDisabled = disabled,
  busy,
  onSave,
  scope,
}: {
  disabled: boolean;
  /** Rascunho pode ter regras mais leves que o envio. */
  draftDisabled?: boolean;
  busy: boolean;
  onSave: (submit: boolean) => void;
  scope?: EntryScope;
}) {
  const app = useApp();
  const direct = scope ? !app.needsApproval({ authorId: app.user.id, ...scope }) : false;
  const title = direct ? 'Registrar' : app.online ? 'Enviar' : 'Enviar ao conectar';
  return (
    <>
      <Button title="Rascunho" variant="secondary" disabled={draftDisabled || busy} onPress={() => onSave(false)} />
      <Button
        title={title}
        icon={!app.online ? 'cloud-upload-outline' : direct ? 'check' : 'arrow-up'}
        disabled={disabled || busy}
        onPress={() => onSave(true)}
        style={styles.grow}
      />
    </>
  );
}

export function WizardNav({
  step,
  last,
  canNext,
  onStep,
  busy,
  onSave,
  scope,
}: {
  step: number;
  last: number;
  canNext: boolean;
  onStep: (step: number) => void;
  busy: boolean;
  onSave: (submit: boolean) => void;
  scope?: EntryScope;
}) {
  if (step === last) return <SubmitButtons disabled={!canNext} busy={busy} onSave={onSave} scope={scope} />;
  return (
    <>
      {step > 0 ? <Button title="Voltar" variant="secondary" onPress={() => onStep(step - 1)} /> : null}
      <Button title="Continuar" disabled={!canNext} onPress={() => onStep(step + 1)} style={styles.grow} />
    </>
  );
}

export function editHref(entry: Pick<Entry, 'id' | 'kind'>): Href {
  const params = { id: entry.id };
  const routes: Record<EntryKind, Href> = {
    pesagem: { pathname: '/novo/pesagem', params },
    despesa: { pathname: '/novo/despesa', params },
    mortalidade: { pathname: '/novo/mortalidade', params },
    venda: { pathname: '/novo/venda', params },
    nota_fiscal: { pathname: '/novo/nota-fiscal', params },
    manejo: { pathname: '/novo/manejo', params },
    consumo: { pathname: '/novo/consumo', params },
    ajuste_estoque: { pathname: '/novo/ajuste-estoque', params },
    transferencia_estoque: { pathname: '/novo/transferencia-estoque', params },
    receita: { pathname: '/novo/receita', params },
  };
  return routes[entry.kind];
}

const DONE_TITLE: Partial<Record<Entry['status'], string>> = {
  rascunho: 'Rascunho salvo',
  aguardando_envio: 'Salvo no aparelho',
  aguardando_aprovacao: 'Enviado',
  conflito: 'Precisa de revisão',
};

/** Confirmação depois de salvar: salvo ≠ enviado ≠ aprovado. */
export function DoneState({
  entry,
  againLabel,
  onAgain,
  message,
}: {
  entry: Entry;
  againLabel: string;
  onAgain: () => void;
  message?: string;
}) {
  const app = useApp();
  const motion = useMotion();
  const meta = statusMeta(entry);
  const direct = isDirect(entry);
  const approvers = app.approversFor(entry);
  const waiting = entry.status === 'aguardando_envio' || entry.status === 'aguardando_aprovacao';

  useEffect(() => {
    if (entry.status === 'conflito') haptics.warning();
    else haptics.success();
  }, [entry.status]);

  const enter = (delay: number) => (motion ? FadeInDown.duration(380).delay(delay) : undefined);

  return (
    <View style={styles.done}>
      {entry.status === 'conflito' ? (
        <IconTile name="alert-outline" tone="conflict" size={88} />
      ) : (
        <AppLottie
          name={entry.kind === 'mortalidade' && direct ? 'loss' : entry.status === 'aguardando_aprovacao' || direct ? 'success' : 'pending'}
          loop={entry.status === 'aguardando_envio'}
          size={148}
        />
      )}
      <Animated.View entering={enter(250)} style={styles.doneText}>
        <AppText variant="title" style={styles.center} accessibilityRole="header">
          {direct ? 'Registrado' : (DONE_TITLE[entry.status] ?? meta.label)}
        </AppText>
        <AppText tone="muted" style={styles.center}>
          {message ?? (entry.status === 'conflito' && entry.conflictReason ? entry.conflictReason : meta.help)}
        </AppText>
        {waiting ? (
          <AppText variant="caption" tone="muted" style={styles.center}>
            {approvers.length > 0
              ? `Pode aprovar: ${approvers.map((u) => u.name.split(' ')[0]).join(', ')}`
              : 'Ninguém mais na operação aprova: entra direto ao sincronizar.'}
          </AppText>
        ) : null}
      </Animated.View>
      <Animated.View entering={enter(380)} style={styles.actions}>
        <Button title="Concluir" onPress={goBack} />
        <View style={styles.row}>
          <Button
            title="Ver lançamento"
            variant="secondary"
            onPress={() => router.replace({ pathname: '/lancamento/[id]', params: { id: entry.id } })}
          />
          <Button title={againLabel} variant="secondary" onPress={onAgain} />
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  grow: { flexGrow: 2 },
  stepHeader: { gap: space.xs },
  track: { height: 3, borderRadius: 2, overflow: 'hidden', marginBottom: space.md },
  bar: { height: 3, borderRadius: 2 },
  done: { alignItems: 'center', gap: space.lg, paddingTop: space.xxl },
  doneText: { alignItems: 'center', gap: space.sm, paddingHorizontal: space.md },
  center: { textAlign: 'center' },
  actions: { alignSelf: 'stretch', gap: space.sm, marginTop: space.lg },
  row: { flexDirection: 'row', gap: space.sm },
});
