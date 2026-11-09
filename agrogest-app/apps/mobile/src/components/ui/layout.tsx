import { Children, Fragment, isValidElement, useCallback, useEffect, useRef, type ReactNode, type Ref } from 'react';
import {
  Pressable,
  SectionList,
  type ScrollViewInstance,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, useFocusEffect } from 'expo-router';
import { setStatusBarStyle } from 'expo-status-bar';

import { elevation, radius, space, usePalette, type Tone } from '@/theme';
import { useApp } from '@/state/app-state';
import { useSyncStatus } from '@/state/sync-status';

import { AppLottie, type IllustrationName } from '../animation';
import { FormViewport } from './keyboard';
import { haptics } from './motion';
import { AppText, Icon, IconTile, type IconName } from './text';

/**
 * Tela rolável. `tab`: tela de aba (sem cabeçalho nativo, respeita o topo).
 * `hero`: o cabeçalho é uma faixa escura que vai até o topo da tela; ele cuida da área de status.
 */
export function Screen({
  children,
  header,
  footer,
  tab = false,
  hero = false,
  scrollRef,
}: {
  children: ReactNode;
  header?: ReactNode;
  footer?: ReactNode;
  tab?: boolean;
  hero?: boolean;
  scrollRef?: Ref<ScrollViewInstance>;
}) {
  const p = usePalette();
  useStatusBarStyle(hero);
  const edges = hero ? [] : tab ? ['top'] : ['bottom'];
  return (
    <SafeAreaView edges={edges as ('top' | 'bottom')[]} style={[styles.flex, { backgroundColor: p.background }]}>
      <FormViewport
        scrollRef={scrollRef}
        contentContainerStyle={styles.content}
        footer={footer ? (
          <View style={[styles.footer, { backgroundColor: p.background, borderTopColor: p.border }]}>
            <View style={styles.footerInner}>{footer}</View>
          </View>
        ) : undefined}>
        {header}
        <CloudNotice />
        {children}
      </FormViewport>
      {hero ? <HeroStatusBar /> : null}
    </SafeAreaView>
  );
}

/**
 * Cor dos ícones da barra de status por tela: quem ganha o foco decide (claros sobre a faixa escura,
 * do tema nas demais). Sem limpeza no blur, para a ordem dos eventos entre abas não deixar o errado.
 */
export function useStatusBarStyle(hero: boolean) {
  const dark = usePalette().scheme === 'dark';
  useFocusEffect(
    useCallback(() => {
      setStatusBarStyle(hero || dark ? 'light' : 'dark', true);
    }, [hero, dark]),
  );
}

/**
 * Telas com faixa escura no topo: a área do relógio fica sempre na cor da faixa, com ícones claros.
 * Sem isso, ao rolar, o conteúdo passa por baixo do relógio e os ícones escuros somem no verde.
 */
function HeroStatusBar() {
  const p = usePalette();
  const insets = useSafeAreaInsets();
  return <View pointerEvents="none" style={[styles.statusScrim, { height: insets.top, backgroundColor: p.hero }]} />;
}

export interface ListSection<Item> {
  key: string;
  title?: string;
  action?: { label: string; onPress: () => void };
  data: readonly Item[];
}

/** Listas longas usam uma única área virtualizada, sem montar todos os registros ao abrir. */
export function SectionListScreen<Item>({
  sections,
  renderItem,
  keyExtractor,
  header,
  empty,
  tab = false,
  resetKey,
}: {
  sections: readonly ListSection<Item>[];
  renderItem: (item: Item) => ReactNode;
  keyExtractor: (item: Item) => string;
  header?: ReactNode;
  empty?: ReactNode;
  tab?: boolean;
  /** Volta ao topo ao mudar filtro ou fazenda, preservando o estado dos controles do cabeçalho. */
  resetKey?: string;
}) {
  const p = usePalette();
  useStatusBarStyle(false);
  const list = useRef<SectionList<Item, ListSection<Item>>>(null);
  useEffect(() => {
    list.current?.getScrollResponder()?.scrollTo({ y: 0, animated: false });
  }, [resetKey]);
  return (
    <SafeAreaView edges={tab ? ['top'] : ['bottom']} style={[styles.flex, { backgroundColor: p.background }]}>
      <SectionList
        ref={list}
        sections={sections}
        keyExtractor={keyExtractor}
        style={styles.flex}
        contentContainerStyle={[styles.content, styles.listContent]}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        stickySectionHeadersEnabled={false}
        initialNumToRender={12}
        windowSize={9}
        ListHeaderComponent={
          <>
            {header ? <View style={styles.listHeader}>{header}</View> : null}
            <CloudNotice list />
          </>
        }
        // View, não Fragment: a lista injeta onLayout no componente vazio.
        ListEmptyComponent={empty ? <View>{empty}</View> : undefined}
        renderSectionHeader={({ section }) => section.title || section.action ? (
          <View style={styles.listSectionTitle}>
            <SectionHeading title={section.title} action={section.action} />
          </View>
        ) : null}
        renderSectionFooter={() => <View style={styles.listSectionGap} />}
        renderItem={({ item, index, section }) => (
          <View style={[
            styles.listItem,
            { backgroundColor: p.surface, borderColor: p.border },
            index === 0 && styles.listItemFirst,
            index === section.data.length - 1 && styles.listItemLast,
          ]}>
            {index > 0 ? <View style={[styles.separator, { backgroundColor: p.border }]} /> : null}
            {renderItem(item)}
          </View>
        )}
      />
    </SafeAreaView>
  );
}

/** Provisional local data is never presented as a completed cloud sync. */
function CloudNotice({ list = false }: { list?: boolean }) {
  const app = useApp();
  const sync = useSyncStatus();
  const p = usePalette();
  if (!app.cloudMode || !app.signedIn || (!sync.syncError && sync.pendingCommands === 0)) return null;
  return (
    <View style={{ padding: space.md, gap: space.sm, borderRadius: radius.lg, backgroundColor: p.fill, marginBottom: list ? space.xl : 0 }}>
      <AppText variant="bodyStrong" accessibilityLiveRegion="polite">
        {sync.syncError ? 'Há registros para revisar' : `${sync.pendingCommands} ${sync.pendingCommands === 1 ? 'registro aguarda' : 'registros aguardam'} envio`}
      </AppText>
      <AppText variant="caption" tone="muted">{sync.syncError ?? 'Os dados deste aparelho são provisórios até a confirmação do servidor.'}</AppText>
      <Pressable accessibilityRole="button" onPress={() => router.push('/sincronizacao')}>
        <AppText variant="label">Conferir sincronização</AppText>
      </Pressable>
    </View>
  );
}

/** Bloco com rótulo discreto. */
export function Section({
  title,
  action,
  children,
}: {
  title?: string;
  action?: { label: string; onPress: () => void };
  children: ReactNode;
}) {
  return (
    <View style={styles.section}>
      {title || action ? <SectionHeading title={title} action={action} /> : null}
      {children}
    </View>
  );
}

/** Bloco com título grande, como "Pro dia a dia" no PicPay; a ação opcional fica à direita. */
export function TitledSection({
  title,
  action,
  children,
}: {
  title: string;
  action?: { label: string; onPress: () => void };
  children: ReactNode;
}) {
  const p = usePalette();
  return (
    <View style={styles.titled}>
      <View style={styles.sectionHeader}>
        <AppText variant="title" accessibilityRole="header" numberOfLines={1} style={styles.sectionTitle}>
          {title}
        </AppText>
        {action ? (
          <Pressable accessibilityRole="button" onPress={action.onPress} hitSlop={10}>
            <AppText variant="label" style={{ color: p.accent }}>{action.label}</AppText>
          </Pressable>
        ) : null}
      </View>
      {children}
    </View>
  );
}

function SectionHeading({ title, action }: Pick<ListSection<never>, 'title' | 'action'>) {
  const p = usePalette();
  return (
    <View style={styles.sectionHeader}>
      {title ? <AppText variant="label" tone="muted" accessibilityRole="header" style={styles.sectionTitle}>{title}</AppText> : <View />}
      {action ? (
        <Pressable accessibilityRole="button" onPress={action.onPress} hitSlop={10}>
          <AppText variant="label" style={{ color: p.accent }}>{action.label}</AppText>
        </Pressable>
      ) : null}
    </View>
  );
}

/** Lista agrupada: um contêiner arredondado com separadores finos. */
export function Group({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const p = usePalette();
  const items = Children.toArray(children).filter(isValidElement);
  // Sombra no contêiner externo; o recorte (overflow) fica no interno, senão o iOS corta a sombra.
  return (
    <View style={[styles.group, { backgroundColor: p.surface }, elevation(p), style]}>
      <View style={styles.clip}>
        {items.map((child, i) => (
          <Fragment key={child.key ?? i}>
            {i > 0 ? <View style={[styles.separator, { backgroundColor: p.border }]} /> : null}
            {child}
          </Fragment>
        ))}
      </View>
    </View>
  );
}

/** Contêiner simples para conteúdo livre: cartão branco com sombra leve (borda só no escuro). */
export function Card({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const p = usePalette();
  return <View style={[styles.card, { backgroundColor: p.surface }, elevation(p), style]}>{children}</View>;
}

export function ListRow({
  icon,
  leading,
  iconTone = 'neutral',
  title,
  subtitle,
  right,
  onPress,
  selected,
  chevron,
  accessibilityLabel,
}: {
  icon?: IconName;
  /** Elemento à esquerda no lugar do ícone (ex.: avatar). */
  leading?: ReactNode;
  iconTone?: Tone;
  title: ReactNode;
  subtitle?: ReactNode;
  right?: ReactNode;
  onPress?: () => void;
  /** Mostra um check à direita (lista de seleção). */
  selected?: boolean;
  chevron?: boolean;
  accessibilityLabel?: string;
}) {
  const p = usePalette();
  const content = (pressed: boolean) => (
    <View style={[styles.row, pressed && { backgroundColor: p.fill }]}>
      {leading ?? (icon ? <IconTile name={icon} tone={iconTone} size={34} /> : null)}
      <View style={styles.rowText}>
        {typeof title === 'string' ? <AppText variant="bodyStrong">{title}</AppText> : title}
        {typeof subtitle === 'string' ? (
          <AppText variant="caption" tone="muted">
            {subtitle}
          </AppText>
        ) : (
          subtitle
        )}
      </View>
      {right}
      {selected !== undefined ? (
        <Icon name={selected ? 'check-circle' : 'circle-outline'} size={22} color={selected ? p.accent : p.textFaint} />
      ) : (chevron ?? !!onPress) ? (
        <Icon name="chevron-right" size={20} color={p.textFaint} />
      ) : null}
    </View>
  );
  if (!onPress) return content(false);
  return (
    <Pressable
      accessibilityRole={selected !== undefined ? 'radio' : 'button'}
      aria-checked={selected}
      accessibilityLabel={accessibilityLabel}
      onPress={() => {
        haptics.tap();
        onPress();
      }}>
      {({ pressed }) => content(pressed)}
    </Pressable>
  );
}

export function Row({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[styles.inline, style]}>{children}</View>;
}

export function Divider() {
  const p = usePalette();
  return <View style={[styles.divider, { backgroundColor: p.border }]} />;
}

/** Linha rótulo/valor. */
export function KV({ label, value, strong, hint }: { label: string; value: ReactNode; strong?: boolean; hint?: string }) {
  return (
    <View style={styles.kv}>
      <View style={styles.kvLabel}>
        <AppText tone="muted">{label}</AppText>
        {hint ? (
          <AppText variant="caption" tone="faint">
            {hint}
          </AppText>
        ) : null}
      </View>
      {typeof value === 'string' ? (
        <AppText variant={strong ? 'bodyStrong' : 'body'} numeric style={styles.kvValue}>
          {value}
        </AppText>
      ) : (
        value
      )}
    </View>
  );
}

/**
 * Estado vazio que diz o que falta, ensina o que vai aparecer ali e já oferece o caminho
 * (ação principal e, se houver, uma secundária).
 */
export function EmptyState({
  icon,
  illustration,
  tone = 'neutral',
  title,
  message,
  children,
}: {
  icon: IconName;
  illustration?: IllustrationName;
  tone?: Tone;
  title: string;
  message?: string;
  children?: ReactNode;
}) {
  return (
    <View style={styles.empty}>
      {illustration ? <AppLottie name={illustration} size={200} /> : <IconTile name={icon} size={56} tone={tone} />}
      <View style={styles.emptyText}>
        <AppText variant="heading" style={styles.center}>
          {title}
        </AppText>
        {message ? (
          <AppText tone="muted" style={styles.center}>
            {message}
          </AppText>
        ) : null}
      </View>
      {children ? <View style={styles.emptyActions}>{children}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  statusScrim: { position: 'absolute', top: 0, left: 0, right: 0 },
  content: {
    paddingHorizontal: space.lg + 4,
    paddingTop: space.md,
    paddingBottom: space.xxl + space.lg,
    gap: space.xl,
    width: '100%',
    maxWidth: 640,
    alignSelf: 'center',
  },
  listContent: { gap: 0 },
  listHeader: { gap: space.xl, paddingBottom: space.xl },
  listSectionTitle: { paddingBottom: space.sm + 2 },
  listSectionGap: { height: space.xl },
  listItem: { borderLeftWidth: StyleSheet.hairlineWidth, borderRightWidth: StyleSheet.hairlineWidth, overflow: 'hidden' },
  listItemFirst: { borderTopWidth: StyleSheet.hairlineWidth, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl },
  listItemLast: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomLeftRadius: radius.xl, borderBottomRightRadius: radius.xl },
  footer: { borderTopWidth: StyleSheet.hairlineWidth },
  footerInner: {
    flexDirection: 'row',
    gap: space.sm,
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
    width: '100%',
    maxWidth: 640,
    alignSelf: 'center',
  },
  section: { gap: space.sm + 2 },
  titled: { gap: space.md },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 2, gap: space.sm },
  sectionTitle: { flexShrink: 1 },
  group: { borderRadius: radius.xxl },
  clip: { borderRadius: radius.xxl, overflow: 'hidden' },
  separator: { height: StyleSheet.hairlineWidth, marginLeft: space.lg },
  card: { borderRadius: radius.xxl, padding: space.lg, gap: space.md },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
    minHeight: 56,
  },
  rowText: { flex: 1, gap: 1 },
  inline: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  divider: { height: StyleSheet.hairlineWidth },
  kv: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: space.md },
  kvLabel: { flexShrink: 1 },
  kvValue: { textAlign: 'right', flexShrink: 1 },
  empty: { alignItems: 'center', gap: space.lg, paddingVertical: space.xl, paddingHorizontal: space.md },
  emptyText: { alignItems: 'center', gap: space.xs, maxWidth: 360 },
  emptyActions: { alignSelf: 'stretch', gap: space.sm, marginTop: space.xs },
  center: { textAlign: 'center' },
});
