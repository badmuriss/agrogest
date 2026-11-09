/** No navegador, exportar baixa o arquivo; o PDF abre a impressão (salvar como PDF). */
export async function shareTextFile(fileName: string, content: string, mimeType: string): Promise<void> {
  const url = URL.createObjectURL(new Blob([content], { type: `${mimeType};charset=utf-8` }));
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function sharePdf(_fileName: string, html: string): Promise<void> {
  const frame = document.createElement('iframe');
  frame.style.display = 'none';
  document.body.appendChild(frame);
  frame.contentDocument?.open();
  frame.contentDocument?.write(html);
  frame.contentDocument?.close();
  frame.contentWindow?.focus();
  frame.contentWindow?.print();
  setTimeout(() => frame.remove(), 1000);
}

export async function readPickedFile(uri: string): Promise<string> {
  return (await fetch(uri)).text();
}
