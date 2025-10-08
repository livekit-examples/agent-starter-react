import { cn } from '@/lib/utils';

interface SkrimProps {
  top?: boolean;
  bottom?: boolean;
  className?: string;
}

export function Skrim({ top = false, bottom = false, className }: SkrimProps) {
  return (
    <div
      className={cn(
        'from-background pointer-events-none h-4 bg-linear-to-b to-transparent',
        top && 'bg-linear-to-b',
        bottom && 'bg-linear-to-t',
        className
      )}
    />
  );
}
