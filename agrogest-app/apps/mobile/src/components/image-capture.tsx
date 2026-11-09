import * as ImagePicker from 'expo-image-picker';
import { View } from 'react-native';
import { Button } from './ui/controls';
import type { ImageCaptureProps } from './image-capture.types';

export function ImageCapture({ disabled, onImage, onError }: ImageCaptureProps) {
  const pick = async (camera: boolean) => {
    try {
      if (camera && !(await ImagePicker.requestCameraPermissionsAsync()).granted) { onError('Autorize a câmera ou escolha uma imagem.'); return; }
      const options: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], base64: true, quality: 1, allowsEditing: false };
      const result = camera ? await ImagePicker.launchCameraAsync(options) : await ImagePicker.launchImageLibraryAsync(options);
      if (!result.canceled && result.assets[0]) {
        const asset = result.assets[0];
        if (!asset.base64) { onError('Não foi possível ler os bytes da imagem.'); return; }
        await onImage({ name: asset.fileName ?? 'comprovante.jpg', mime: asset.mimeType ?? 'image/jpeg', base64: asset.base64 });
      }
    } catch { onError('Não foi possível abrir esta imagem. Escolha PNG ou JPEG.'); }
  };
  return <View style={{ gap: 8 }}><Button title="Escolher imagem" icon="image-outline" disabled={disabled} onPress={() => void pick(false)} /><Button title="Fotografar comprovante" icon="camera-outline" variant="secondary" disabled={disabled} onPress={() => void pick(true)} /></View>;
}
