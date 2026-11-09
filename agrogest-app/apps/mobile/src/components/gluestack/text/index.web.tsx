import React, { type CSSProperties } from 'react';
import type { VariantProps } from '@gluestack-ui/utils/nativewind-utils';
import { gluestackFont } from '@/theme';
import { textStyle } from './styles';
import { webTextProps, type NativeTextProps } from '../web-props';

type ITextProps = Omit<React.ComponentProps<'span'>, 'style'> & VariantProps<typeof textStyle> & NativeTextProps;

const Text = React.forwardRef<React.ComponentRef<'span'>, ITextProps>(
  function Text(
    {
      className,
      isTruncated,
      bold,
      underline,
      strikeThrough,
      size = 'md',
      sub,
      italic,
      highlight,
      ...props
    }: { className?: string } & ITextProps,
    ref
  ) {
    const { truncate, dom } = webTextProps(props);
    return (
      <span
        className={textStyle({
          isTruncated: (isTruncated || truncate) as boolean,
          bold: bold as boolean,
          underline: underline as boolean,
          strikeThrough: strikeThrough as boolean,
          size,
          sub: sub as boolean,
          italic: italic as boolean,
          highlight: highlight as boolean,
          class: className,
        })}
        {...dom}
        style={{ fontFamily: gluestackFont(className, bold as boolean), ...(dom as { style?: CSSProperties }).style }}
        ref={ref}
      />
    );
  }
);

Text.displayName = 'Text';

export { Text };
