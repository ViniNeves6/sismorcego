// react-native-share na web: compartilha o arquivo (iPhone: "Salvar em Arquivos")
// ou, se o navegador não suportar, baixa o arquivo.
import { fileBytes } from './fs';
export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}
const Share = {
  async open({ url, type = 'application/pdf', filename, title }) {
    const bytes = fileBytes(url);
    if (!bytes) throw new Error('Arquivo indisponível para compartilhar.');
    const name = String(filename || String(url).split('/').pop() || 'arquivo').replace(/(\.pdf)?$/i, '.pdf');
    const file = new File([bytes], name, { type });
    if (navigator.canShare?.({ files: [file] })) {
      try { await navigator.share({ files: [file], title }); return { success: true }; }
      catch (error) { if (error?.name === 'AbortError') return { success: false, dismissedAction: true }; }
    }
    downloadBlob(file, name);
    return { success: true };
  },
};
export default Share;
