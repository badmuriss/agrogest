import { useRef } from 'react';
import { View } from 'react-native';
import { Button } from './ui/controls';
import type { ImageCaptureProps } from './image-capture.types';

/** Persistent native file control also works with keyboard and browser automation. */
export function ImageCapture({ disabled, title = 'Escolher comprovante', onImage, onError }: ImageCaptureProps) {
  const input = useRef<HTMLInputElement>(null);
  return <View>
    <Button title={title} icon="camera-outline" variant="secondary" disabled={disabled} onPress={() => input.current?.click()} />
    <input ref={input} aria-label="Arquivo do comprovante" aria-hidden="true" tabIndex={-1} type="file" accept="image/png,image/jpeg,image/webp" disabled={disabled} style={{ display: 'none' }} onChange={(event) => {
      const file = event.currentTarget.files?.[0]; event.currentTarget.value = '';
      if (!file) return;
      if (file.size > 8 * 1024 * 1024) { onError('Escolha uma imagem com até 8 MiB.'); return; }
      const reader = new FileReader();
      reader.onerror = () => onError('Não foi possível ler a imagem.');
      reader.onload = () => { const base64 = String(reader.result).split(',')[1]; if (base64) void onImage({ name: file.name, mime: file.type || 'image/jpeg', base64 }).catch(() => onError('Não foi possível abrir este comprovante. Tente novamente.')); else onError('Imagem inválida.'); };
      reader.readAsDataURL(file);
    }} />
  </View>;
}
