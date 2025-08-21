'use client';

import { usePathname } from 'next/navigation';

export function Pathname({ action }: { action: (pathname: string) => React.ReactNode }) {
  const pathname = usePathname();
  return <>{action(pathname)}</>;
}
