const store = {
  getItem: async (k) => localStorage.getItem('sismorcego:' + k),
  setItem: async (k, v) => localStorage.setItem('sismorcego:' + k, v),
  removeItem: async (k) => localStorage.removeItem('sismorcego:' + k),
};
export default store;
