'use client';

import { ChevronDown } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { apiClient } from '@/lib/api-client';
import { useAuthStore } from '@/store/auth.store';

/**
 * Dashboard header user dropdown menu.
 */
export function UserMenu(): JSX.Element | null {
  const router = useRouter();
  const user = useAuthStore((state) => state.user);
  const clearAuth = useAuthStore((state) => state.clearAuth);

  if (!user) {
    return null;
  }

  const displayName = user.name || user.githubUsername;
  const avatarFallback = displayName.charAt(0).toUpperCase();

  const handleSignOut = async (): Promise<void> => {
    try {
      await apiClient.delete('/auth/logout');
    } finally {
      clearAuth();
      router.push('/login');
    }
  };

  return (
    <details className="relative">
      <summary className="flex cursor-pointer list-none items-center gap-3 rounded-md border px-3 py-2 text-sm hover:bg-muted">
        {user.avatarUrl ? (
          <Image
            src={user.avatarUrl}
            alt={displayName}
            width={28}
            height={28}
            className="h-7 w-7 rounded-full"
          />
        ) : (
          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-muted text-xs font-semibold">
            {avatarFallback}
          </div>
        )}
        <span className="max-w-[180px] truncate font-medium">{displayName}</span>
        <ChevronDown className="h-4 w-4 text-muted-foreground" />
      </summary>
      <div className="absolute right-0 z-20 mt-2 w-48 rounded-md border bg-card p-1 shadow-lg">
        <Link
          href="/settings"
          className="block rounded px-3 py-2 text-sm hover:bg-muted"
        >
          Profile settings
        </Link>
        <button
          type="button"
          onClick={() => {
            void handleSignOut();
          }}
          className="w-full rounded px-3 py-2 text-left text-sm hover:bg-muted"
        >
          Sign out
        </button>
      </div>
    </details>
  );
}
