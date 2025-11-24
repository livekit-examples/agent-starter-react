import { SideNav } from '@/components/docs/side-nav';
import { getComponentNames } from '@/lib/components';

interface LayoutProps {
  children: React.ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  const componentNames = getComponentNames();

  return (
    <div className="grid grid-cols-1 gap-8 md:grid-cols-[100px_1fr_100px]">
      <aside className="sticky top-0 hidden py-10 md:block">
        <div className="flex flex-col gap-2">
          <SideNav componentNames={componentNames} />
        </div>
      </aside>

      <div className="space-y-8 py-8">
        <main className="mx-auto max-w-3xl space-y-8">{children}</main>
      </div>

      <aside className="sticky top-0 hidden md:block"></aside>
    </div>
  );
}
