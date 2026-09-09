import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { User } from '@/types/auth';

interface AuthState {
  user: User | null;
  accessToken: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
  isValuesHidden: boolean;
  _hasHydrated: boolean;
  setHasHydrated: (val: boolean) => void;
  setAuth: (user: User, accessToken: string, refreshToken: string) => void;
  logout: () => void;
  toggleValuesVisibility: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      accessToken: null,
      refreshToken: null,
      isAuthenticated: false,
      isValuesHidden: true, // Varsayılan gizlilik modu aktif
      _hasHydrated: false,
      setHasHydrated: (val: boolean) => set({ _hasHydrated: val }),
      setAuth: (user, accessToken, refreshToken) =>
        set({ user, accessToken, refreshToken, isAuthenticated: true }),
      logout: () =>
        set({ user: null, accessToken: null, refreshToken: null, isAuthenticated: false }),
      toggleValuesVisibility: () =>
        set((state) => ({ isValuesHidden: !state.isValuesHidden })),
    }),
    {
      name: 'spendlog_auth',
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true);
      },
    }
  )
);
