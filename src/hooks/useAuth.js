// src/hooks/useAuth.js
import React, { createContext, useContext, useEffect, useState } from "react";

// DependÃªncias do Firebase (mantidas para quando o modo de teste for desativado)
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

import { auth } from "../services/firebase";
import logger from "../utils/logger";

/**
 * ðŸ”§ MODO DE TESTE (sem login, cadastro e recuperaÃ§Ã£o)
 * - Quando TRUE, ignora qualquer integraÃ§Ã£o real com Firebase Auth
 * - Retorna { user: null, loading: false } e mantÃ©m a API do contexto disponÃ­vel
 * - Para reativar autenticaÃ§Ã£o real depois, basta mudar para false
 */
const AUTH_TEST_MODE = false;

const AuthContext = createContext({
  user: null,
  loading: false,
  signIn: async () => {},
  signUp: async () => {},
  resetPassword: async () => {},
  signOut: async () => {},
  updateUser: async () => {},
});

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);      // usuÃ¡rio atual (ou null)
  const [loading, setLoading] = useState(true); // estado de carregamento inicial

  useEffect(() => {
    // Se estamos em modo de teste, nÃ£o conectar no Firebase
    if (AUTH_TEST_MODE) {
      setUser(null);
      setLoading(false);
      return;
    }

    // Se por algum motivo 'auth' nÃ£o estiver configurado, nÃ£o quebra a aplicaÃ§Ã£o
    if (!auth) {
      logger.warn("useAuth: Firebase auth nao configurado");
      setUser(null);
      setLoading(false);
      return;
    }

    // Modo normal (autenticaÃ§Ã£o real)
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      // âœ… Login persistente funciona para todos os usuÃ¡rios, 
      // independente da verificaÃ§Ã£o de email
      setUser(currentUser || null);
      setLoading(false);
    });

    return () => {
      try {
        unsubscribe && unsubscribe();
      } catch {
        // evita crash se unsubscribe for invÃ¡lido
      }
    };
  }, []);

  // Helpers para evitar repetiÃ§Ã£o
  const ensureAuthEnabled = () => {
    if (AUTH_TEST_MODE) {
      const err = new Error("AutenticaÃ§Ã£o desativada para testes.");
      err.code = "auth/test-mode-disabled";
      throw err;
    }
    if (!auth) {
      const err = new Error("Firebase Auth nÃ£o configurado.");
      err.code = "auth/not-configured";
      throw err;
    }
  };

  // Login
  const signIn = async (email, password) => {
    ensureAuthEnabled();
    const cred = await signInWithEmailAndPassword(auth, email, password);
    // Retorna o user para telas que verificam emailVerified
    return cred.user;
  };

  // Cadastro
  const signUp = async (email, password) => {
    ensureAuthEnabled();
    await createUserWithEmailAndPassword(auth, email, password);
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
    if (!auth.currentUser) throw new Error("Nenhum usuÃ¡rio logado.");

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
            throw new Error("âš ï¸ RefaÃ§a login antes de alterar o email.");
          }
          throw err;
        }
      }

      if (senha) {
        try {
          await updatePassword(auth.currentUser, senha);
        } catch (err) {
          if (err.code === "auth/requires-recent-login") {
            throw new Error("âš ï¸ RefaÃ§a login antes de alterar a senha.");
          }
          throw err;
        }
      }

      // Atualiza estado local com o usuÃ¡rio atualizado
      setUser({ ...auth.currentUser });
    } catch (error) {
      logger.error("useAuth: updateUser failed", error);
      throw error;
    }
  };

  // Quando em modo de teste, garantimos loading=false desde o inÃ­cio
  const contextValue = AUTH_TEST_MODE
    ? {
        user: null,
        loading: false,
        // MantÃ©m a API para nÃ£o quebrar telas que importam as funÃ§Ãµes:
        signIn: async () => {
          const err = new Error("AutenticaÃ§Ã£o desativada para testes.");
          err.code = "auth/test-mode-disabled";
          throw err;
        },
        signUp: async () => {
          const err = new Error("AutenticaÃ§Ã£o desativada para testes.");
          err.code = "auth/test-mode-disabled";
          throw err;
        },
        resetPassword: async () => {
          const err = new Error("AutenticaÃ§Ã£o desativada para testes.");
          err.code = "auth/test-mode-disabled";
          throw err;
        },
        signOut: async () => {
          // no-op em modo teste
        },
        updateUser: async () => {
          const err = new Error("AutenticaÃ§Ã£o desativada para testes.");
          err.code = "auth/test-mode-disabled";
          throw err;
        },
      }
    : { user, loading, signIn, signUp, resetPassword, signOut, updateUser };

  return <AuthContext.Provider value={contextValue}>{children}</AuthContext.Provider>;
};

export default function useAuth() {
  return useContext(AuthContext);
}

