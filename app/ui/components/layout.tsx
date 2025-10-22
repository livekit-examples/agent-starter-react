'use client';

import Link from 'next/link';
import { COMPONENTS } from '../_components';

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-1 gap-8 md:grid-cols-[100px_1fr_100px]">
      <aside className="sticky top-0 hidden md:block">
        <div className="flex flex-col gap-1 space-y-4 py-8">
          <div className="flex flex-col gap-2">
            <h2 className="text-muted-foreground text-sm font-semibold">Components</h2>
            {Object.entries(COMPONENTS).map(([componentName]) => (
              <Link
                href={`/ui/components/${componentName}`}
                key={componentName}
                className="text-sm font-semibold underline-offset-4 hover:underline focus:underline"
              >
                {componentName}
              </Link>
            ))}
          </div>
        </div>
      </aside>

      <div className="space-y-8 py-8">
        <main className="mx-auto max-w-3xl space-y-8">{children}</main>
      </div>

      <aside className="sticky top-0 hidden md:block"></aside>
    </div>
  );
}
