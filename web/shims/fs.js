// react-native-fs na web: arquivos temporários em memória (PDF gerado, etc.).
// Fotos não passam por aqui: na web elas ficam como data: URL no próprio registro.
const files = new Map();
const clean = p => String(p || '').replace(/^file:\/\//, '');
const toBase64 = text => btoa(unescape(encodeURIComponent(text)));
const fromBase64 = b64 => decodeURIComponent(escape(atob(b64)));
export const fileBytes = path => {
  const b64 = files.get(clean(path));
  if (b64 == null) return null;
  const bin = atob(b64); const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
};
const RNFS = {
  DocumentDirectoryPath: '/documents', CachesDirectoryPath: '/caches', TemporaryDirectoryPath: '/tmp',
  exists: async p => files.has(clean(p)) || !/\.[a-z0-9]+$/i.test(clean(p)),
  mkdir: async () => {},
  writeFile: async (p, data, enc) => { files.set(clean(p), enc === 'base64' ? data : toBase64(data)); },
  readFile: async (p, enc) => {
    const path = clean(p);
    if (path.startsWith('data:')) return enc === 'base64' ? path.split(',')[1] : fromBase64(path.split(',')[1]);
    if (!files.has(path)) throw new Error(`Arquivo não encontrado: ${path}`);
    return enc === 'base64' ? files.get(path) : fromBase64(files.get(path));
  },
  copyFile: async (from, to) => { files.set(clean(to), await RNFS.readFile(from, 'base64')); },
  moveFile: async (from, to) => { await RNFS.copyFile(from, to); files.delete(clean(from)); },
  unlink: async p => { files.delete(clean(p)); },
  stat: async p => ({ size: (files.get(clean(p)) || '').length * 0.75, isFile: () => true }),
};
export default RNFS;
