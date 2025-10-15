'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';

export function Tabs() {
  const pathname = usePathname();

  return (
    <div className="flex flex-row justify-between border-b">
      <Link
        href="/components/base"
        className={cn(
          'text-fg0 -mb-px cursor-pointer px-4 pt-2 text-xl font-bold tracking-tight uppercase',
          pathname === '/components/base' && 'bg-background rounded-t-lg border-t border-r border-l'
        )}
      >
        Base components
      </Link>
      <Link
        href="/components/livekit"
        className={cn(
          'text-fg0 -mb-px cursor-pointer px-4 py-2 text-xl font-bold tracking-tight uppercase',
          pathname === '/components/livekit' &&
            'bg-background rounded-t-lg border-t border-r border-l'
        )}
      >
        LiveKit components
      </Link>
    </div>
  );
}
