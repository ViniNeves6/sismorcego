import { doc, getDoc, setDoc } from 'firebase/firestore';

export async function ensureAccountRole(database, uid, email) {
  if (!database || !uid) return 'acs';
  const ref = doc(database,'usuarios',uid);
  const existing = await getDoc(ref);
  if (existing.exists()) return existing.data()?.role || 'acs';
  await setDoc(ref,{ email:email || null, role:'acs' });
  return 'acs';
}
