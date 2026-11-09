import { router } from 'expo-router';
import { useState } from 'react';
import { Linking, Pressable, StyleSheet, View } from 'react-native';

import { Button, Note } from '@/components/ui/controls';
import { Group, ListRow, Screen, Section } from '@/components/ui/layout';
import { FadeIn, haptics } from '@/components/ui/motion';
import { AppText, Icon } from '@/components/ui/text';
import { SUPPORT_WHATSAPP } from '@/services/support';
import { space, usePalette } from '@/theme';


/** Dúvidas comuns, com as respostas do jeito que o app funciona hoje. */
const FAQ: { q: string; a: string }[] = [
  {
    q: 'O app funciona sem internet?',
    a: 'Sim. O que você registra fica salvo no aparelho e é enviado sozinho quando o sinal voltar. Até lá, o registro aparece como "Salvo no aparelho" e ainda não entra nos números.',
  },
  {
    q: 'Por que meu lançamento está aguardando aprovação?',
    a: 'Quando a operação tem mais de um sócio, despesas e pagamentos precisam da aprovação de outro sócio. Ninguém aprova o próprio lançamento. Sozinho na operação, tudo entra direto.',
  },
  {
    q: 'Qual a diferença entre peso medido e estimado?',
    a: 'Medido é o peso da balança. Estimado é a avaliação no olho: aparece com ≈ nos cartões, gráficos e relatórios, para não se confundir com a balança.',
  },
  {
    q: 'O que é o aluguel de pastagem no resultado?',
    a: 'É um custo de oportunidade: quanto o pasto renderia se fosse alugado. Não sai do caixa. Entra só no resultado "descontando o aluguel de pastagem", ao lado do resultado das vendas.',
  },
  {
    q: 'Como escolho o que aparece no Início?',
    a: 'Em Mais › Preferências › "Como prefere usar o AgroGest". O modo muda só o que aparece primeiro; o que cada pessoa pode ver e os números continuam os mesmos.',
  },
  {
    q: 'Como escondo os valores dos cartões principais?',
    a: 'Toque no olho do cartão principal do Início ou do Financeiro. A escolha vale para os cartões principais dessas duas telas até você tocar de novo. Listas, indicadores e relatórios continuam mostrando os valores.',
  },
];

/**
 * Ajuda e suporte (Mais): falar com a gente pelo WhatsApp, as dúvidas comuns e rever o primeiro
 * acesso. No agro, o atendimento esperado é pelo WhatsApp, como o AegroZap do Aegro.
 */
export default function AjudaScreen() {
  const [open, setOpen] = useState<number | null>(null);
  const [linkFailed, setLinkFailed] = useState(false);

  const openWhatsApp = async () => {
    haptics.tap();
    setLinkFailed(false);
    try {
      await Linking.openURL(`https://wa.me/${SUPPORT_WHATSAPP}?text=${encodeURIComponent('Olá! Preciso de ajuda com o AgroGest.')}`);
    } catch {
      setLinkFailed(true);
    }
  };

  return (
    <Screen>
      {SUPPORT_WHATSAPP ? (
        <FadeIn index={0}>
          <Section title="Falar com a gente">
            <AppText tone="muted">Tire dúvidas e mande sugestões pelo WhatsApp.</AppText>
            <Button title="Conversar no WhatsApp" icon="whatsapp" size="lg" onPress={openWhatsApp} />
            {linkFailed ? (
              <Note tone="danger" icon="alert-circle-outline">
                {`Não foi possível abrir o WhatsApp. Chame no número +${SUPPORT_WHATSAPP}.`}
              </Note>
            ) : null}
          </Section>
        </FadeIn>
      ) : null}

      <FadeIn index={1}>
        <Section title="Dúvidas comuns">
          <Group>
            {FAQ.map((item, i) => (
              <Question key={item.q} q={item.q} a={item.a} open={open === i} onToggle={() => setOpen(open === i ? null : i)} />
            ))}
          </Group>
        </Section>
      </FadeIn>

      <FadeIn index={2}>
        <Section title="Começo do app">
          <Group>
            <ListRow
              icon="map-marker-path"
              title="Rever o primeiro acesso"
              subtitle="Escolha de novo o que aparece primeiro no Início"
              onPress={() => router.push('/comecar')}
            />
          </Group>
        </Section>
      </FadeIn>
    </Screen>
  );
}

function Question({ q, a, open, onToggle }: { q: string; a: string; open: boolean; onToggle: () => void }) {
  const p = usePalette();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ expanded: open }}
      onPress={() => {
        haptics.tap();
        onToggle();
      }}
      style={({ pressed }) => [styles.question, { opacity: pressed ? 0.7 : 1 }]}>
      <View style={styles.questionRow}>
        <AppText variant="bodyStrong" style={styles.flex}>
          {q}
        </AppText>
        <Icon name={open ? 'chevron-up' : 'chevron-down'} size={20} color={p.textMuted} />
      </View>
      {open ? <AppText tone="muted">{a}</AppText> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  question: { paddingHorizontal: space.lg, paddingVertical: space.md, gap: space.sm, minHeight: 56, justifyContent: 'center' },
  questionRow: { flexDirection: 'row', alignItems: 'center', gap: space.md },
});
