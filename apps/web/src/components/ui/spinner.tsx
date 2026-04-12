'use client';

import { cn } from '@/lib/utils';

interface SpinnerProps {
  className?: string;
}

/**
 * Loading spinner primitive.
 */
export function Spinner({ className }: SpinnerProps): JSX.Element {
  return <div className={cn('h-5 w-5 animate-spin rounded-full border-2 border-muted border-t-primary', className)} />;
}
