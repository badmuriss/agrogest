'use client';
import { createAlert } from '@gluestack-ui/core/alert/creator';
import { UIIcon } from '@gluestack-ui/core/icon/creator';
import type { VariantProps } from '@gluestack-ui/utils/nativewind-utils';
import { tva, useStyleContext, withStyleContext } from '@gluestack-ui/utils/nativewind-utils';
import { styled } from 'nativewind';
import React from 'react';
import { Text, View } from 'react-native';

const SCOPE = 'ALERT';

const alertStyle = tva({
  base: 'rounded-2xl border p-3 flex-row gap-3 items-start',
  variants: {
    variant: {
      default: 'bg-secondary border-transparent',
      destructive: 'bg-destructive/10 border-transparent',
    },
  },
});

const alertTextStyle = tva({
  base: 'text-sm flex-1',
  parentVariants: {
    variant: {
      default: 'text-muted-foreground',
      destructive: 'text-destructive',
    },
  },
});

const alertIconStyle = tva({
  base: 'fill-none w-4 h-4 mt-0.5',
  parentVariants: {
    variant: {
      default: 'text-muted-foreground',
      destructive: 'text-destructive',
    },
  },
});

const StyledUIIcon = styled(UIIcon, {
  className: "style",
});

export const UIAlert = createAlert({
  Root: withStyleContext(View, SCOPE),
  Text: Text,
  Icon: StyledUIIcon,
});

type IAlertProps = Omit<
  React.ComponentPropsWithoutRef<typeof UIAlert>,
  'context'
> &
  VariantProps<typeof alertStyle>;

const Alert = React.forwardRef<React.ComponentRef<typeof UIAlert>, IAlertProps>(
  function Alert({ className, variant = 'default', ...props }, ref) {
    return (
      <UIAlert
        className={alertStyle({ variant, class: className })}
        context={{ variant }}
        ref={ref}
        {...props}
      />
    );
  }
);

type IAlertTextProps = React.ComponentPropsWithoutRef<typeof UIAlert.Text> &
  VariantProps<typeof alertTextStyle>;

const AlertText = React.forwardRef<
  React.ComponentRef<typeof UIAlert.Text>,
  IAlertTextProps
>(function AlertText({ className, ...props }, ref) {
  const { variant: parentVariant } = useStyleContext(SCOPE);
  return (
    <UIAlert.Text
      className={alertTextStyle({
        class: className,
        parentVariants: {
          variant: parentVariant,
        },
      })}
      {...props}
      ref={ref}
    />
  );
});

type IAlertIconProps = React.ComponentPropsWithoutRef<typeof UIAlert.Icon> &
  VariantProps<typeof alertIconStyle> & {
    height?: number;
    width?: number;
  };

const AlertIcon = React.forwardRef<
  React.ComponentRef<typeof UIAlert.Icon>,
  IAlertIconProps
>(function AlertIcon({ className, ...props }, ref) {
  const { variant: parentVariant } = useStyleContext(SCOPE);
  return (
    <UIAlert.Icon
      className={alertIconStyle({
        parentVariants: {
          variant: parentVariant,
        },
        class: className,
      })}
      {...props}
      ref={ref}
    />
  );
});

Alert.displayName = 'Alert';
AlertText.displayName = 'AlertText';
AlertIcon.displayName = 'AlertIcon';

export { Alert, AlertIcon, AlertText };
