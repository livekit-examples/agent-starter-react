import Link from 'next/link';
import { getComponentNames } from '@/lib/components';

export default function Page() {
  const componentNames = getComponentNames();

  return (
    <>
      <h2 id="components" className="mb-8 text-4xl font-bold tracking-tighter">
        Components
      </h2>
      <p className="text-muted-foreground text-balance">
        Build beautiful voice experiences with our components.
      </p>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {componentNames
          .sort((a, b) => a.localeCompare(b))
          .map((componentName) => (
            <Link
              href={`/ui/components/${componentName}`}
              key={componentName}
              className="font-semibold underline-offset-4 hover:underline focus:underline"
            >
              {componentName}
            </Link>
          ))}
      </div>
    </>
  );
}
