'use client';

import type { UserPublicDto } from '@liftoff/shared';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { apiClient } from '@/lib/api-client';
import { useAuthStore } from '@/store/auth.store';

/**
 * Rehydrates auth state from refresh cookie for protected routes.
 */
export function useAuthRehydration(): void {
  const router = useRouter();
  const user = useAuthStore((state) => state.user);
  const accessToken = useAuthStore((state) => state.accessToken);
  const setAuth = useAuthStore((state) => state.setAuth);
  const clearAuth = useAuthStore((state) => state.clearAuth);
  const setLoading = useAuthStore((state) => state.setLoading);

  useEffect(() => {
    let isMounted = true;

    const rehydrate = async (): Promise<void> => {
      if (user && accessToken) {
        setLoading(false);
        return;
      }

      setLoading(true);

      try {
        const refreshResponse = await apiClient.post<{ accessToken: string }>('/auth/refresh');
        const nextToken = refreshResponse.data.accessToken;
        const profileResponse = await apiClient.get<UserPublicDto>('/users/me', {
          headers: {
            Authorization: `Bearer ${nextToken}`,
          },
        });

        if (!isMounted) {
          return;
        }

        setAuth(profileResponse.data, nextToken);
      } catch {
        if (!isMounted) {
          return;
        }

        clearAuth();
        router.push('/login');
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    void rehydrate();

    return () => {
      isMounted = false;
    };
  }, [accessToken, clearAuth, router, setAuth, setLoading, user]);
}
