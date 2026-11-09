import { tva } from '@gluestack-ui/utils/nativewind-utils';

export const skeletonStyle = tva({
  base: 'w-full h-full rounded-sm',
  variants: {
    variant: {
      sharp: 'rounded-none',
      circular: 'rounded-full',
      rounded: 'rounded-md',
    },
    speed: {
      1: 'duration-750',
      2: 'duration-100',
      3: 'duration-1500',
      4: 'duration-2000',
    },
  },
});
