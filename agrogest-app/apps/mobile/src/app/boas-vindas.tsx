import { router } from 'expo-router';
import { useRef, useState, type ComponentType } from 'react';
import { StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import { useSharedValue } from 'react-native-reanimated';
import { Carousel, Pagination, type CarouselRef } from 'react-native-reanimated-carousel';
import { SafeAreaView } from 'react-native-safe-area-context';

import { LogoMark, Wordmark } from '@/components/brand';
import { Button, ButtonText } from '@/components/gluestack/button';
import { Heading } from '@/components/gluestack/heading';
import { Text } from '@/components/gluestack/text';
import { HerdScene, OfflineScene, ResultScene, TeamScene } from '@/components/onboarding/value-scenes';
import { useStatusBarStyle } from '@/components/ui/layout';
import { FadeIn, haptics, useMotion } from '@/components/ui/motion';
import { cloudEnabled } from '@/services/supabase';
import { space, usePalette } from '@/theme';

interface Slide {
  key: string;
  title: string;
  text: string;
  Scene: ComponentType<{ active: boolean }>;
}

/** A proposta de valor em quatro telas: o que o app resolve, mostrado com o próprio app. */
const SLIDES: Slide[] = [
  {
    key: 'rebanho',
    title: 'Seu rebanho na palma da mão',
    text: 'Lotes, pastos e o ganho de peso de cada lote, sem caderno nem planilha.',
    Scene: HerdScene,
  },
  {
    key: 'offline',
    title: 'Funciona no pasto, sem sinal',
    text: 'Registre sem internet. Quando o sinal voltar, tudo é enviado sozinho.',
    Scene: OfflineScene,
  },
  {
    key: 'resultado',
    title: 'Saiba quanto cada lote dá',
    text: 'Custos, despesas e o resultado de cada venda, sem fazer conta.',
    Scene: ResultScene,
  },
  {
    key: 'equipe',
    title: 'A equipe registra, você aprova',
    text: 'Quem está no campo lança, e o sócio confere antes de entrar nas contas.',
    Scene: TeamScene,
  },
];

/**
 * Primeira tela sem sessão: a marca, a proposta de valor em cenas que passam sozinhas (paradas
 * com "Reduzir animações") e as duas saídas sempre visíveis no rodapé.
 */
export default function BoasVindasScreen() {
  const p = usePalette();
  const motion = useMotion();
  // Depois de sair de uma tela com faixa escura, os ícones claros sumiriam no fundo claro.
  useStatusBarStyle(false);
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [index, setIndex] = useState(0);
  const progress = useSharedValue(0);
  const carousel = useRef<CarouselRef>(null);
  const onLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    setSize({ width: Math.round(width), height: Math.round(height) });
  };

  return (
    <SafeAreaView style={[styles.flex, { backgroundColor: p.background }]}>
      <View style={styles.wrap}>
        <FadeIn index={0} style={styles.brand}>
          <LogoMark width={36} />
          <Wordmark width={128} />
        </FadeIn>

        <View style={styles.flex} onLayout={onLayout}>
          {size.width > 0 ? (
            <Carousel
              ref={carousel}
              data={SLIDES}
              keyExtractor={(slide) => slide.key}
              style={{ width: size.width, height: size.height }}
              itemSize={size.width}
              progress={progress}
              loop
              autoplay={motion}
              autoplayInterval={6000}
              snapMode="page"
              animation={motion ? { type: 'spring', damping: 22, stiffness: 180, mass: 0.9 } : { type: 'timing', duration: 0 }}
              onSnapToItem={(next) => setIndex(next)}
              renderItem={({ item, index: i }) => (
                <View style={[styles.slide, { width: size.width }]}>
                  <View style={styles.scene}>
                    <item.Scene active={i === index} />
                  </View>
                  <View style={styles.copy}>
                    <Heading size="2xl" className="text-center tracking-tight">
                      {item.title}
                    </Heading>
                    <Text size="lg" className="max-w-80 text-center text-muted-foreground">
                      {item.text}
                    </Text>
                  </View>
                </View>
              )}
            />
          ) : null}
        </View>

        <Pagination
          count={SLIDES.length}
          progress={progress}
          onPress={(next) => {
            haptics.tap();
            carousel.current?.scrollTo({ index: next, animated: motion });
          }}
          getItemAccessibilityLabel={(i, count) => `${SLIDES[i].title}, ${i + 1} de ${count}`}
          containerStyle={styles.dots}
          dotStyle={{ width: 8, height: 8, borderRadius: 4, backgroundColor: p.fillStrong }}
          activeDotStyle={{ width: 24, height: 8, borderRadius: 4, backgroundColor: p.accent }}
        />

        <FadeIn index={1} style={styles.actions}>
          <Button size="lg" onPress={() => router.push('/cadastro')}>
            <ButtonText>Criar conta</ButtonText>
          </Button>
          <Button size="lg" variant="secondary" onPress={() => router.push('/entrar')}>
            <ButtonText>Já tenho conta</ButtonText>
          </Button>
          <Text size="sm" className="mt-1 text-center text-muted-foreground">
            {cloudEnabled ? 'Leva menos de um minuto para começar.' : 'Protótipo: a conta fica só neste aparelho.'}
          </Text>
        </FadeIn>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  wrap: {
    flex: 1,
    paddingTop: space.md,
    paddingBottom: space.lg,
    width: '100%',
    maxWidth: 480,
    alignSelf: 'center',
  },
  brand: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: space.sm },
  slide: { flex: 1, paddingHorizontal: space.xl, justifyContent: 'center', gap: space.xl },
  scene: { alignItems: 'center' },
  copy: { alignItems: 'center', gap: space.sm },
  dots: { gap: 6, alignSelf: 'center', marginBottom: space.lg },
  actions: { gap: space.sm, paddingHorizontal: space.xl },
});
