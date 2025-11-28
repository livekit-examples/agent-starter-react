interface ContainerProps {
  componentName: string;
  children: React.ReactNode;
  className?: string;
}

export function Container({ children, className }: ContainerProps) {
  return (
    <div className={className}>
      <div className="bg-background border-input space-y-4 rounded-3xl border p-8 drop-shadow-lg/5">
        {children}
      </div>
    </div>
  );
}
