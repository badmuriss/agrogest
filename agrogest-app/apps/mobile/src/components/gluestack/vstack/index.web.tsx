import React from 'react';
import type { VariantProps } from '@gluestack-ui/utils/nativewind-utils';

import { vstackStyle } from './styles';
import { webTextProps, type NativeTextProps } from '../web-props';

type IVStackProps = React.ComponentProps<'div'> &
  VariantProps<typeof vstackStyle> &
  Pick<NativeTextProps, 'accessibilityRole' | 'accessibilityLabel'>;

const VStack = React.forwardRef<React.ComponentRef<'div'>, IVStackProps>(
  function VStack({ className, space, reversed, ...props }, ref) {
    return (
      <div
        className={vstackStyle({
          space,
          reversed: reversed as boolean,
          class: className,
        })}
        {...webTextProps(props).dom}
        ref={ref}
      />
    );
  }
);

VStack.displayName = 'VStack';

export { VStack };
