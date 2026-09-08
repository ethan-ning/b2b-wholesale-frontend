import { create } from 'zustand';
import type { AdminUser } from '../api/types';

interface AdminAuthState {
  token: string | null;
  admin: AdminUser | null;
  adminLogin: (token: string, admin: AdminUser) => void;
  adminLogout: () => void;
}

const storedToken = localStorage.getItem('admin_token');
const storedAdmin = localStorage.getItem('admin_user');

export const useAdminAuthStore = create<AdminAuthState>((set) => ({
  token: storedToken,
  admin: storedAdmin ? (JSON.parse(storedAdmin) as AdminUser) : null,

  adminLogin: (token, admin) => {
    localStorage.setItem('admin_token', token);
    localStorage.setItem('admin_user', JSON.stringify(admin));
    set({ token, admin });
  },

  adminLogout: () => {
    localStorage.removeItem('admin_token');
    localStorage.removeItem('admin_user');
    set({ token: null, admin: null });
  },
}));
