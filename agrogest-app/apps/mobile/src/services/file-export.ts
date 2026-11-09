import { File, Paths } from 'expo-file-system';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';

/**
 * Grava o arquivo no cache do aparelho e abre o compartilhamento (WhatsApp, e-mail, Drive...).
 * No web, o mesmo nome vira um download (`file-export.web.ts`).
 */
export async function shareTextFile(fileName: string, content: string, mimeType: string): Promise<void> {
  const file = new File(Paths.cache, fileName);
  if (file.exists) file.delete();
  file.create();
  await file.write(content);
  if (!(await Sharing.isAvailableAsync())) throw new Error('Este aparelho não permite compartilhar arquivos.');
  await Sharing.shareAsync(file.uri, { mimeType, dialogTitle: fileName });
}

/** Gera o PDF do relatório em HTML e abre o compartilhamento. */
export async function sharePdf(fileName: string, html: string): Promise<void> {
  const { uri } = await Print.printToFileAsync({ html });
  const target = new File(Paths.cache, fileName);
  if (target.exists) target.delete();
  new File(uri).move(target);
  if (!(await Sharing.isAvailableAsync())) throw new Error('Este aparelho não permite compartilhar arquivos.');
  await Sharing.shareAsync(target.uri, { mimeType: 'application/pdf', UTI: 'com.adobe.pdf', dialogTitle: fileName });
}

/** Conteúdo de um arquivo escolhido no seletor de documentos. */
export async function readPickedFile(uri: string): Promise<string> {
  return new File(uri).text();
}
