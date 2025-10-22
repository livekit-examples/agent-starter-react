'use client';

import Link from 'next/link';
import { COMPONENTS } from '../_components';

export default function Page() {
  return (
    <>
      <h2 id="components" className="mb-8 text-4xl font-bold tracking-tighter">
        Components
      </h2>
      <p className="text-muted-foreground text-balance">
        Build beautiful voice experiences with our components.
      </p>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {Object.entries(COMPONENTS).map(([componentName]) => (
          <Link
            href={`/ui/components/${componentName}`}
            key={componentName}
            className="font-semibold underline-offset-4 hover:underline focus:underline"
          >
            {componentName}
          </Link>
        ))}
      </div>

      <div className="space-y-20 py-20">
        {Object.entries(COMPONENTS).map(([componentName, component]) => (
          <div key={componentName}>
            <h2 className="text-foreground mb-8 text-3xl font-bold">{componentName}</h2>
            {component()}
          </div>
        ))}
      </div>
    </>
  );
}
