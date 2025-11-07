import { headers } from 'next/headers';
import Link from 'next/link';
import { SessionProvider } from '@/components/app/session-provider';
import { getAppConfig } from '@/lib/utils';

export default async function Layout({ children }: { children: React.ReactNode }) {
  const hdrs = await headers();
  const appConfig = await getAppConfig(hdrs);

  return (
    <SessionProvider appConfig={appConfig}>
      <div className="px-8">
        <div className="min-h-svh">
          <header className="flex items-baseline gap-8 py-4">
            <Link
              href="/ui"
              className="hover:text-primary focus:text-primary flex cursor-pointer items-baseline gap-1 leading-4"
            >
              <svg
                height="20"
                viewBox="0 0 123 28"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                className="text-foreground"
              >
                <path
                  d="M4.7 0H0v27.6h17v-4H4.7V0ZM24.8 12.5h-4.5v15h4.5v-15ZM38.2 27 32.4 8H28l6 19.6h8.6l6-19.6H44l-5.8 19ZM59.8 7.6c-5.9 0-9.6 4.2-9.6 10.2 0 6 3.6 10.2 9.6 10.2 4.6 0 8-2 9.2-6.2h-4.6c-.7 1.9-2 3-4.5 3-2.8 0-4.7-2-5-5.7h14.4l.1-1.4c0-6.1-3.8-10.1-9.6-10.1Zm-5 8.4c.5-3.6 2.4-5.2 5-5.2 2.9 0 4.7 2 5 5.2h-10ZM96 0h-5.9L78.7 12.6V0H74v27.6h4.7v-14l12.6 14h6L84.1 13 96.1 0ZM104 8h-4.6v15h4.5V8ZM20.3 8h-4.6v4.5h4.6V8ZM108.5 23h-4.6v4.6h4.6V23ZM122 23h-4.5v4.6h4.6V23ZM122 12.5V8h-4.5V0H113v8h-4.6v4.5h4.6V23h4.5V12.5h4.6Z"
                  fill="currentColor"
                />
              </svg>
              <span className="text-[20px] tracking-tighter">UI</span>
            </Link>
            <Link
              href="https://docs.livekit.io/agents/start/frontend/"
              className="text-sm font-semibold underline-offset-4 hover:underline focus:underline"
            >
              Docs
            </Link>
            <Link
              href="/ui/components"
              className="text-sm font-semibold underline-offset-4 hover:underline focus:underline"
            >
              Components
            </Link>
          </header>

          {children}
        </div>

        <footer className="text-muted-foreground p-8 text-center text-sm">
          <p className="text-muted-foreground text-balance">
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
        </footer>
      </div>
    </SessionProvider>
  );
}
