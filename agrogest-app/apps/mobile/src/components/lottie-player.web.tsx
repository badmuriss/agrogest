import { DotLottieReact, setWasmUrl, type DotLottieReactProps } from '@lottiefiles/dotlottie-react';
import { useEffect, useRef, useState } from 'react';

import type { LottiePlayerProps } from './lottie-player';

// The library default downloads WASM from jsDelivr. Keep application assets local.
setWasmUrl('/dotlottie-player.wasm');

type Player = NonNullable<Parameters<NonNullable<DotLottieReactProps['dotLottieRefCallback']>>[0]>;

const RENDER_CONFIG = { freezeOnOffscreen: true, devicePixelRatio: 2 };

/** O wrapper da biblioteca ignora progress, style e colorFilters na web. */
export function LottiePlayer({ source, width, height, playing, loop, onFailure }: LottiePlayerProps) {
  const [player, setPlayer] = useState<Player | null>(null);
  const completed = useRef(false);

  useEffect(() => {
    if (!player) return;
    const control = () => {
      if (!player.isLoaded) return;
      if (playing && !completed.current) {
        player.play();
      } else {
        player.pause();
      }
    };
    const finish = () => { completed.current = true; };
    player.addEventListener('load', control);
    player.addEventListener('complete', finish);
    player.addEventListener('loadError', onFailure);
    player.addEventListener('renderError', onFailure);
    control();
    return () => {
      player.removeEventListener('load', control);
      player.removeEventListener('complete', finish);
      player.removeEventListener('loadError', onFailure);
      player.removeEventListener('renderError', onFailure);
    };
  }, [player, playing, onFailure]);

  return (
    <DotLottieReact
      data={source as unknown as Record<string, unknown>}
      dotLottieRefCallback={setPlayer}
      autoplay={false}
      loop={loop}
      useFrameInterpolation={false}
      renderConfig={RENDER_CONFIG}
      style={{ width, height, display: 'block', pointerEvents: 'none' }}
      aria-hidden="true"
    />
  );
}
