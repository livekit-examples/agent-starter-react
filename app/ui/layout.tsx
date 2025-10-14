import * as React from 'react';
import { headers } from 'next/headers';
import { SessionProvider } from '@/components/app/session-provider';
import { getAppConfig } from '@/lib/utils';

export default async function ComponentsLayout({ children }: { children: React.ReactNode }) {
  const hdrs = await headers();
  const appConfig = await getAppConfig(hdrs);

  return (
    <SessionProvider appConfig={appConfig}>
      <div className="bg-muted/20 min-h-svh p-8">
        <div className="mx-auto max-w-3xl space-y-8">
          <header className="space-y-2">
            <h1 className="text-5xl font-bold tracking-tight">LiveKit UI</h1>
            <p className="text-muted-foreground max-w-80 leading-tight text-pretty">
              A set of UI components for building LiveKit-powered voice experiences.
            </p>
            <p className="text-muted-foreground max-w-prose text-balance">
              Built with{' '}
              <a href="https://shadcn.com" className="underline underline-offset-2">
                Shadcn
              </a>
              ,{' '}
              <a href="https://motion.dev" className="underline underline-offset-2">
                Motion
              </a>
              , and{' '}
              <a href="https://livekit.io" className="underline underline-offset-2">
                LiveKit
              </a>
              .
            </p>
            <p className="text-foreground max-w-prose text-balance">Open Source.</p>
          </header>

          <main className="space-y-20">{children}</main>
        </div>
      </div>
    </SessionProvider>
  );
}
