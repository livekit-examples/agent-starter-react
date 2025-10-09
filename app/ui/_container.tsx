import { cn } from '@/lib/utils';

interface ContainerProps {
  children: React.ReactNode;
  className?: string;
}

export function Container({ children, className }: ContainerProps) {
  return (
    <div
      className={cn(
        'bg-card border-input relative space-y-4 rounded-lg border p-4 drop-shadow-lg/5',
        className
      )}
    >
      {children}
    </div>
  );
}
