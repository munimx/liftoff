import { create } from 'zustand';
import type { UserPublicDto } from '@liftoff/shared';

interface AuthState {
  user: UserPublicDto | null;
  accessToken: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  setAuth: (user: UserPublicDto, accessToken: string) => void;
  clearAuth: () => void;
  setToken: (accessToken: string) => void;
  setLoading: (isLoading: boolean) => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  accessToken: null,
  isAuthenticated: false,
  isLoading: true,
  setAuth: (user, accessToken) =>
    set({
      user,
      accessToken,
      isAuthenticated: true,
      isLoading: false,
    }),
  clearAuth: () =>
    set({
      user: null,
      accessToken: null,
      isAuthenticated: false,
      isLoading: false,
    }),
  setToken: (accessToken) =>
    set((state) => ({
      accessToken,
      isAuthenticated: state.user !== null && accessToken.length > 0,
    })),
  setLoading: (isLoading) => set({ isLoading }),
}));
