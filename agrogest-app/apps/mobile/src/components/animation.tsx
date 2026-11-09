import { Image } from 'expo-image';
import { useIsFocused } from 'expo-router';
import { useCallback, useContext, useState } from 'react';
import { View } from 'react-native';

import { usePalette } from '@/theme';

import { animationPoster, animationSource, isIllustration, type AnimationName } from './animation-source';
import { LottiePlayer } from './lottie-player';
import { MotionEnvironmentContext, useMotion } from './ui/motion';

export type { AnimationName, IllustrationName } from './animation-source';

/**
 * Cenas locais (scripts/scenes.mjs): o próprio app em miniatura. Uma reprodução curta por montagem;
 * loops só para espera real. Miniaturas e movimento reduzido usam o pôster SVG do quadro final, sem
 * montar o player. Elemento decorativo: não recebe toque nem repete os textos para leitores de tela.
 */
export function AppLottie({
  name,
  size = 120,
  loop = false,
  animated = true,
}: {
  name: AnimationName;
  size?: number;
  loop?: boolean;
  animated?: boolean;
}) {
  const p = usePalette();
  const motion = useMotion();
  const focused = useIsFocused();
  const { active } = useContext(MotionEnvironmentContext);
  const still = !animated || !motion;
  const height = isIllustration(name) ? size * .75 : size;
  const poster = animationPoster(name, p);

  return (
    <View
      pointerEvents="none"
      accessible={false}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{ width: size, height }}>
      {still ? (
        <Image source={{ uri: poster }} contentFit="contain" style={{ width: size, height }} />
      ) : (
        <AnimatedScene
          key={`${name}:${p.scheme}`}
          name={name}
          size={size}
          height={height}
          playing={focused && active}
          loop={loop}
          poster={poster}
        />
      )}
    </View>
  );
}

function AnimatedScene({
  name, size, height, playing, loop, poster,
}: {
  name: AnimationName;
  size: number;
  height: number;
  playing: boolean;
  loop: boolean;
  poster: string;
}) {
  const p = usePalette();
  const [failed, setFailed] = useState(false);
  const onFailure = useCallback(() => setFailed(true), []);

  if (failed) return <Image source={{ uri: poster }} contentFit="contain" style={{ width: size, height }} />;

  return (
    <LottiePlayer
      source={animationSource(name, p)}
      width={size}
      height={height}
      playing={playing}
      loop={loop}
      onFailure={onFailure}
    />
  );
}
