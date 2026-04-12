'use client';

import { usePathname } from 'next/navigation';
import { UserMenu } from '@/components/layout/user-menu';

const titleByPath: Array<{ matcher: RegExp; title: string }> = [
  { matcher: /^\/dashboard$/, title: 'Dashboard' },
  { matcher: /^\/projects$/, title: 'Projects' },
  { matcher: /^\/projects\/[^/]+$/, title: 'Project details' },
  { matcher: /^\/projects\/[^/]+\/environments\/[^/]+$/, title: 'Environment details' },
  { matcher: /^\/settings$/, title: 'Settings' },
];

/**
 * Dashboard header with derived page title and user menu.
 */
export function Header({ title }: { title?: string }): JSX.Element {
  const pathname = usePathname();
  const resolvedTitle =
    title ??
    titleByPath.find((item) => item.matcher.test(pathname))?.title ??
    'Liftoff';

  return (
    <header className="flex items-center justify-between border-b bg-background px-6 py-4">
      <h1 className="text-lg font-semibold tracking-tight">{resolvedTitle}</h1>
      <UserMenu />
    </header>
  );
}
