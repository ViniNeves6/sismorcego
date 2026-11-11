// react-native-keychain na web: localStorage (o navegador não tem cofre de chaves).
const key = service => `sismorcego:keychain:${service || 'default'}`;
export const getGenericPassword = async ({ service } = {}) => {
  try { const raw = localStorage.getItem(key(service)); return raw ? JSON.parse(raw) : false; } catch { return false; }
};
export const setGenericPassword = async (username, password, { service } = {}) => {
  localStorage.setItem(key(service), JSON.stringify({ username, password })); return true;
};
export const resetGenericPassword = async ({ service } = {}) => { localStorage.removeItem(key(service)); return true; };
export default { getGenericPassword, setGenericPassword, resetGenericPassword };
