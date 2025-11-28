'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { cn } from '@/lib/utils';

interface SideNavProps {
  
  componentNames: string[];
}

export function SideNav({ componentNames }: SideNavProps) {
  const pathname = usePathname();
  const isActive = (componentName: string) => pathname.endsWith(componentName);

  return (
    <>
    <h2 className="text-muted-foreground text-sm font-semibold">
      <Link
        href="/ui/components"
        className={cn(
          'text-sm font-semibold underline-offset-4 hover:underline focus:underline',
          pathname === '/ui/components' && 'underline'
        )}
      >
        Components
      </Link>
    </h2>
    {[...componentNames]
      .sort((a, b) => a.localeCompare(b))
      .map((componentName) => (
        <Link
          href={`/ui/components/${componentName}`}
          key={componentName}
          className={cn(
            'text-sm font-semibold underline-offset-4 hover:underline focus:underline',
            isActive(componentName) && 'underline'
          )}
        >
          {componentName}
        </Link>
      ))}
    </>
  );
}