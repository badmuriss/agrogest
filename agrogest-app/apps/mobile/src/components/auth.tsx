import type { ReactNode } from 'react';

import { Button, ButtonText } from '@/components/gluestack/button';
import { Heading } from '@/components/gluestack/heading';
import { HStack } from '@/components/gluestack/hstack';
import { Text } from '@/components/gluestack/text';

import { Screen } from './ui/layout';
import { FadeIn, haptics } from './ui/motion';

/** Estrutura comum de Entrar e Criar conta: título, campos e a troca entre as duas no rodapé. */
export function AuthLayout({
  title,
  subtitle,
  children,
  switchPrompt,
  switchLabel,
  onSwitch,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  switchPrompt: string;
  switchLabel: string;
  onSwitch: () => void;
}) {
  return (
    <Screen centered>
      <FadeIn index={0} style={{ gap: 4 }}>
        <Heading size="2xl" className="tracking-tight">
          {title}
        </Heading>
        {subtitle ? <Text className="text-muted-foreground">{subtitle}</Text> : null}
      </FadeIn>
      <FadeIn index={1} style={{ gap: 16 }}>
        {children}
      </FadeIn>
      <HStack className="flex-wrap items-center justify-center gap-1">
        <Text className="text-muted-foreground">{switchPrompt}</Text>
        <Button
          variant="link"
          size="sm"
          className="px-1"
          onPress={() => {
            haptics.tap();
            onSwitch();
          }}>
          <ButtonText>{switchLabel}</ButtonText>
        </Button>
      </HStack>
    </Screen>
  );
}
