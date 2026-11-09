import React, { forwardRef } from 'react';
import type { VariantProps } from '@gluestack-ui/utils/nativewind-utils';
import { View } from 'react-native';
import { skeletonStyle } from './styles';

type ISkeletonProps = React.ComponentProps<typeof View> &
  VariantProps<typeof skeletonStyle> & {
    isLoaded?: boolean;
    startColor?: string;
    speed?: number | string;
  };

const Skeleton = forwardRef<React.ComponentRef<typeof View>, ISkeletonProps>(
  function Skeleton(
    {
      className,
      variant,
      children,
      startColor = 'bg-accent',
      isLoaded = false,
      speed = 4,
      ...props
    },
    ref
  ) {
    if (!isLoaded) {
      return (
        <View
          className={`animate-pulse ${startColor} ${skeletonStyle({
            variant,
            speed: speed as 1 | 2 | 3 | 4,
            class: className,
          })}`}
          {...props}
          ref={ref}
        />
      );
    } else {
      return children;
    }
  }
);

Skeleton.displayName = 'Skeleton';

export { Skeleton };
