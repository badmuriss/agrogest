import React from 'react';
import type { VariantProps } from '@gluestack-ui/utils/nativewind-utils';
import { hstackStyle } from './styles';
import { webTextProps, type NativeTextProps } from '../web-props';

type IHStackProps = React.ComponentPropsWithoutRef<'div'> &
  VariantProps<typeof hstackStyle> &
  Pick<NativeTextProps, 'accessibilityRole' | 'accessibilityLabel'>;

const HStack = React.forwardRef<React.ComponentRef<'div'>, IHStackProps>(
  function HStack({ className, space, reversed, ...props }, ref) {
    return (
      <div
        className={hstackStyle({
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

HStack.displayName = 'HStack';

export { HStack };
