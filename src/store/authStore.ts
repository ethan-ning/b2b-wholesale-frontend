import { create } from 'zustand';

interface AuthUser {
  id: number;
  email: string;
  name: string;
  companyName: string;
  tierId: number;
  tierName: string;
  mustChangePassword: boolean;
}

interface AuthState {
  token: string | null;
  user: AuthUser | null;
  login: (token: string, user: AuthUser) => void;
  logout: () => void;
}

const storedToken = localStorage.getItem('auth_token');
const storedUser = localStorage.getItem('auth_user');

export const useAuthStore = create<AuthState>((set) => ({
  token: storedToken,
  user: storedUser ? (JSON.parse(storedUser) as AuthUser) : null,

  login: (token, user) => {
    localStorage.setItem('auth_token', token);
    localStorage.setItem('auth_user', JSON.stringify(user));
    set({ token, user });
  },

  logout: () => {
    localStorage.removeItem('auth_token');
    localStorage.removeItem('auth_user');
    set({ token: null, user: null });
  },
}));
