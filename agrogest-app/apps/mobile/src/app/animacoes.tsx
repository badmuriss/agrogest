import { useRef, useState } from 'react';
import { Pressable, StyleSheet, View, type ScrollViewInstance } from 'react-native';

import { AppLottie, type AnimationName } from '@/components/animation';
import { Button } from '@/components/ui/controls';
import { Card, Screen, Section } from '@/components/ui/layout';
import { useMotion } from '@/components/ui/motion';
import { AppText } from '@/components/ui/text';
import { radius, space, usePalette } from '@/theme';

const SCENES: { name: AnimationName; label: string; description: string; loop?: boolean }[] = [
  { name: 'farm', label: 'Fazenda', description: 'O mapa com os pastos: o ponto de partida da sua operação.' },
  { name: 'herd', label: 'Rebanho', description: 'Os lotes da fazenda, com as cabeças de cada um.' },
  { name: 'sale', label: 'Venda', description: 'Venda, custos do lote e o resultado que sobra.' },
  { name: 'expense', label: 'Despesa', description: 'O valor da despesa e as parcelas, uma a uma.' },
  { name: 'weighing', label: 'Pesagem', description: 'O peso médio e o ganho ao longo do tempo.' },
  { name: 'invoice', label: 'Nota fiscal', description: 'A leitura do documento e os campos para você conferir.' },
  { name: 'team', label: 'Equipe', description: 'As pessoas da fazenda e o convite para quem chega.' },
  { name: 'loss', label: 'Mortalidade', description: 'Um registro cuidadoso que mantém o saldo do lote correto.' },
  { name: 'success', label: 'Concluído', description: 'Confirma um registro aprovado ou que já conta.' },
  { name: 'pending', label: 'Aguardando envio', description: 'Salvo no aparelho; repete até a internet voltar.', loop: true },
  { name: 'scan', label: 'Lendo a nota', description: 'Enquanto a leitura da nota acontece; repete até terminar.', loop: true },
];

/** Galeria do protótipo: só a cena selecionada anima; as miniaturas são os pôsteres estáticos. */
export default function AnimacoesScreen() {
  const p = usePalette();
  const motion = useMotion();
  const [selected, setSelected] = useState(SCENES[0]);
  const [replay, setReplay] = useState(0);
  const scroll = useRef<ScrollViewInstance>(null);

  return (
    <Screen scrollRef={scroll}>
      <Card style={styles.preview}>
        <AppLottie key={`${selected.name}:${replay}`} name={selected.name} size={200} loop={selected.loop} />
        <AppText variant="heading" accessibilityRole="header">{selected.label}</AppText>
        <AppText tone="muted" style={styles.center}>{selected.description}</AppText>
        <Button title="Reproduzir de novo" variant="secondary" icon="replay" disabled={!motion} onPress={() => setReplay((value) => value + 1)} />
        {!motion ? <AppText variant="caption" tone="muted" style={styles.center}>As animações estão reduzidas nas preferências ou no sistema.</AppText> : null}
      </Card>
      <Section title="Escolha uma cena">
        <View style={styles.grid}>
          {SCENES.map((scene) => (
            <Pressable
              key={scene.name}
              accessibilityRole="button"
              accessibilityLabel={scene.label}
              accessibilityState={{ selected: selected.name === scene.name }}
              onPress={() => {
                setSelected(scene);
                setReplay((value) => value + 1);
                scroll.current?.scrollTo({ y: 0, animated: motion });
              }}
              style={({ pressed }) => [styles.tile, {
                backgroundColor: selected.name === scene.name || pressed ? p.accentSoft : p.surface,
                borderColor: selected.name === scene.name ? p.accent : p.border,
              }]}>
              <AppLottie name={scene.name} size={104} animated={false} />
              <AppText variant="caption" style={styles.center}>{scene.label}</AppText>
            </Pressable>
          ))}
        </View>
      </Section>
    </Screen>
  );
}

const styles = StyleSheet.create({
  preview: { alignItems: 'center', gap: space.sm },
  center: { textAlign: 'center' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: space.sm },
  tile: { width: '48%', alignItems: 'center', padding: space.sm, borderWidth: 1, borderRadius: radius.lg, gap: space.xs },
});
