import { StyleSheet, View } from 'react-native';

import { radius, space, usePalette } from '@/theme';

import { AppLottie, type IllustrationName } from './animation';
import { AppText } from './ui/text';

/** Introdução compacta: uma cena por formulário, fora da área de digitação. */
export function IllustrationHeader({
  name, title, description,
}: {
  name: IllustrationName;
  title: string;
  description: string;
}) {
  const p = usePalette();
  return (
    <View style={[styles.header, { backgroundColor: p.accentSoft, borderColor: p.scheme === 'dark' ? p.border : p.accentSoft }]}>
      <AppLottie name={name} size={112} />
      <View style={styles.text}>
        <AppText variant="bodyStrong" accessibilityRole="header">{title}</AppText>
        <AppText variant="caption" tone="muted">{description}</AppText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: space.sm, borderRadius: radius.xl, borderWidth: StyleSheet.hairlineWidth, padding: space.md },
  text: { flex: 1, gap: space.xs },
});
