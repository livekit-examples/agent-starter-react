'use client';

import type { HTMLAttributes } from 'react';
import { cn } from '@/lib/shadcn/utils';

export interface SpatiusAvatarCanvasProps extends HTMLAttributes<HTMLDivElement> {
  /** Ref callback from `useSpatiusAvatar` — the SDK mounts its `<canvas>` here. */
  containerRef: (node: HTMLDivElement | null) => void;
}

/**
 * Render surface for the Spatius avatar. The AvatarKit SDK injects its own
 * `<canvas>` into this container element.
 */
export function SpatiusAvatarCanvas({
  containerRef,
  className,
  ...props
}: SpatiusAvatarCanvasProps) {
  return (
    <div
      {...props}
      ref={containerRef}
      className={cn('relative h-full w-full overflow-hidden bg-black', className)}
    />
  );
}
