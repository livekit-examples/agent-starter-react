'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';

export function Tabs() {
  const pathname = usePathname();

  return (
    <div className="flex flex-row justify-between border-b">
      <Link
        href="/ui/base"
        className={cn(
          'text-foreground -mb-px cursor-pointer px-4 pt-2 text-xl font-bold tracking-tight uppercase',
          pathname === '/ui/base' && 'bg-background rounded-t-lg border-t border-r border-l'
        )}
      >
        Base UI
      </Link>
      <Link
        href="/ui/livekit"
        className={cn(
          'text-foreground -mb-px cursor-pointer px-4 py-2 text-xl font-bold tracking-tight uppercase',
          pathname === '/ui/livekit' && 'bg-background rounded-t-lg border-t border-r border-l'
        )}
      >
        LiveKit UI
      </Link>
    </div>
  );
}
