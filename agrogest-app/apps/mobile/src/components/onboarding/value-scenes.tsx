import { useEffect, useRef, useState, type ReactNode } from 'react';
import { StyleSheet, Text, View, type StyleProp, type TextStyle, type ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { useMotion } from '@/components/ui/motion';
import {
  Beef,
  Check,
  CircleCheckBig,
  Clock,
  CloudUpload,
  Scale,
  TrendingUp,
  UserCheck,
  Wallet,
  Wifi,
  WifiOff,
  type LucideIcon,
} from '@/components/ui/lucide';
import { formatNumber } from '@/domain/format';
import { font, radius, soft, space, usePalette } from '@/theme';

/**
 * Cenas das boas-vindas: o próprio app em miniatura (cartões, números e estados reais), no lugar
 * de ilustração. Cada cena roda em etapas só enquanto está na tela; com "Reduzir animações" ou
 * fora de foco, mostra direto o estado final. Os valores são de exemplo.
 */

/** Etapa atual da cena: avança de 0 até `last`, segura um pouco e recomeça. */
function useSceneStep(active: boolean, last: number, interval = 750, hold = 3) {
  const motion = useMotion();
  const [step, setStep] = useState(last);
  useEffect(() => {
    if (!active || !motion) return;
    let tick = 0;
    const start = setTimeout(() => setStep(0), 0);
    const timer = setInterval(() => {
      tick = (tick + 1) % (last + 1 + hold);
      setStep(Math.min(tick, last));
    }, interval);
    return () => {
      clearTimeout(start);
      clearInterval(timer);
      setStep(last);
    };
  }, [active, motion, last, interval, hold]);
  return step;
}

/** Mostra/esconde com fade e um leve deslize, sem tirar do layout (a cena não pula). */
function Reveal({ show, children, style }: { show: boolean; children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const motion = useMotion();
  const value = useSharedValue(show ? 1 : 0);
  useEffect(() => {
    value.set(motion ? withTiming(show ? 1 : 0, { duration: 260 }) : show ? 1 : 0);
  }, [show, motion, value]);
  const animated = useAnimatedStyle(() => ({
    opacity: value.get(),
    transform: [{ translateY: (1 - value.get()) * 6 }],
  }));
  return <Animated.View style={[style, animated]}>{children}</Animated.View>;
}

/**
 * Número que conta até `to` quando `run` passa de desligado a ligado. Montado já ligado (cena fora
 * da tela) ou sem movimento, mostra direto o valor final: nada anima onde ninguém vê.
 */
function CountUp({ to, from = 0, run, format, style }: {
  to: number;
  from?: number;
  run: boolean;
  format: (value: number) => string;
  style?: StyleProp<TextStyle>;
}) {
  const motion = useMotion();
  const [value, setValue] = useState(run ? to : from);
  const wasRunning = useRef(run);
  useEffect(() => {
    const wasOn = wasRunning.current;
    wasRunning.current = run;
    if (!motion) return;
    if (!run) {
      const reset = setTimeout(() => setValue(from), 0);
      return () => clearTimeout(reset);
    }
    if (wasOn) return;
    let frame = 0;
    const startedAt = Date.now();
    const tick = () => {
      const t = Math.min(1, (Date.now() - startedAt) / 700);
      const eased = 1 - (1 - t) ** 3;
      setValue(from + (to - from) * eased);
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(frame);
      setValue(to);
    };
  }, [run, motion, from, to]);
  return <Text style={style}>{format(motion ? value : to)}</Text>;
}

/** Barra que cresce até `fraction` da altura (ou largura) quando `show` liga. */
function Grow({ show, fraction, horizontal = false, color, style }: {
  show: boolean;
  fraction: number;
  horizontal?: boolean;
  color: string;
  style?: StyleProp<ViewStyle>;
}) {
  const motion = useMotion();
  const value = useSharedValue(show ? fraction : 0);
  useEffect(() => {
    const target = show ? fraction : 0;
    value.set(motion ? withTiming(target, { duration: 420 }) : target);
  }, [show, fraction, motion, value]);
  const animated = useAnimatedStyle(() =>
    horizontal ? { width: `${value.get() * 100}%` } : { height: `${value.get() * 100}%` },
  );
  return <Animated.View style={[{ backgroundColor: color, borderRadius: 6 }, style, animated]} />;
}

function SceneCard({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const p = usePalette();
  return (
    <View style={[styles.card, { backgroundColor: p.surface, borderColor: p.border }, style]}>{children}</View>
  );
}

function Glyph({ icon: IconComponent, tone }: { icon: LucideIcon; tone: string }) {
  return (
    <View style={[styles.glyph, { backgroundColor: soft(tone) }]}>
      <IconComponent color={tone} size={20} strokeWidth={2} />
    </View>
  );
}

function Pill({ icon: IconComponent, label, color }: { icon: LucideIcon; label: string; color: string }) {
  return (
    <View style={[styles.pill, { backgroundColor: soft(color) }]}>
      <IconComponent color={color} size={14} strokeWidth={2.2} />
      <Text style={[styles.pillText, { color }]}>{label}</Text>
    </View>
  );
}

const WEIGHTS = [220, 236, 251, 266, 284, 300];

/** Rebanho: o lote com as pesagens subindo e o ganho por dia no fim. */
export function HerdScene({ active }: { active: boolean }) {
  const p = usePalette();
  const step = useSceneStep(active, WEIGHTS.length + 1, 420);
  return (
    <SceneCard>
      <View style={styles.row}>
        <Glyph icon={Beef} tone={p.accent} />
        <View style={styles.flex}>
          <Text style={[styles.title, { color: p.text }]}>Origem 021</Text>
          <Text style={[styles.caption, { color: p.textMuted }]}>Novilhas · 40 cab. · Pasto da Represa</Text>
        </View>
      </View>
      <View style={styles.weightRow}>
        <View>
          <Text style={[styles.caption, { color: p.textMuted }]}>Peso médio</Text>
          <Text style={[styles.big, { color: p.text }]}>
            {WEIGHTS[Math.min(step, WEIGHTS.length - 1)]} kg
          </Text>
        </View>
        <Reveal show={step > WEIGHTS.length - 1}>
          <Pill icon={TrendingUp} label="+0,53 kg/dia" color={p.success} />
        </Reveal>
      </View>
      <View style={styles.chart}>
        {WEIGHTS.map((kg, i) => (
          <View key={kg} style={styles.barSlot}>
            <Grow
              show={step >= i}
              fraction={(kg - 180) / 130}
              color={i === WEIGHTS.length - 1 ? p.accent : `${p.accent}55`}
              style={styles.bar}
            />
          </View>
        ))}
      </View>
    </SceneCard>
  );
}

const QUEUE = [
  { icon: Scale, title: 'Pesagem · Origem 021', detail: '40 cab. · 232 kg' },
  { icon: Wallet, title: 'Despesa · Sal mineral', detail: 'R$ 3.600' },
  { icon: Beef, title: 'Mudança de pasto', detail: 'Origem 022 → Piquete 3' },
];

/** Sem sinal: os registros ficam no aparelho e, quando a internet volta, vão um a um. */
export function OfflineScene({ active }: { active: boolean }) {
  const p = usePalette();
  // 0–1: sem sinal; 2: conectou; 3–5: cada registro enviado.
  const step = useSceneStep(active, QUEUE.length + 2, 800);
  const online = step >= 2;
  return (
    <SceneCard>
      <View style={[styles.row, styles.between]}>
        <Text style={[styles.title, { color: p.text }]}>Registros deste aparelho</Text>
        {online ? <Pill icon={Wifi} label="Conectado" color={p.success} /> : <Pill icon={WifiOff} label="Sem sinal" color={p.warning} />}
      </View>
      {QUEUE.map((item, i) => {
        const sent = step >= i + 3;
        return (
          <View key={item.title} style={[styles.row, styles.queueRow, { borderTopColor: p.border }]}>
            <Glyph icon={item.icon} tone={p.textMuted} />
            <View style={styles.flex}>
              <Text numberOfLines={1} style={[styles.rowTitle, { color: p.text }]}>{item.title}</Text>
              <Text numberOfLines={1} style={[styles.caption, { color: p.textMuted }]}>{item.detail}</Text>
            </View>
            {sent ? (
              <Pill icon={Check} label="Enviado" color={p.success} />
            ) : online && step === i + 2 ? (
              <Pill icon={CloudUpload} label="Enviando" color={p.accent} />
            ) : (
              <Pill icon={Clock} label="No aparelho" color={p.textMuted} />
            )}
          </View>
        );
      })}
    </SceneCard>
  );
}

const SALE = 186_400;
const COSTS = 142_700;

/** Resultado: venda, custos e o que sobrou do lote, com a barra dividindo os dois. */
export function ResultScene({ active }: { active: boolean }) {
  const p = usePalette();
  const step = useSceneStep(active, 3, 700);
  const money = (value: number) => `R$ ${formatNumber(Math.round(value))}`;
  return (
    <SceneCard>
      <View style={styles.row}>
        <Glyph icon={Wallet} tone={p.accent} />
        <View style={styles.flex}>
          <Text style={[styles.title, { color: p.text }]}>Resultado do lote</Text>
          <Text style={[styles.caption, { color: p.textMuted }]}>Origem 023 · vendido em 12/10</Text>
        </View>
      </View>
      <View style={styles.kv}>
        <Text style={[styles.label, { color: p.textMuted }]}>Venda</Text>
        <CountUp run={step >= 1} to={SALE} format={money} style={[styles.value, { color: p.text }]} />
      </View>
      <View style={styles.kv}>
        <Text style={[styles.label, { color: p.textMuted }]}>Custos do lote</Text>
        <CountUp run={step >= 2} to={COSTS} format={money} style={[styles.value, { color: p.text }]} />
      </View>
      <View style={[styles.track, { backgroundColor: p.fill }]}>
        <Grow show={step >= 2} fraction={COSTS / SALE} horizontal color={p.fillStrong} style={styles.trackFill} />
        <Grow show={step >= 3} fraction={1 - COSTS / SALE} horizontal color={p.accent} style={styles.trackFill} />
      </View>
      <View style={[styles.kv, styles.resultRow, { borderTopColor: p.border }]}>
        <Text style={[styles.rowTitle, { color: p.text }]}>Lucro</Text>
        <CountUp run={step >= 3} to={SALE - COSTS} format={(v) => `+ ${money(v)}`} style={[styles.big, { color: p.success }]} />
      </View>
    </SceneCard>
  );
}

/** Equipe: o funcionário registra do campo e o sócio aprova antes de entrar nas contas. */
export function TeamScene({ active }: { active: boolean }) {
  const p = usePalette();
  // 0: chega o registro; 1: toca em Aprovar; 2–3: aprovado e no rebanho.
  const step = useSceneStep(active, 3, 900);
  const approved = step >= 2;
  return (
    <SceneCard>
      <View style={styles.row}>
        <View style={[styles.avatar, { backgroundColor: p.accent }]}>
          <Text style={[styles.avatarText, { color: p.onAccent }]}>JP</Text>
        </View>
        <View style={styles.flex}>
          <Text style={[styles.rowTitle, { color: p.text }]}>
            João <Text style={{ fontFamily: font.regular, color: p.textMuted }}>registrou uma pesagem</Text>
          </Text>
          <Text style={[styles.caption, { color: p.textMuted }]}>Origem 022 · 39 cab. · 236 kg · do pasto</Text>
        </View>
      </View>
      {approved ? (
        <Reveal show style={[styles.approved, { backgroundColor: soft(p.success) }]}>
          <CircleCheckBig color={p.success} size={20} strokeWidth={2} />
          <View style={styles.flex}>
            <Text style={[styles.rowTitle, { color: p.success }]}>Aprovado por você</Text>
            <Text style={[styles.caption, { color: p.textMuted }]}>
              {step >= 3 ? 'Já conta no peso e no ganho do lote.' : 'Entrando no rebanho…'}
            </Text>
          </View>
        </Reveal>
      ) : (
        <View style={styles.actions}>
          <View style={[styles.action, { borderColor: p.border }]}>
            <Text style={[styles.actionText, { color: p.text }]}>Recusar</Text>
          </View>
          <View style={[styles.action, { backgroundColor: p.accent, borderColor: p.accent, transform: [{ scale: step === 1 ? 0.95 : 1 }] }]}>
            <UserCheck color={p.onAccent} size={16} strokeWidth={2.2} />
            <Text style={[styles.actionText, { color: p.onAccent }]}>Aprovar</Text>
          </View>
        </View>
      )}
    </SceneCard>
  );
}

const styles = StyleSheet.create({
  card: {
    width: '100%',
    maxWidth: 360,
    alignSelf: 'center',
    borderRadius: radius.xl,
    borderWidth: StyleSheet.hairlineWidth,
    padding: space.lg,
    gap: space.md,
  },
  flex: { flex: 1, minWidth: 0 },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  between: { justifyContent: 'space-between' },
  glyph: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  title: { fontFamily: font.semibold, fontSize: 16, lineHeight: 22 },
  rowTitle: { fontFamily: font.semibold, fontSize: 14, lineHeight: 20 },
  caption: { fontFamily: font.regular, fontSize: 13, lineHeight: 18 },
  big: { fontFamily: font.bold, fontSize: 26, lineHeight: 32, fontVariant: ['tabular-nums'] },
  label: { fontFamily: font.regular, fontSize: 14, lineHeight: 20 },
  value: { fontFamily: font.semibold, fontSize: 16, lineHeight: 22, fontVariant: ['tabular-nums'] },
  pill: { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 4 },
  pillText: { fontFamily: font.semibold, fontSize: 12, lineHeight: 16 },
  weightRow: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' },
  chart: { height: 72, flexDirection: 'row', alignItems: 'flex-end', gap: space.sm },
  barSlot: { flex: 1, height: '100%', justifyContent: 'flex-end' },
  bar: { width: '100%' },
  queueRow: { borderTopWidth: StyleSheet.hairlineWidth, paddingTop: space.md },
  kv: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  track: { height: 12, borderRadius: 6, flexDirection: 'row', overflow: 'hidden' },
  trackFill: { height: '100%', borderRadius: 0 },
  resultRow: { borderTopWidth: StyleSheet.hairlineWidth, paddingTop: space.md },
  avatar: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontFamily: font.bold, fontSize: 14 },
  actions: { flexDirection: 'row', gap: space.sm },
  action: {
    flex: 1,
    minHeight: 44,
    borderRadius: radius.md,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  actionText: { fontFamily: font.semibold, fontSize: 14 },
  approved: { flexDirection: 'row', alignItems: 'center', gap: space.md, borderRadius: radius.md, padding: space.md },
});
