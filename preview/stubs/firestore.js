import { duvidas, nuvemRegistros } from './demoData';

let faq = [...duvidas];

const snap = (items) => ({
  docs: items.map((d) => ({ id: d.id, data: () => d })),
  forEach(fn) {
    this.docs.forEach(fn);
  },
});

const rows = (ref) => (ref?.path?.[0] === 'duvidas' ? faq : nuvemRegistros);

export const collection = (_db, ...path) => ({ path });
export const query = (ref) => ref;
export const orderBy = () => ({});
export const limit = () => ({});
export const serverTimestamp = () => ({ seconds: Math.floor(Date.now() / 1000) });
export const getDocs = async (ref) => snap(rows(ref));
export const getDocsFromServer = async (ref) => snap(rows(ref));
export const addDoc = async (_ref, data) => {
  faq = [{ id: 'n' + Date.now(), ...data, createdAt: { seconds: Math.floor(Date.now() / 1000) } }, ...faq];
};
