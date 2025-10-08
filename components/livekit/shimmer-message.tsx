import React from 'react';
import { cn } from '@/lib/utils';

interface ShimmerMessageProps {
  children: React.ReactNode;
  className?: string;
}

export function ShimmerMessage({
  children,
  className,
  ref,
}: ShimmerMessageProps & React.RefAttributes<HTMLSpanElement>) {
  return (
    <span
      ref={ref}
      className={cn(
        'animate-text-shimmer inline-block !bg-clip-text text-sm font-semibold text-transparent',
        className
      )}
    >
      {children}
    </span>
  );
}

export default ShimmerMessage;
