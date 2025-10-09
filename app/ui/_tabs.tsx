'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';

interface TabProps {
  href: string;
  children: React.ReactNode;
  className?: string;
}

function Tab({ href, children, className }: TabProps) {
  const pathname = usePathname();

  return (
    <Link
      href={href}
      className={cn(
        'text-foreground hover:text-primary focus:text-primary -mb-px cursor-pointer pt-2 transition-colors',
        className,
        pathname === href && 'text-primary font-bold'
      )}
    >
      {children}
    </Link>
  );
}

export function Tabs() {
  return (
    <div className="flex flex-row gap-4">
      <Tab href="/ui/base">Base UI</Tab>
      <Tab href="/ui/livekit">LiveKit UI</Tab>
    </div>
  );
}
