import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { LogoMark } from '@/components/brand';
import { Button, ButtonSpinner, ButtonText } from '@/components/gluestack/button';
import { Card } from '@/components/gluestack/card';
import { Heading } from '@/components/gluestack/heading';
import { HStack } from '@/components/gluestack/hstack';
import { Progress, ProgressFilledTrack } from '@/components/gluestack/progress';
import { Text } from '@/components/gluestack/text';
import { VStack } from '@/components/gluestack/vstack';
import { MODES } from '@/components/modes';
import { useNotifications } from '@/components/notifications';
import { Screen } from '@/components/ui/layout';
import { FadeIn, haptics, PressableScale } from '@/components/ui/motion';
import { Icon, IconTile } from '@/components/ui/text';
import type { Mode } from '@/domain/types';
import { useApp } from '@/state/app-state';
import { usePreferences } from '@/state/preferences';
import { space, usePalette } from '@/theme';

/**
 * Primeiro acesso (EXPERIENCIA_USUARIO.md, seção 8): pergunta o que a pessoa mais vai fazer,
 * sugere o modo do Início a partir disso e mostra os próximos passos. Duas telas, dá para pular,
 * e o modo muda depois em Mais › Preferências. Não pergunta nada que o app não use.
 */
export default function ComecarScreen() {
  const app = useApp();
  const prefs = usePreferences();
  const p = usePalette();
  const { invites } = useNotifications();
  const [step, setStep] = useState<0 | 1>(0);
  const [mode, setMode] = useState<Mode | null>(null);
  const [busy, setBusy] = useState(false);
  const firstName = app.user.name.trim().split(/\s+/)[0];
  const chosen = MODES.find((m) => m.value === mode);

  const finish = async (value: Mode) => {
    setBusy(true);
    try {
      await prefs.setMode(value);
      haptics.success();
      router.replace('/');
    } catch {
      setBusy(false);
    }
  };

  const next = invites.length > 0
    ? [
        { title: invites.length === 1 ? 'Responder ao convite' : `Responder aos ${invites.length} convites`, hint: 'Entre na fazenda de quem chamou você.' },
        { title: 'Registrar o dia a dia', hint: 'Pesagem, despesa ou mudança de pasto.' },
      ]
    : [
        { title: 'Criar a fazenda', hint: 'Só o nome é obrigatório.' },
        { title: 'Cadastrar o primeiro lote', hint: 'Categoria, cabeças, peso e pasto.' },
        { title: 'Registrar o dia a dia', hint: 'Pesagem, despesa ou mudança de pasto.' },
      ];

  const footer = step === 0 ? (
    <Button size="lg" className="flex-1" isDisabled={!mode} onPress={() => { haptics.tap(); setStep(1); }}>
      <ButtonText>Continuar</ButtonText>
    </Button>
  ) : (
    <>
      <Button size="lg" variant="secondary" isDisabled={busy} onPress={() => setStep(0)}>
        <ButtonText>Voltar</ButtonText>
      </Button>
      <Button size="lg" className="flex-1" isDisabled={busy || !mode} onPress={() => mode && finish(mode)}>
        {busy ? <ButtonSpinner color={p.onAccent} /> : null}
        <ButtonText>Começar</ButtonText>
      </Button>
    </>
  );

  return (
    <Screen footer={footer}>
      <FadeIn index={0} style={{ gap: space.md }}>
        <HStack className="items-center justify-between">
          <LogoMark width={32} />
          <Button variant="link" size="sm" isDisabled={busy} onPress={() => finish(prefs.mode)}>
            <ButtonText>Pular</ButtonText>
          </Button>
        </HStack>
        <Progress value={step === 0 ? 50 : 100} accessibilityLabel={`Passo ${step + 1} de 2`}>
          <ProgressFilledTrack />
        </Progress>
      </FadeIn>

      {step === 0 ? (
        <>
          <FadeIn index={1} style={{ gap: space.xs }}>
            <Heading size="2xl" className="tracking-tight" accessibilityRole="header">
              {firstName ? `${firstName}, o que você mais vai fazer no AgroGest?` : 'O que você mais vai fazer no AgroGest?'}
            </Heading>
            <Text className="text-muted-foreground">Assim o seu Início já abre com o que importa para você.</Text>
          </FadeIn>
          <FadeIn index={2} style={{ gap: space.sm }}>
            {MODES.map((option) => {
              const selected = option.value === mode;
              return (
                <PressableScale
                  key={option.value}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: selected }}
                  accessibilityLabel={`${option.task}. ${option.taskHint}`}
                  onPress={() => {
                    haptics.tap();
                    setMode(option.value);
                  }}
                  style={[
                    styles.option,
                    { backgroundColor: selected ? p.accentSoft : p.surface, borderColor: selected ? p.accent : p.border },
                  ]}>
                  <IconTile name={option.icon} size={44} tone={selected ? 'accent' : 'neutral'} />
                  <View style={styles.flex}>
                    <Text className="font-semibold">{option.task}</Text>
                    <Text size="sm" className="text-muted-foreground">{option.taskHint}</Text>
                  </View>
                  <Icon name={selected ? 'radiobox-marked' : 'radiobox-blank'} size={24} color={selected ? p.accent : p.textFaint} />
                </PressableScale>
              );
            })}
          </FadeIn>
          <FadeIn index={3}>
            <Text size="sm" className="text-center text-muted-foreground">
              Só muda o que aparece primeiro. O que você pode ver e os números são os mesmos.
            </Text>
          </FadeIn>
        </>
      ) : chosen ? (
        <>
          <FadeIn index={1} style={{ gap: space.xs }}>
            <Heading size="2xl" className="tracking-tight" accessibilityRole="header">
              Seu Início fica no modo {chosen.label}
            </Heading>
            <Text className="text-muted-foreground">Dá para trocar quando quiser em Mais › Preferências.</Text>
          </FadeIn>
          <FadeIn index={2}>
            <Card className="gap-3">
              <HStack className="items-center gap-3">
                <IconTile name={chosen.icon} size={44} tone="accent" />
                <Text className="flex-1 font-semibold">O que aparece primeiro</Text>
              </HStack>
              {chosen.preview.map((line) => (
                <HStack key={line} className="items-center gap-3">
                  <Icon name="check-circle" size={20} color={p.accent} />
                  <Text className="flex-1">{line}</Text>
                </HStack>
              ))}
            </Card>
          </FadeIn>
          <FadeIn index={3}>
            <VStack className="gap-3">
              <Text className="font-semibold">Seus próximos passos</Text>
              {next.map((item, i) => (
                <HStack key={item.title} className="items-center gap-3">
                  <View style={[styles.number, { backgroundColor: i === 0 ? p.accent : p.fill }]}>
                    <Text size="sm" className="font-bold" style={{ color: i === 0 ? p.onAccent : p.textMuted }}>
                      {i + 1}
                    </Text>
                  </View>
                  <VStack className="flex-1">
                    <Text className="font-semibold">{item.title}</Text>
                    <Text size="sm" className="text-muted-foreground">{item.hint}</Text>
                  </VStack>
                </HStack>
              ))}
            </VStack>
          </FadeIn>
        </>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, gap: 2 },
  option: {
    minHeight: 76,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    borderRadius: 16,
    borderWidth: 1.5,
    padding: space.md,
  },
  number: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
});
