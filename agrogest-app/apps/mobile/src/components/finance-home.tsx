import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, View, type ScrollViewInstance, type LayoutChangeEvent } from 'react-native';
import Animated, { FadeIn, FadeInDown, useSharedValue } from 'react-native-reanimated';
import { Carousel, Pagination, type CarouselRef } from 'react-native-reanimated-carousel';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { G, Rect } from 'react-native-svg';

import { ConnectionPill, heroBand } from '@/components/header';
import { goBack } from '@/components/navigation';
import { NotificationBell } from '@/components/notifications';
import { ArrowLeft, ChevronRight, Eye, EyeOff, LayoutGrid, X, type LucideIcon } from '@/components/ui/lucide';
import { haptics, PressableScale, useMotion } from '@/components/ui/motion';
import { AppText } from '@/components/ui/text';
import { formatCents, formatCentsShort, plural } from '@/domain/format';
import { radius, soft, space, toneColor, usePalette, type Tone } from '@/theme';

/** Valor escondido pelo botão de olho, como nos apps de banco. */
export const HIDDEN_MONEY = 'R$ ••••••';

const WHITE = '#FFFFFF';
/** Texto sobre a pílula branca da fazenda escolhida. */
const INK = '#0B0F0C';

/** Ícone Lucide num quadrado arredondado com fundo suave da cor do tom. */
export function IconBadge({ icon: Icon, tone = 'neutral', size = 40 }: { icon: LucideIcon; tone?: Tone; size?: number }) {
  const p = usePalette();
  const color = tone === 'neutral' ? p.text : toneColor(p, tone);
  return (
    <View style={[styles.badge, { width: size, height: size, borderRadius: size * 0.32, backgroundColor: tone === 'neutral' ? p.fill : soft(color) }]}>
      <Icon size={size * 0.5} color={color} strokeWidth={2} />
    </View>
  );
}

// ─── Topo escuro: título, fazendas e indicadores ───────────────────────────────────────────

export type FarmChip = { id: string | null; label: string };

/**
 * Topo do Financeiro no formato do PicPay: faixa escura de borda a borda com o título e os botões
 * redondos, as fazendas em pílulas (como os bancos no PicPay) e os indicadores em cartões que se
 * arrastam. Vai até o topo da tela, por isso a `Screen` usa `hero`.
 */
export function FinanceHero({
  title,
  back,
  farms,
  selectedFarm,
  onSelectFarm,
  subtitle,
  slides,
  hidden,
  onToggleHidden,
}: {
  title: string;
  back?: boolean;
  /** Pílulas de fazenda; com menos de duas, somem e a `subtitle` diz onde se está. */
  farms: FarmChip[];
  selectedFarm: string | null;
  onSelectFarm: (id: string | null) => void;
  subtitle?: string;
  slides?: KpiSlide[];
  hidden: boolean;
  onToggleHidden: () => void;
}) {
  const p = usePalette();
  const insets = useSafeAreaInsets();
  return (
    <View style={[heroBand, styles.hero, { backgroundColor: p.hero, paddingTop: insets.top + space.md }]}>
      <View style={styles.heroTop}>
        <View style={styles.heroTitle}>
          {back ? (
            <RoundButton label="Voltar" onPress={goBack}>
              <ArrowLeft size={22} color={WHITE} strokeWidth={2} />
            </RoundButton>
          ) : null}
          <View style={styles.flexShrink}>
            <AppText variant="largeTitle" accessibilityRole="header" numberOfLines={1} style={styles.onDark}>
              {title}
            </AppText>
            {farms.length < 2 && subtitle ? (
              <AppText variant="caption" numberOfLines={1} style={styles.onDarkMuted}>
                {subtitle}
              </AppText>
            ) : null}
          </View>
        </View>
        <View style={styles.heroActions}>
          <ConnectionPill onDark />
          <NotificationBell onDark />
        </View>
      </View>
      {farms.length > 1 ? <FarmChips farms={farms} selected={selectedFarm} onSelect={onSelectFarm} /> : null}
      {slides && slides.length > 0 ? <KpiCarousel slides={slides} hidden={hidden} onToggleHidden={onToggleHidden} /> : null}
    </View>
  );
}

/** Botão redondo translúcido sobre a faixa escura, do mesmo tamanho do sino. */
function RoundButton({ label, onPress, children }: { label: string; onPress: () => void; children: ReactNode }) {
  return (
    <PressableScale accessibilityRole="button" accessibilityLabel={label} hitSlop={6} onPress={onPress} scaleTo={0.92} style={styles.round}>
      {children}
    </PressableScale>
  );
}

/** Iniciais da fazenda para o círculo da pílula ("Fazenda Santa Fé" → "SF"). */
function initials(label: string): string {
  const all = label.split(/\s+/).filter(Boolean);
  const words = all.filter((w) => !/^(fazenda|sítio|sitio|estância|estancia|de|da|do|das|dos|e)$/i.test(w));
  return (words.length > 0 ? words : all)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('');
}

/** Fazendas em pílulas que rolam para o lado; a escolhida fica branca, como o banco atual no PicPay. */
function FarmChips({ farms, selected, onSelect }: { farms: FarmChip[]; selected: string | null; onSelect: (id: string | null) => void }) {
  const p = usePalette();
  const motion = useMotion();
  const scroll = useRef<ScrollViewInstance>(null);
  const offsets = useRef(new Map<string, { x: number; width: number }>());
  const viewport = useRef(0);
  const key = (id: string | null) => id ?? 'todas';
  // A escolhida fica inteira à vista, rolando só o que falta: no começo da fila, "Todas" e as
  // primeiras continuam aparecendo (antes a escolhida ia para a borda e escondia as anteriores).
  const reveal = (id: string | null, animated: boolean) => {
    const chip = offsets.current.get(key(id));
    if (!chip || viewport.current === 0) return;
    const right = chip.x + chip.width + space.lg + 4;
    scroll.current?.scrollTo({ x: Math.max(0, right - viewport.current), animated });
  };
  useEffect(() => {
    reveal(selected, motion);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected]);
  return (
    <ScrollView
      ref={scroll}
      horizontal
      showsHorizontalScrollIndicator={false}
      onLayout={(e) => {
        viewport.current = e.nativeEvent.layout.width;
        reveal(selected, false);
      }}
      style={styles.chipsBleed}
      contentContainerStyle={styles.chips}>
      {farms.map((farm) => {
        const active = farm.id === selected;
        return (
          <PressableScale
            key={key(farm.id)}
            onLayout={(e) => {
              offsets.current.set(key(farm.id), { x: e.nativeEvent.layout.x, width: e.nativeEvent.layout.width });
              if (active) reveal(farm.id, false);
            }}
            accessibilityRole="radio"
            accessibilityState={{ selected: active }}
            accessibilityLabel={farm.id ? `Fazenda ${farm.label}` : 'Todas as fazendas'}
            onPress={() => {
              if (!active) onSelect(farm.id);
            }}
            scaleTo={0.95}
            style={[styles.chip, { backgroundColor: active ? WHITE : 'rgba(255,255,255,0.12)' }]}>
            <View style={[styles.chipMark, { backgroundColor: active ? p.hero : 'rgba(255,255,255,0.16)' }]}>
              {farm.id ? (
                <AppText variant="label" style={[styles.chipInitials, styles.onDark]}>
                  {initials(farm.label)}
                </AppText>
              ) : (
                <LayoutGrid size={16} color={WHITE} strokeWidth={2} />
              )}
            </View>
            <AppText variant="bodyStrong" numberOfLines={1} style={[styles.chipLabel, { color: active ? INK : WHITE }]}>
              {farm.label}
            </AppText>
          </PressableScale>
        );
      })}
    </ScrollView>
  );
}

export type KpiSlide = {
  key: string;
  /** `danger` tinge o cartão de vermelho (previsão negativa); o resto é neutro sobre a faixa. */
  tone?: 'neutral' | 'danger';
  icon: LucideIcon;
  label: string;
  value: string;
  /** Linha curta abaixo do número (ex.: "em 2 contas"). */
  caption?: string;
  /** Conteúdo livre no pé do cartão: mini gráfico, entradas e saídas. */
  extra?: ReactNode;
  action: { label: string; onPress: () => void };
};

const CARD_HEIGHT = 214;
const PEEK = 18;
const GAP = 10;
/** Cartões translúcidos sobre a faixa: a cor da faixa aparece por trás, como o cinza do PicPay no preto. */
const CARD_COLORS = {
  neutral: ['rgba(255,255,255,0.15)', 'rgba(255,255,255,0.07)'],
  danger: ['rgba(251,113,133,0.45)', 'rgba(251,113,133,0.2)'],
} as const;

/**
 * Indicadores em cartões que se arrastam para os lados (saldo, previsão, mês, cartões), como a
 * home do PicPay. O próximo cartão aparece na borda para mostrar que dá para arrastar; os pontos
 * abaixo também levam direto a cada cartão.
 */
function KpiCarousel({ slides, hidden, onToggleHidden }: { slides: KpiSlide[]; hidden: boolean; onToggleHidden: () => void }) {
  const motion = useMotion();
  const [width, setWidth] = useState(0);
  const progress = useSharedValue(0);
  const ref = useRef<CarouselRef>(null);
  const onLayout = (e: LayoutChangeEvent) => setWidth(Math.round(e.nativeEvent.layout.width));
  const itemSize = slides.length > 1 ? width - PEEK : width;
  return (
    <View onLayout={onLayout} style={styles.carouselBox}>
      {width > 0 ? (
        <>
          <Carousel
            ref={ref}
            data={slides}
            keyExtractor={(s) => s.key}
            style={{ width, height: CARD_HEIGHT, overflow: 'visible' }}
            itemSize={itemSize}
            progress={progress}
            snapMode="page"
            overscrollEnabled={false}
            animation={motion ? { type: 'spring', damping: 22, stiffness: 180, mass: 0.9 } : { type: 'timing', duration: 0 }}
            onConfigurePanGesture={(g) => {
              // Só captura o arrasto horizontal: a rolagem vertical da tela continua livre.
              g.activeOffsetX([-12, 12]).failOffsetY([-10, 10]);
            }}
            onSnapToItem={() => haptics.tap()}
            renderItem={({ item }) => (
              <View style={{ width: itemSize, height: CARD_HEIGHT, paddingRight: slides.length > 1 ? GAP : 0 }}>
                <KpiCard slide={item} hidden={hidden} onToggleHidden={onToggleHidden} />
              </View>
            )}
          />
          {slides.length > 1 ? (
            <Pagination
              count={slides.length}
              progress={progress}
              onPress={(index) => ref.current?.scrollTo({ index, animated: motion })}
              getItemAccessibilityLabel={(index, count) => `${slides[index]?.label ?? 'Cartão'}, ${index + 1} de ${count}`}
              containerStyle={styles.dots}
              dotStyle={{ width: 7, height: 7, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.32)' }}
              activeDotStyle={{ width: 22, height: 7, borderRadius: 4, backgroundColor: WHITE }}
            />
          ) : null}
        </>
      ) : (
        <View style={{ height: CARD_HEIGHT }} />
      )}
    </View>
  );
}

/**
 * Cartão do indicador, como o "Conta" do PicPay: ícone e nome à esquerda com o atalho em texto à
 * direita, o número grande com o olho ao lado e, no pé, o detalhe separado por uma linha fina.
 */
function KpiCard({ slide, hidden, onToggleHidden }: { slide: KpiSlide; hidden: boolean; onToggleHidden: () => void }) {
  const Icon = slide.icon;
  return (
    <LinearGradient colors={CARD_COLORS[slide.tone ?? 'neutral']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.kpi}>
      <View style={styles.kpiTop}>
        <View style={styles.kpiName}>
          <View style={styles.kpiIcon}>
            <Icon size={18} color={WHITE} strokeWidth={1.9} />
          </View>
          <AppText variant="heading" numberOfLines={1} style={[styles.onDark, styles.flexShrink]}>
            {slide.label}
          </AppText>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={slide.action.label}
          hitSlop={10}
          onPress={() => {
            haptics.tap();
            slide.action.onPress();
          }}
          style={({ pressed }) => [styles.kpiAction, pressed && { opacity: 0.6 }]}>
          <AppText variant="label" numberOfLines={1} style={[styles.onDark, styles.kpiActionText]}>
            {slide.action.label}
          </AppText>
          <ChevronRight size={18} color={WHITE} strokeWidth={2.2} />
        </Pressable>
      </View>
      <View style={styles.kpiMain}>
        <View style={styles.kpiValueRow}>
          <AppText
            variant="largeTitle"
            numeric
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.6}
            style={[styles.onDark, styles.kpiValue]}
            accessibilityLabel={`${slide.label}: ${hidden ? 'oculto' : slide.value}`}>
            {hidden ? HIDDEN_MONEY : slide.value}
          </AppText>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={hidden ? 'Mostrar valores' : 'Esconder valores'}
            hitSlop={12}
            onPress={() => {
              haptics.tap();
              onToggleHidden();
            }}
            style={({ pressed }) => [styles.eye, pressed && { opacity: 0.6 }]}>
            {hidden ? <EyeOff size={22} color={WHITE} strokeWidth={1.75} /> : <Eye size={22} color={WHITE} strokeWidth={1.75} />}
          </Pressable>
        </View>
        {slide.caption ? (
          <AppText variant="caption" numberOfLines={1} style={styles.onDarkMuted}>
            {slide.caption}
          </AppText>
        ) : null}
      </View>
      {slide.extra ? <View style={styles.kpiFoot}>{slide.extra}</View> : <View />}
    </LinearGradient>
  );
}

/** Entradas e saídas lado a lado dentro de um cartão escuro. */
export function KpiFlows({ items, hidden }: { items: { icon: LucideIcon; label: string; cents: number }[]; hidden: boolean }) {
  return (
    <View style={styles.flows}>
      {items.map(({ icon: Icon, label, cents }) => (
        <View key={label} style={styles.flow}>
          <View style={styles.flowIcon}>
            <Icon size={13} color={WHITE} strokeWidth={2.4} />
          </View>
          <View style={styles.flex}>
            <AppText variant="caption" numberOfLines={2} style={[styles.onDarkMuted, styles.small]}>
              {label}
            </AppText>
            <AppText variant="label" numeric numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8} style={styles.onDark}>
              {hidden ? 'R$ ••••' : cents === 0 ? 'R$ 0' : `R$ ${formatCentsShort(cents)}`}
            </AppText>
          </View>
        </View>
      ))}
    </View>
  );
}

/** Barras semanais de entradas (verdes) e saídas (rosadas) das próximas semanas. */
export function KpiBars({ weeks }: { weeks: { label: string; inCents: number; outCents: number }[] }) {
  const max = Math.max(1, ...weeks.flatMap((w) => [w.inCents, w.outCents]));
  const barW = 7;
  const h = 40;
  const groupW = 30;
  return (
    <View style={styles.bars} accessible accessibilityLabel="Entradas e saídas previstas por semana">
      <Svg width={groupW * weeks.length} height={h}>
        {weeks.map((w, i) => {
          const inH = w.inCents > 0 ? Math.max(3, (w.inCents / max) * h) : 2;
          const outH = w.outCents > 0 ? Math.max(3, (w.outCents / max) * h) : 2;
          const x = i * groupW + 6;
          return (
            <G key={w.label}>
              <Rect x={x} y={h - inH} width={barW} height={inH} rx={2} fill="#B9F6CA" />
              <Rect x={x + barW + 2} y={h - outH} width={barW} height={outH} rx={2} fill="#FFB4A8" />
            </G>
          );
        })}
      </Svg>
      <View style={styles.barLabels}>
        {weeks.map((w) => (
          <AppText key={w.label} variant="caption" style={[styles.onDarkMuted, styles.barLabel]}>
            {w.label}
          </AppText>
        ))}
      </View>
    </View>
  );
}

// ─── Situação das contas ───────────────────────────────────────────────────────────────────

export type StatusTile = { key: string; icon: LucideIcon; label: string; cents: number; count: number; tone: Tone; selected: boolean; onPress: () => void };

/**
 * Situação das contas em três blocos que também filtram a lista (atrasadas, a vencer, todas).
 * Tocar no bloco já escolhido volta para todas.
 */
export function StatusTiles({ tiles, hidden }: { tiles: StatusTile[]; hidden?: boolean }) {
  const p = usePalette();
  return (
    <View style={styles.tiles}>
      {tiles.map(({ icon: Icon, ...t }) => {
        const color = t.tone === 'neutral' ? p.accent : toneColor(p, t.tone);
        const active = t.count > 0;
        return (
          <PressableScale
            key={t.key}
            accessibilityRole="button"
            accessibilityState={{ selected: t.selected }}
            accessibilityLabel={`${t.label}: ${plural(t.count, 'parcela', 'parcelas')}, ${formatCents(t.cents)}`}
            onPress={t.onPress}
            scaleTo={0.96}
            containerStyle={styles.flex}
            style={[styles.tile, { backgroundColor: t.selected ? soft(color) : p.surface, borderColor: t.selected ? color : p.border }]}>
            <View style={[styles.tileIcon, { backgroundColor: active ? soft(color) : p.fill }]}>
              <Icon size={16} color={active ? color : p.textFaint} strokeWidth={2.2} />
            </View>
            <AppText variant="label" tone="muted" numberOfLines={1}>
              {t.label}
            </AppText>
            <AppText variant="bodyStrong" numeric numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75} style={{ color: active ? (t.tone === 'neutral' ? p.text : color) : p.textMuted }}>
              {hidden ? 'R$ •••' : t.cents === 0 ? 'R$ 0' : `R$ ${formatCentsShort(t.cents)}`}
            </AppText>
            <AppText variant="caption" tone="faint" numberOfLines={1} style={styles.small}>
              {plural(t.count, 'parcela', 'parcelas')}
            </AppText>
          </PressableScale>
        );
      })}
    </View>
  );
}

/** Botão pequeno em pílula para a barra acima da lista (Filtrar, Selecionar). */
export function PillButton({ icon: Icon, label, onPress, active, count }: { icon: LucideIcon; label: string; onPress: () => void; active?: boolean; count?: number }) {
  const p = usePalette();
  const fg = active ? p.accent : p.text;
  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={count ? `${label}, ${count} ativos` : label}
      hitSlop={6}
      onPress={onPress}
      style={[styles.pill, { backgroundColor: active ? p.accentSoft : p.surface, borderColor: active ? p.accent : p.border }]}>
      <Icon size={16} color={fg} strokeWidth={2.2} />
      <AppText variant="label" style={{ color: fg }}>
        {label}
      </AppText>
      {count ? (
        <View style={[styles.count, { backgroundColor: p.accent }]}>
          <AppText variant="label" numeric style={{ color: p.onAccent, fontSize: 11, lineHeight: 14 }}>
            {count}
          </AppText>
        </View>
      ) : null}
    </PressableScale>
  );
}

/** Filtro aplicado, com um toque para remover. */
export function FilterTag({ label, onRemove }: { label: string; onRemove: () => void }) {
  const p = usePalette();
  return (
    <Animated.View entering={FadeIn.duration(160)}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Remover filtro ${label}`}
        onPress={() => {
          haptics.tap();
          onRemove();
        }}
        style={({ pressed }) => [styles.tag, { backgroundColor: p.accentSoft, borderColor: p.accent, opacity: pressed ? 0.8 : 1 }]}>
        <AppText variant="label" numberOfLines={1} style={{ color: p.accent, maxWidth: 200 }}>
          {label}
        </AppText>
        <X size={14} color={p.accent} strokeWidth={2.4} />
      </Pressable>
    </Animated.View>
  );
}

// ─── Painel inferior ───────────────────────────────────────────────────────────────────────

/** Grupo de opções dentro do painel de filtros. */
export function SheetGroup({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View style={styles.sheetGroup}>
      <AppText variant="label" tone="muted">
        {title}
      </AppText>
      <View style={styles.wrap}>{children}</View>
    </View>
  );
}

/** Rodapé da seleção: total escolhido e as duas ações possíveis. */
export function SelectionBar({ summary, children }: { summary: string; children: ReactNode }) {
  return (
    <View style={styles.selection}>
      <AppText variant="caption" tone="muted" numeric accessibilityLiveRegion="polite">
        {summary}
      </AppText>
      <View style={styles.selectionActions}>{children}</View>
    </View>
  );
}

/** Bloco que entra deslizando quando a lista muda (filtros, abas). */
export function Reveal({ children, index = 0 }: { children: ReactNode; index?: number }) {
  const motion = useMotion();
  if (Platform.OS === 'web') return <View style={styles.reveal}>{children}</View>;
  return (
    <Animated.View
      entering={motion ? FadeInDown.duration(220).delay(index * 40).withInitialValues({ transform: [{ translateY: 10 }] }) : undefined}
      style={styles.reveal}>
      {children}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  center: { textAlign: 'center' },
  small: { fontSize: 12, lineHeight: 16 },
  badge: { alignItems: 'center', justifyContent: 'center' },
  flexShrink: { flexShrink: 1 },
  // Topo
  hero: { paddingBottom: space.lg, gap: space.lg },
  heroTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.md, minHeight: 44 },
  heroTitle: { flexDirection: 'row', alignItems: 'center', gap: space.sm, flexShrink: 1 },
  heroActions: { flexDirection: 'row', alignItems: 'center', gap: space.sm, flexShrink: 0 },
  round: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.14)' },
  chipsBleed: { marginHorizontal: -(space.lg + 4), flexGrow: 0 },
  chips: { paddingHorizontal: space.lg + 4, gap: space.sm },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, height: 48, paddingLeft: 6, paddingRight: space.md + 2, borderRadius: radius.pill },
  chipMark: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  chipInitials: { fontSize: 12, lineHeight: 16 },
  chipLabel: { maxWidth: 200 },
  // Carrossel
  carouselBox: { gap: space.md },
  kpi: { flex: 1, borderRadius: radius.xxl, padding: space.lg + 4, overflow: 'hidden', justifyContent: 'space-between', borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(255,255,255,0.14)' },
  kpiTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.sm },
  kpiName: { flexDirection: 'row', alignItems: 'center', gap: space.sm + 2, flexShrink: 1 },
  kpiIcon: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.14)' },
  kpiAction: { flexDirection: 'row', alignItems: 'center', gap: 2, minHeight: 32, flexShrink: 0 },
  kpiActionText: { fontSize: 14, lineHeight: 18 },
  kpiMain: { gap: 2 },
  kpiValueRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  kpiValue: { fontSize: 34, lineHeight: 40, flexShrink: 1 },
  eye: { width: 40, height: 40, marginLeft: 'auto', alignItems: 'center', justifyContent: 'center' },
  kpiFoot: { paddingTop: space.md, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: 'rgba(255,255,255,0.18)' },
  onDark: { color: WHITE },
  onDarkMuted: { color: 'rgba(255,255,255,0.78)' },
  dots: { gap: 6, alignSelf: 'center' },
  flows: { flexDirection: 'row', gap: space.md },
  flow: { flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 },
  flowIcon: { width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.18)' },
  bars: { gap: 2, alignSelf: 'flex-start' },
  barLabels: { flexDirection: 'row' },
  barLabel: { width: 30, fontSize: 10, lineHeight: 12, textAlign: 'center' },
  // Situação
  tiles: { flexDirection: 'row', gap: space.sm },
  tile: { borderRadius: radius.lg, borderWidth: 1, padding: space.md - 2, gap: 3, minHeight: 112 },
  tileIcon: { width: 28, height: 28, borderRadius: 9, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  pill: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 36, paddingHorizontal: space.md, borderRadius: radius.pill, borderWidth: StyleSheet.hairlineWidth },
  count: { minWidth: 18, height: 18, borderRadius: 9, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 },
  tag: { flexDirection: 'row', alignItems: 'center', gap: 4, minHeight: 32, paddingHorizontal: space.md, borderRadius: radius.pill, borderWidth: 1 },
  // Painel
  sheetGroup: { gap: space.sm },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  selection: { flex: 1, gap: space.sm },
  selectionActions: { flexDirection: 'row', gap: space.sm },
  reveal: { gap: space.sm + 2 },
});
