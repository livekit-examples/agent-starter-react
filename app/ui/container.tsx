import { cn } from '@/lib/utils';

interface ContainerProps {
  children: React.ReactNode;
  className?: string;
}

export function Container({ children, className }: ContainerProps) {
  return (
    <div className={cn('relative space-y-4 rounded-lg border p-4', className)}>{children}</div>
  );
}
