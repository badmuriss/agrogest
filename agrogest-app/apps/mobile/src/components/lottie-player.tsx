import LottieView, { type AnimationObject } from 'lottie-react-native';
import { useEffect, useRef } from 'react';

export interface LottiePlayerProps {
  source: AnimationObject;
  width: number;
  height: number;
  playing: boolean;
  loop: boolean;
  onFailure: () => void;
}

/**
 * Player nativo: pausa ao sair da tela ou colocar o app em segundo plano. O quadro parado (miniaturas
 * e movimento reduzido) é o pôster SVG, desenhado sem o player.
 */
export function LottiePlayer({ source, width, height, playing, loop, onFailure }: LottiePlayerProps) {
  const player = useRef<LottieView>(null);
  const loaded = useRef(false);
  const completed = useRef(false);

  useEffect(() => {
    if (!loaded.current) return;
    if (playing && !completed.current) player.current?.resume();
    else player.current?.pause();
  }, [playing]);

  return (
    <LottieView
      ref={player}
      source={source}
      autoPlay={false}
      loop={loop}
      resizeMode="contain"
      style={{ width, height }}
      onAnimationLoaded={() => {
        loaded.current = true;
        if (playing) player.current?.play();
      }}
      onAnimationFinish={(cancelled) => {
        if (!cancelled) completed.current = true;
      }}
      onAnimationFailure={onFailure}
    />
  );
}
