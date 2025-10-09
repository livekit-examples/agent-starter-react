import * as React from 'react';
import { headers } from 'next/headers';
import { getAppConfig } from '@/lib/utils';
import { RoomProvider } from './_room-provider';

export default async function ComponentsLayout({ children }: { children: React.ReactNode }) {
  const hdrs = await headers();
  const appConfig = await getAppConfig(hdrs);
  return (
    <div className="bg-muted/20 min-h-svh p-8">
      <div className="mx-auto max-w-3xl space-y-8">
        <header className="space-y-2">
          <h1 className="text-5xl font-bold tracking-tight">LiveKit UI</h1>
          <p className="text-muted-foreground max-w-prose text-balance">
            A set of beautifully designed components that you can customize, extend, and build on.
          </p>
          <p className="text-muted-foreground max-w-prose text-balance">
            Built with Shadcn conventions.
          </p>
          <p className="text-foreground max-w-prose text-balance">Open Source. Open Code.</p>
        </header>

        <RoomProvider appConfig={appConfig}>
          <main className="space-y-20">{children}</main>
        </RoomProvider>
      </div>
    </div>
  );
}
