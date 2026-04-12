'use client';

import { FolderKanban, LayoutDashboard, LogOut, Rocket, Settings } from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { apiClient } from '@/lib/api-client';
import { useAuthStore } from '@/store/auth.store';

const navigationItems = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/projects', label: 'Projects', icon: FolderKanban },
  { href: '/settings', label: 'Settings', icon: Settings },
];

/**
 * App dashboard sidebar navigation.
 */
export function Sidebar(): JSX.Element {
  const pathname = usePathname();
  const router = useRouter();
  const user = useAuthStore((state) => state.user);
  const clearAuth = useAuthStore((state) => state.clearAuth);

  const handleSignOut = async (): Promise<void> => {
    try {
      await apiClient.delete('/auth/logout');
    } finally {
      clearAuth();
      router.push('/login');
    }
  };

  return (
    <aside className="flex h-full min-h-screen flex-col border-r bg-muted/30 p-4">
      <Link href="/dashboard" className="mb-8 flex items-center gap-2">
        <div className="rounded-md bg-primary p-1.5 text-primary-foreground">
          <Rocket className="h-4 w-4" />
        </div>
        <span className="text-base font-semibold tracking-tight">Liftoff</span>
      </Link>

      <nav className="space-y-1">
        {navigationItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors',
                isActive ? 'bg-accent text-accent-foreground' : 'text-muted-foreground hover:bg-accent/60',
              )}
            >
              <Icon className="h-4 w-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="mt-auto space-y-3 border-t pt-4">
        <div className="space-y-0.5">
          <p className="truncate text-sm font-medium">{user?.name || user?.githubUsername || 'Authenticated user'}</p>
          <p className="truncate text-xs text-muted-foreground">{user?.email}</p>
        </div>
        <Button variant="ghost" className="w-full justify-start" onClick={() => void handleSignOut()}>
          <LogOut className="mr-2 h-4 w-4" />
          Sign out
        </Button>
      </div>
    </aside>
  );
}
