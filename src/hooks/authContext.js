import { createContext } from 'react';
export default createContext({ user: null, role: null, loading: false,
  signIn: async () => {}, signUp: async () => {}, resetPassword: async () => {}, signOut: async () => {}, updateUser: async () => {} });
