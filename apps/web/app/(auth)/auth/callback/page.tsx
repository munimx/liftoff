'use client';

import type { UserPublicDto } from '@liftoff/shared';
import axios from 'axios';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useAuthStore } from '@/store/auth.store';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

/**
 * Handles OAuth callback token exchange and auth state hydration.
 */
export default function AuthCallbackPage(): JSX.Element {
  const router = useRouter();
  const setAuth = useAuthStore((state) => state.setAuth);
  const clearAuth = useAuthStore((state) => state.clearAuth);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    const processAuth = async (): Promise<void> => {
      const token = new URLSearchParams(window.location.search).get('token');
      if (!token) {
        setErrorMessage('Missing access token. Please sign in again.');
        return;
      }

      try {
        const response = await axios.get<UserPublicDto>(`${API_BASE_URL}/api/v1/users/me`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
          withCredentials: true,
        });

        if (!isMounted) {
          return;
        }

        setAuth(response.data, token);
        router.replace('/dashboard');
      } catch {
        if (!isMounted) {
          return;
        }

        clearAuth();
        setErrorMessage('Authentication failed. Please sign in again.');
      }
    };

    void processAuth();

    return () => {
      isMounted = false;
    };
  }, [clearAuth, router, setAuth]);

  if (errorMessage) {
    return (
      <main className="flex min-h-screen items-center justify-center px-4">
        <div className="w-full max-w-md rounded-xl border bg-card p-8 text-center shadow-sm">
          <h1 className="text-xl font-semibold">Sign in failed</h1>
          <p className="mt-3 text-sm text-muted-foreground">{errorMessage}</p>
          <a
            href="/login"
            className="mt-6 inline-flex rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition hover:opacity-90"
          >
            Back to login
          </a>
        </div>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen items-center justify-center">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-muted border-t-primary" />
    </main>
  );
}
