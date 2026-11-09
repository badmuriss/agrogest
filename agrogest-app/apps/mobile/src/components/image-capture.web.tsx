import { View } from 'react-native';
import { AppText } from './ui/text';
import { usePalette } from '@/theme';
import type { ImageCaptureProps } from './image-capture.types';

/** Persistent native file control also works with keyboard and browser automation. */
export function ImageCapture({ disabled, onImage, onError }: ImageCaptureProps) {
  const p = usePalette();
  return <View style={{ gap: 8 }}>
    <AppText variant="label">Escolher imagem do comprovante</AppText>
    <input aria-label="Escolher imagem do comprovante" type="file" accept="image/png,image/jpeg,image/webp" disabled={disabled} style={{ color: p.text, padding: 12, border: `1px solid ${p.border}`, borderRadius: 12, maxWidth: '100%' }} onChange={(event) => {
      const file = event.currentTarget.files?.[0]; event.currentTarget.value = '';
      if (!file) return;
      if (file.size > 8 * 1024 * 1024) { onError('Escolha uma imagem com até 8 MiB.'); return; }
      const reader = new FileReader();
      reader.onerror = () => onError('Não foi possível ler a imagem.');
      reader.onload = () => { const base64 = String(reader.result).split(',')[1]; if (base64) void onImage({ name: file.name, mime: file.type, base64 }); else onError('Imagem inválida.'); };
      reader.readAsDataURL(file);
    }} />
  </View>;
}
