interface StoryTitleProps {
  children: React.ReactNode;
}

export function StoryTitle({ children }: StoryTitleProps) {
  return <h4 className="text-muted-foreground mb-2 font-mono text-xs uppercase">{children}</h4>;
}
