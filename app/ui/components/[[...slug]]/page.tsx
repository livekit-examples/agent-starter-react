'use client';

import { redirect, useParams } from 'next/navigation';
import { COMPONENTS } from '../../_components';

export default function Page() {
  const { slug = [] } = useParams();
  const [componentName] = slug;
  const component = COMPONENTS[componentName as keyof typeof COMPONENTS];

  if (!component) {
    return redirect('/ui');
  }

  return (
    <>
      <div className="py-8">
        <h1 className="text-foreground mb-8 text-5xl font-bold">{componentName}</h1>
        {component()}
      </div>
    </>
  );
}
