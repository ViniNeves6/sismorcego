// Autenticação de mentirinha: qualquer e-mail/senha entra. Nada vai ao Firebase.
import React, { createContext, use, useCallback, useEffect, useMemo, useState } from 'react';

const AuthContext = createContext(null);
const KEY = 'sismorcego:demoUser';

const demoUser = (email = 'agente@sismorcego.demo') => ({
  uid: 'demo',
  email,
  displayName: 'Agente Demonstração',
  photoURL: null,
});

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const forced = new URLSearchParams(location.search).get('logged') === '1';
    const saved = localStorage.getItem(KEY);
    const t = setTimeout(() => {
      if (forced || saved) setUser(demoUser(saved || undefined));
      setLoading(false);
    }, 900);
    return () => clearTimeout(t);
  }, []);

  const signIn = useCallback(async (email) => {
    await new Promise((r) => setTimeout(r, 600));
    localStorage.setItem(KEY, email);
    setUser(demoUser(email));
  }, []);
  const signUp = useCallback(async () => new Promise((r) => setTimeout(r, 600)), []);
  const resetPassword = useCallback(async () => new Promise((r) => setTimeout(r, 600)), []);
  const signOut = useCallback(async () => {
    localStorage.removeItem(KEY);
    setUser(null);
  }, []);
  const updateUser = useCallback(async ({ nome, email }) => {
    await new Promise((r) => setTimeout(r, 500));
    setUser((u) => ({ ...u, displayName: nome || u.displayName, email: email || u.email }));
  }, []);

  const value = useMemo(
    () => ({ user, loading, signIn, signUp, resetPassword, signOut, updateUser }),
    [user, loading, signIn, signUp, resetPassword, signOut, updateUser]
  );
  return <AuthContext value={value}>{children}</AuthContext>;
};

export default function useAuth() {
  return use(AuthContext);
}
