import React from 'react';
import { skeletonStyle } from './styles';

import type { VariantProps } from '@gluestack-ui/utils/nativewind-utils';

type ISkeletonProps = React.ComponentPropsWithoutRef<'div'> &
  VariantProps<typeof skeletonStyle> & {
    startColor?: string;
    isLoaded?: boolean;
  };

const Skeleton = React.forwardRef<HTMLDivElement, ISkeletonProps>(
  function Skeleton(
    {
      className,
      variant = 'rounded',
      children,
      speed = 4,
      startColor = 'bg-muted-foreground/20',
      isLoaded = false,
      ...props
    },
    ref
  ) {
    if (!isLoaded) {
      return (
        <div
          ref={ref}
          className={`animate-pulse ${startColor} ${skeletonStyle({
            variant,
            speed,
            class: className,
          })}`}
          {...props}
        />
      );
    } else {
      return children;
    }
  }
);

Skeleton.displayName = 'Skeleton';

export { Skeleton };
