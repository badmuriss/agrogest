import type { ReactNode, Ref } from 'react';
import { ScrollView, type ScrollViewInstance, type ScrollViewProps } from 'react-native';

export function KeyboardEnvironment({ children }: { children: ReactNode }) {
  return children;
}

interface FormViewportProps {
  children: ReactNode;
  footer?: ReactNode;
  scrollRef?: Ref<ScrollViewInstance>;
  contentContainerStyle: ScrollViewProps['contentContainerStyle'];
}

/** Na web o navegador cuida do teclado e do foco, sem carregar módulos nativos. */
export function FormViewport({ children, footer, scrollRef, contentContainerStyle }: FormViewportProps) {
  return (
    <>
      <ScrollView
        ref={scrollRef}
        style={{ flex: 1 }}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={contentContainerStyle}>
        {children}
      </ScrollView>
      {footer}
    </>
  );
}
