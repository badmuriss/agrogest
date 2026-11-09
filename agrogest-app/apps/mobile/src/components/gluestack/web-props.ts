import type { CSSProperties } from 'react';

/** Props de React Native que as telas passam ao Text/Heading e que o elemento HTML não conhece. */
export type NativeTextProps = {
  numberOfLines?: number;
  accessibilityRole?: string;
  accessibilityLabel?: string;
  style?: CSSProperties;
};

/**
 * Traduz as props de React Native para o equivalente na web (Text e Heading viram `<span>`/`<h*>`):
 * `numberOfLines` vira corte de linhas por CSS, `accessibilityRole` vira `role` e
 * `accessibilityLabel` vira `aria-label`. Sem isso, o React avisa de props desconhecidas no DOM.
 */
export function webTextProps<P extends NativeTextProps>({ numberOfLines, accessibilityRole, accessibilityLabel, style, ...rest }: P) {
  const clamp: CSSProperties | undefined =
    numberOfLines && numberOfLines > 1
      ? { display: '-webkit-box', WebkitLineClamp: numberOfLines, WebkitBoxOrient: 'vertical', overflow: 'hidden' }
      : undefined;
  return {
    truncate: numberOfLines === 1,
    dom: {
      ...rest,
      ...(accessibilityRole ? { role: accessibilityRole === 'header' ? 'heading' : accessibilityRole } : {}),
      ...(accessibilityLabel ? { 'aria-label': accessibilityLabel } : {}),
      ...(clamp || style ? { style: { ...clamp, ...style } } : {}),
    },
  };
}
