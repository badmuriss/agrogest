import { useEffect, useState, type ReactNode } from 'react';
import { StyleSheet, View, type DimensionValue, type StyleProp, type ViewStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Skeleton } from '@/components/gluestack/skeleton';
import { radius, space, usePalette } from '@/theme';

import { useMotion } from './motion';

/**
 * Bloco de esqueleto (Gluestack, pulso só de opacidade). Com "Reduzir animações", fica parado.
 * Decorativo: quem lê a tela ouve o conteúdo quando ele chega, não os blocos.
 */
export function Bone({ width = '100%', height = 14, round = radius.sm, style }: {
  width?: DimensionValue;
  height?: number;
  round?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const p = usePalette();
  const motion = useMotion();
  // Objeto único: na web o Skeleton do Gluestack é uma <div>, que não aceita lista de estilos.
  const box = StyleSheet.flatten([{ width, height, borderRadius: round }, style]);
  return motion
    ? <Skeleton startColor="bg-fill-strong" speed={2} style={box} />
    : <View style={[{ backgroundColor: p.fillStrong }, box]} />;
}

/** Linhas de texto em esqueleto, a última mais curta. */
export function BoneLines({ lines = 2, style }: { lines?: number; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[styles.lines, style]}>
      {Array.from({ length: lines }, (_, i) => (
        <Bone key={i} width={i === lines - 1 ? '58%' : '100%'} height={i === 0 ? 14 : 11} />
      ))}
    </View>
  );
}

/** Lista em cartão: ícone, duas linhas e o valor à direita, como as linhas reais. */
function RowsCard({ rows }: { rows: number }) {
  const p = usePalette();
  return (
    <View style={[styles.card, { backgroundColor: p.surface, borderColor: p.border }]}>
      {Array.from({ length: rows }, (_, i) => (
        <View key={i} style={[styles.row, i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: p.border }]}>
          <Bone width={40} height={40} round={12} />
          <BoneLines style={styles.flex} />
          <Bone width={44} height={14} />
        </View>
      ))}
    </View>
  );
}

/**
 * Esqueleto de aba: título, controle de recorte e a lista (ou o cartão de destaque do Financeiro).
 * Segue o desenho das telas para a troca não "pular".
 */
export function TabSkeleton({ variant }: { variant: 'list' | 'finance' }) {
  const p = usePalette();
  return (
    <SafeAreaView
      edges={['top']}
      style={[styles.screen, { backgroundColor: p.background }]}
      accessible
      accessibilityLabel="Carregando"
      accessibilityState={{ busy: true }}>
      <View style={styles.content} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
        <View style={styles.title}>
          <Bone width={150} height={28} round={8} />
          <Bone width={40} height={40} round={20} />
        </View>
        {variant === 'finance' ? (
          <>
            <Bone height={180} round={radius.xl} />
            <View style={styles.shortcuts}>
              {[0, 1, 2, 3].map((i) => <Bone key={i} width={72} height={72} round={20} />)}
            </View>
            <RowsCard rows={3} />
          </>
        ) : (
          <>
            <Bone width="60%" height={18} />
            <Bone height={44} round={radius.lg} />
            <RowsCard rows={4} />
          </>
        )}
      </View>
    </SafeAreaView>
  );
}

/**
 * Primeira visita a uma aba pesada: o toque responde na hora com o esqueleto e o conteúdo monta no
 * quadro seguinte, sem segurar a troca de aba. Depois a aba fica montada e não passa mais por aqui.
 */
export function FirstVisit({ skeleton, children }: { skeleton: ReactNode; children: ReactNode }) {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const frame = requestAnimationFrame(() => {
      timer = setTimeout(() => setReady(true), 0);
    });
    return () => {
      cancelAnimationFrame(frame);
      if (timer) clearTimeout(timer);
    };
  }, []);
  return ready ? children : skeleton;
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { width: '100%', maxWidth: 640, alignSelf: 'center', paddingHorizontal: space.lg, paddingTop: space.md, gap: space.lg },
  title: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  shortcuts: { flexDirection: 'row', justifyContent: 'space-between' },
  card: { borderRadius: radius.xl, borderWidth: StyleSheet.hairlineWidth, paddingHorizontal: space.md },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.md },
  lines: { gap: 6 },
  flex: { flex: 1 },
});
