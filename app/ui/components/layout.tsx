'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { COMPONENTS } from '../_components';

export default function Layout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isActive = (path: string) => pathname === path;

  return (
    <div className="grid grid-cols-1 gap-8 md:grid-cols-[100px_1fr_100px]">
      <aside className="sticky top-0 hidden py-10 md:block">
        <div className="flex flex-col gap-2">
          <h2 className="text-muted-foreground text-sm font-semibold">
            <Link
              href="/ui/components"
              className={cn(
                'text-sm font-semibold underline-offset-4 hover:underline focus:underline',
                isActive('/ui/components') && 'underline'
              )}
            >
              Components
            </Link>
          </h2>
          {Object.entries(COMPONENTS)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([componentName]) => (
              <Link
                href={`/ui/components/${componentName}`}
                key={componentName}
                className={cn(
                  'text-sm font-semibold underline-offset-4 hover:underline focus:underline',
                  isActive(`/ui/components/${componentName}`) && 'underline'
                )}
              >
                {componentName}
              </Link>
            ))}
        </div>
      </aside>

      <div className="space-y-8 py-8">
        <main className="mx-auto max-w-3xl space-y-8">{children}</main>
      </div>

      <aside className="sticky top-0 hidden md:block"></aside>
    </div>
  );
}
