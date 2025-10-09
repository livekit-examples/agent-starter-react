import { cn } from '@/lib/utils';

interface ContainerProps {
  componentName?: string;
  children: React.ReactNode;
  className?: string;
}

export function Container({ componentName, children, className }: ContainerProps) {
  return (
    <div className={cn('space-y-4', className)}>
      <h3 className="text-foreground text-2xl font-bold">
        <span className="tracking-tight">{componentName}</span>
      </h3>
      <div className="bg-background border-input space-y-4 rounded-3xl border p-8 drop-shadow-lg/5">
        {children}
      </div>
    </div>
  );
}
