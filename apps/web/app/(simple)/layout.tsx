'use client';

import Link from 'next/link';
import { Rocket } from 'lucide-react';
import { useAuthRehydration } from '@/hooks/use-auth-rehydration';
import { useAuthStore } from '@/store/auth.store';

/**
 * Simple Mode layout — minimal chrome, no sidebar.
 * Does NOT enforce auth so the public status page remains accessible.
 */
export default function SimpleLayout({
  children,
}: {
  children: React.ReactNode;
}): JSX.Element {
  useAuthRehydration();
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);

  return (
    <div className="flex min-h-screen flex-col">
      <header className="flex items-center justify-between border-b px-6 py-4">
        <Link href="/deploy" className="flex items-center gap-2 font-bold text-lg">
          <Rocket className="h-5 w-5" />
          Liftoff
        </Link>
        {isAuthenticated ? (
          <Link
            href="/dashboard"
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            Switch to Developer Mode
          </Link>
        ) : (
          <Link
            href="/login"
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            Sign in
          </Link>
        )}
      </header>
      <main className="flex-1">{children}</main>
    </div>
  );
}
