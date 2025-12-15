import * as React from 'react';
import { cva } from 'class-variance-authority';
import { Track } from 'livekit-client';
import { useTrackToggle } from '@livekit/components-react';
import {
  MicIcon,
  MicOffIcon,
  MonitorUpIcon,
  MonitorOffIcon,
  LoaderIcon,
  VideoIcon,
  VideoOffIcon,
} from 'lucide-react';
import { Toggle } from '@/components/ui/toggle';
import { cn } from '@/lib/utils';

export const agentTrackToggleVariants = cva(['size-9'], {
  variants: {
    variant: {
      default: [
        'data-[state=off]:bg-destructive/10 data-[state=off]:text-destructive',
        'data-[state=off]:hover:bg-destructive/15',
        'data-[state=off]:focus-visible:ring-destructive/30',
        'data-[state=on]:bg-accent data-[state=on]:text-accent-foreground',
        'data-[state=on]:hover:bg-foreground/10',
      ],
      outline: [
        'data-[state=off]:bg-destructive/10 data-[state=off]:text-destructive data-[state=off]:border-destructive/20',
        'data-[state=off]:hover:bg-destructive/15 data-[state=off]:hover:text-destructive',
        'data-[state=off]:focus:text-destructive',
        'data-[state=off]:focus-visible:border-destructive data-[state=off]:focus-visible:ring-destructive/30',
        'data-[state=on]:hover:bg-foreground/10 data-[state=on]:hover:border-foreground/12',
        'dark:data-[state=on]:hover:bg-foreground/10',
      ],
    },
  },
  defaultVariants: {
    variant: 'default',
  },
});

function getSourceIcon(source: Track.Source, enabled: boolean, pending = false) {
  if (pending) {
    return LoaderIcon;
  }

  switch (source) {
    case Track.Source.Microphone:
      return enabled ? MicIcon : MicOffIcon;
    case Track.Source.Camera:
      return enabled ? VideoIcon : VideoOffIcon;
    case Track.Source.ScreenShare:
      return enabled ? MonitorUpIcon : MonitorOffIcon;
    default:
      return React.Fragment;
  }
}

export type AgentTrackToggleProps = React.ComponentProps<typeof Toggle> & {
  source: Parameters<typeof useTrackToggle>[0]['source'];
  pending?: boolean;
};

export function AgentTrackToggle({
  source,
  pressed,
  variant,
  pending,
  className,
  ...props
}: AgentTrackToggleProps) {
  const IconComponent = getSourceIcon(source, pressed ?? false, pending);

  return (
    <Toggle
      variant={variant}
      pressed={pressed ?? false}
      aria-label={`Toggle ${source}`}
      className={cn(
        agentTrackToggleVariants({
          variant: variant ?? 'default',
          className,
        }),
      )}
      {...props}
    >
      <IconComponent className={cn(pending && 'animate-spin')} />
      {props.children}
    </Toggle>
  );
}
