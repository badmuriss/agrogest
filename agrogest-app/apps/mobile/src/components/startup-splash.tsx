import { reloadAppAsync } from 'expo';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { radius, space, usePalette } from '@/theme';

import { AnimatedSplash } from './splash';

type Stage = 'session' | 'fonts' | 'data';

const explanations: Record<Stage, string> = {
  session: 'Ainda não conseguimos recuperar sua sessão. Confira a conexão e tente abrir novamente.',
  fonts: 'Ainda não conseguimos carregar a interface. Confira a conexão e tente abrir novamente.',
  data: 'Ainda não conseguimos abrir os dados deste aparelho. Tente abrir novamente.',
};

/** A failure before navigation is ready must not leave the user behind an endless splash. */
export function StartupSplash({ ready, stage, failed = false, onDone }: {
  ready: boolean;
  stage: Stage;
  failed?: boolean;
  onDone: () => void;
}) {
  const p = usePalette();
  const [slowStage, setSlowStage] = useState<Stage | null>(null);
  const [reloading, setReloading] = useState(false);
  const [reloadFailed, setReloadFailed] = useState(false);

  useEffect(() => {
    if (ready) return;
    const timer = setTimeout(() => setSlowStage(stage), 20000);
    return () => clearTimeout(timer);
  }, [ready, stage]);

  if (ready || (!failed && slowStage !== stage)) return <AnimatedSplash ready={ready} onDone={onDone} />;

  const retry = async () => {
    setReloading(true);
    setReloadFailed(false);
    try { await reloadAppAsync('Retry startup'); }
    catch { setReloading(false); setReloadFailed(true); }
  };

  return (
    <View style={[StyleSheet.absoluteFill, styles.screen, { backgroundColor: p.background }]}>
      <View style={styles.content}>
        <Text accessibilityRole="header" style={[styles.title, { color: p.text }]}>
          {failed ? 'Não foi possível iniciar' : 'A abertura está demorando'}
        </Text>
        <Text accessibilityLiveRegion="polite" style={[styles.message, { color: p.textMuted }]}>
          {explanations[stage]}
        </Text>
        <Pressable accessibilityRole="button" disabled={reloading} onPress={retry}
          style={({ pressed }) => [styles.button, { backgroundColor: p.accent, opacity: pressed || reloading ? 0.7 : 1 }]}>
          <Text style={[styles.buttonText, { color: p.onAccent }]}>{reloading ? 'Reabrindo…' : 'Tentar novamente'}</Text>
        </Pressable>
        <Text style={[styles.help, { color: p.textMuted }]}>
          {reloadFailed ? 'Feche o AgroGest e abra o link novamente.' : 'Tentar novamente não apaga seus registros.'}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { zIndex: 20, alignItems: 'center', justifyContent: 'center', padding: space.xl },
  content: { width: '100%', maxWidth: 420, gap: space.lg },
  title: { fontSize: 24, lineHeight: 30, fontWeight: '700' },
  message: { fontSize: 16, lineHeight: 24 },
  help: { fontSize: 14, lineHeight: 21 },
  button: { minHeight: 48, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center', padding: space.md },
  buttonText: { fontSize: 16, fontWeight: '600' },
});
