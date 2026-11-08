// react-native-encrypted-storage na web: localStorage do navegador.
const key = k => `sismorcego:secure:${k}`;
const EncryptedStorage = {
  getItem: async k => localStorage.getItem(key(k)),
  setItem: async (k, v) => { localStorage.setItem(key(k), v); },
  removeItem: async k => { localStorage.removeItem(key(k)); },
  clear: async () => { Object.keys(localStorage).filter(k => k.startsWith('sismorcego:secure:')).forEach(k => localStorage.removeItem(k)); },
};
export default EncryptedStorage;
