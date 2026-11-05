export async function copyHtmlToClipboard(html: string): Promise<void> {
  const blob = new Blob([html], { type: 'text/html' });
  const textBlob = new Blob([html.replace(/<[^>]+>/g, '')], { type: 'text/plain' });

  const item = new ClipboardItem({
    'text/html': blob,
    'text/plain': textBlob,
  });

  await navigator.clipboard.write([item]);
}

export function downloadHtmlFile(html: string, filename: string): void {
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
