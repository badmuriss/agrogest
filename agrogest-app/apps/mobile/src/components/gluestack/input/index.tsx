'use client';
import React from 'react';
import { createInput } from '@gluestack-ui/core/input/creator';
import { View, Pressable, TextInput } from 'react-native';
import { tva , withStyleContext } from '@gluestack-ui/utils/nativewind-utils';
import { styled } from 'nativewind';
import type { VariantProps } from '@gluestack-ui/utils/nativewind-utils';
import { UIIcon } from '@gluestack-ui/core/icon/creator';

const SCOPE = 'INPUT';

const StyledUIIcon = styled(UIIcon, { className: "style" });

const UIInput = createInput({
  Root: withStyleContext(View, SCOPE),
  Icon: StyledUIIcon,
  Slot: Pressable,
  Input: TextInput,
});


const inputStyle = tva({
  base: 'min-h-[52px] w-full flex-row items-center rounded-xl border-[1.5px] border-transparent bg-secondary overflow-hidden data-[focus=true]:outline-none data-[focus=true]:border-ring data-[focus=true]:web:ring-[3px] data-[focus=true]:web:ring-ring/30 data-[invalid=true]:border-destructive data-[invalid=true]:web:ring-destructive/20 data-[disabled=true]:pointer-events-none data-[disabled=true]:cursor-not-allowed data-[disabled=true]:opacity-50 px-4 gap-2',
});

const inputIconStyle = tva({
  base: 'justify-center items-center text-muted-foreground fill-none h-4 w-4',
});

const inputSlotStyle = tva({
  base: 'justify-center items-center web:disabled:cursor-not-allowed',
});

const inputFieldStyle = tva({
  base: 'flex-1 min-w-0 text-foreground text-base py-3 h-full placeholder:text-faint web:outline-none ios:leading-[0px] web:cursor-text web:data-[disabled=true]:cursor-not-allowed',
});

type IInputProps = React.ComponentProps<typeof UIInput> &
  VariantProps<typeof inputStyle> & { className?: string };
const Input = React.forwardRef<React.ComponentRef<typeof UIInput>, IInputProps>(
  function Input({ className, ...props }, ref) {
    return (
      <UIInput
        ref={ref}
        {...props}
        className={inputStyle({ class: className })}
        context={{}}
      />
    );
  }
);

type IInputIconProps = React.ComponentProps<typeof UIInput.Icon> &
  VariantProps<typeof inputIconStyle> & {
    className?: string;
    height?: number;
    width?: number;
  };

const InputIcon = React.forwardRef<
  React.ComponentRef<typeof UIInput.Icon>,
  IInputIconProps
>(function InputIcon({ className, ...props }, ref) {
  return (
    <UIInput.Icon
      ref={ref}
      {...props}
      className={inputIconStyle({ class: className })}
    />
  );
});

type IInputSlotProps = React.ComponentProps<typeof UIInput.Slot> &
  VariantProps<typeof inputSlotStyle> & { className?: string };

const InputSlot = React.forwardRef<
  React.ComponentRef<typeof UIInput.Slot>,
  IInputSlotProps
>(function InputSlot({ className, ...props }, ref) {
  return (
    <UIInput.Slot
      ref={ref}
      {...props}
      className={inputSlotStyle({
        class: className,
      })}
    />
  );
});

type IInputFieldProps = React.ComponentProps<typeof UIInput.Input> &
  VariantProps<typeof inputFieldStyle> & { className?: string };

const InputField = React.forwardRef<
  React.ComponentRef<typeof UIInput.Input>,
  IInputFieldProps
>(function InputField({ className, ...props }, ref) {
  return (
    <UIInput.Input
      ref={ref}
      {...props}
      className={inputFieldStyle({
        class: className,
      })}
    />
  );
});

Input.displayName = 'Input';
InputIcon.displayName = 'InputIcon';
InputSlot.displayName = 'InputSlot';
InputField.displayName = 'InputField';

export { Input, InputField, InputIcon, InputSlot };
