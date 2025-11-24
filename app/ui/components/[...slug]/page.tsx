'use client';

import dynamic from 'next/dynamic';
import { redirect, useParams } from 'next/navigation';

export default function Page() {
  const { slug = [] } = useParams();
  const [componentName] = slug;
  const ComponentDemo = dynamic(() => import(`@/components/demos/${componentName}`));

  if (!ComponentDemo) {
    return redirect('/ui');
  }

  return (
    <>
      <h1 className="text-foreground mb-8 text-5xl font-bold">{componentName}</h1>
      <ComponentDemo />
    </>
  );
}
