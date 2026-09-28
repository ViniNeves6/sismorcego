// src/hooks/useAuth.js
import React, { createContext, useContext, useEffect, useState } from "react";

// Dependências do Firebase (mantidas para quando o modo de teste for desativado)
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  signOut as firebaseSignOut,
  updateProfile,
  updateEmail,
  updatePassword,
} from "firebase/auth";
import { doc, getDoc, setDoc } from "firebase/firestore";

import { auth, db } from "../services/firebase";
import logger from "../utils/logger";

// Busca o papel do usuário (usuarios/{uid}.role); cria o doc como "acs" se não existir.
const ensureUserRole = async (uid, email) => {
  if (!db || !uid) return "acs";
  const ref = doc(db, "usuarios", uid);
  const snap = await getDoc(ref);
  if (snap.exists()) return snap.data()?.role || "acs";
  await setDoc(ref, { email: email || null, role: "acs" }, { merge: true });
  return "acs";
};

/**
 * 🔧 MODO DE TESTE (sem login, cadastro e recuperação)
 * - Quando TRUE, ignora qualquer integração real com Firebase Auth
 * - Retorna { user: null, loading: false } e mantém a API do contexto disponível
 * - Para reativar autenticação real depois, basta mudar para false
 */
const AUTH_TEST_MODE = false;

const AuthContext = createContext({
  user: null,
  role: null,
  loading: false,
  signIn: async () => {},
  signUp: async () => {},
  resetPassword: async () => {},
  signOut: async () => {},
  updateUser: async () => {},
});

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);      // usuário atual (ou null)
  const [role, setRole] = useState(null);       // "acs" | "coordenador" | null
  const [loading, setLoading] = useState(true); // estado de carregamento inicial

  useEffect(() => {
    // Se estamos em modo de teste, não conectar no Firebase
    if (AUTH_TEST_MODE) {
      setUser(null);
      setLoading(false);
      return;
    }

    // Se por algum motivo 'auth' não estiver configurado, não quebra a aplicação
    if (!auth) {
      logger.warn("useAuth: Firebase auth nao configurado");
      setUser(null);
      setLoading(false);
      return;
    }

    // Modo normal (autenticação real)
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      // ✅ Login persistente funciona para todos os usuários,
      // independente da verificação de email
      setUser(currentUser || null);
      if (currentUser) {
        try {
          setRole(await ensureUserRole(currentUser.uid, currentUser.email));
        } catch (e) {
          logger.warn("useAuth: falha ao carregar papel do usuário", e);
          setRole("acs");
        }
      } else {
        setRole(null);
      }
      setLoading(false);
    });

    return () => {
      try {
        unsubscribe && unsubscribe();
      } catch {
        // evita crash se unsubscribe for inválido
      }
    };
  }, []);

  // Helpers para evitar repetição
  const ensureAuthEnabled = () => {
    if (AUTH_TEST_MODE) {
      const err = new Error("Autenticação desativada para testes.");
      err.code = "auth/test-mode-disabled";
      throw err;
    }
    if (!auth) {
      const err = new Error("Firebase Auth não configurado.");
      err.code = "auth/not-configured";
      throw err;
    }
  };

  // Login. O papel (ACS/coordenador) é decidido pelo Firestore, não por
  // uma escolha na tela — quem for coordenador já ganha as telas extras
  // automaticamente (ver AppTabs.js), sem precisar de nenhum passo a mais aqui.
  const signIn = async (email, password) => {
    ensureAuthEnabled();
    const cred = await signInWithEmailAndPassword(auth, email, password);
    // Retorna o user para telas que verificam emailVerified
    return cred.user;
  };

  // Cadastro
  const signUp = async (email, password) => {
    ensureAuthEnabled();
    const cred = await createUserWithEmailAndPassword(auth, email, password);
    await ensureUserRole(cred.user.uid, cred.user.email);
  };

  // Reset de senha
  const resetPassword = async (email) => {
    ensureAuthEnabled();
    await sendPasswordResetEmail(auth, email);
  };

  // Logout
  const signOut = async () => {
    ensureAuthEnabled();
    await firebaseSignOut(auth);
  };

  // Atualizar perfil (nome, email, senha, foto)
  const updateUser = async ({ nome, email, senha, foto }) => {
    ensureAuthEnabled();
    if (!auth.currentUser) throw new Error("Nenhum usuário logado.");

    try {
      if (nome || foto) {
        await updateProfile(auth.currentUser, {
          displayName: nome ?? auth.currentUser.displayName,
          photoURL: foto ?? auth.currentUser.photoURL,
        });
      }

      if (email && email !== auth.currentUser.email) {
        try {
          await updateEmail(auth.currentUser, email);
        } catch (err) {
          if (err.code === "auth/requires-recent-login") {
            throw new Error("⚠️ Refaça login antes de alterar o email.");
          }
          throw err;
        }
      }

      if (senha) {
        try {
          await updatePassword(auth.currentUser, senha);
        } catch (err) {
          if (err.code === "auth/requires-recent-login") {
            throw new Error("⚠️ Refaça login antes de alterar a senha.");
          }
          throw err;
        }
      }

      // Atualiza estado local com o usuário atualizado
      setUser({ ...auth.currentUser });
    } catch (error) {
      logger.error("useAuth: updateUser failed", error);
      throw error;
    }
  };

  // Quando em modo de teste, garantimos loading=false desde o início
  const contextValue = AUTH_TEST_MODE
    ? {
        user: null,
        loading: false,
        // Mantém a API para não quebrar telas que importam as funções:
        signIn: async () => {
          const err = new Error("Autenticação desativada para testes.");
          err.code = "auth/test-mode-disabled";
          throw err;
        },
        signUp: async () => {
          const err = new Error("Autenticação desativada para testes.");
          err.code = "auth/test-mode-disabled";
          throw err;
        },
        resetPassword: async () => {
          const err = new Error("Autenticação desativada para testes.");
          err.code = "auth/test-mode-disabled";
          throw err;
        },
        signOut: async () => {
          // no-op em modo teste
        },
        updateUser: async () => {
          const err = new Error("Autenticação desativada para testes.");
          err.code = "auth/test-mode-disabled";
          throw err;
        },
      }
    : { user, role, loading, signIn, signUp, resetPassword, signOut, updateUser };

  return <AuthContext.Provider value={contextValue}>{children}</AuthContext.Provider>;
};

export default function useAuth() {
  return useContext(AuthContext);
}

