import { create } from 'zustand';

interface User {
  id: string;
  nombre: string;
  email: string;
  rol: string;
  empresaId: string;
}

interface AuthState {
  token: string | null;
  user: User | null;
  isAuthenticated: boolean;
  login: (token: string, user: User) => void;
  logout: () => void;
}

// Inicialización leyendo del localStorage para persistencia básica
const initialToken = localStorage.getItem('cudii_token');
const initialUser = localStorage.getItem('cudii_user');

export const useAuthStore = create<AuthState>((set) => ({
  token: initialToken,
  user: initialUser ? JSON.parse(initialUser) : null,
  isAuthenticated: !!initialToken,

  login: (token, user) => {
    localStorage.setItem('cudii_token', token);
    localStorage.setItem('cudii_user', JSON.stringify(user));
    set({ token, user, isAuthenticated: true });
  },

  logout: () => {
    localStorage.removeItem('cudii_token');
    localStorage.removeItem('cudii_user');
    set({ token: null, user: null, isAuthenticated: false });
  },
}));
