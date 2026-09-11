import { create } from 'zustand';
import { readSession } from './storedSession';
import type { AdminUser } from '../api/types';

interface AdminAuthState {
  token: string | null;
  admin: AdminUser | null;
  adminLogin: (token: string, admin: AdminUser) => void;
  adminLogout: () => void;
}

const stored = readSession<AdminUser>('admin_token', 'admin_user');

export const useAdminAuthStore = create<AdminAuthState>((set) => ({
  token: stored.token,
  admin: stored.user,

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
