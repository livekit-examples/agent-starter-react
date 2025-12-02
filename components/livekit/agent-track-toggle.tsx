'use client';

import * as React from 'react';
import { type VariantProps, cva } from 'class-variance-authority';
import { Track } from 'livekit-client';
import { useTrackToggle } from '@livekit/components-react';
import {
  MicrophoneIcon,
  MicrophoneSlashIcon,
  MonitorArrowUpIcon,
  SpinnerIcon,
  VideoCameraIcon,
  VideoCameraSlashIcon,
} from '@phosphor-icons/react/dist/ssr';
import { Toggle } from '@/components/ui/toggle';
import { cn } from '@/lib/utils';

export const toggleVariants = cva(['size-9'], {
  variants: {
    variant: {
      primary:
        'bg-muted data-[state=on]:bg-muted text-destructive hover:text-foreground hover:bg-foreground/10 hover:data-[state=on]:bg-foreground/10',
      secondary: [
        'bg-muted hover:bg-foreground/10',
        'data-[state=on]:bg-blue-500/20 data-[state=on]:hover:bg-blue-500/30 data-[state=on]:text-blue-700',
        'dark:data-[state=on]:text-blue-300',
      ],
    },
  },
  defaultVariants: {
    variant: 'primary',
  },
});

function getSourceIcon(source: Track.Source, enabled: boolean, pending = false) {
  if (pending) {
    return SpinnerIcon;
  }

  switch (source) {
    case Track.Source.Microphone:
      return enabled ? MicrophoneIcon : MicrophoneSlashIcon;
    case Track.Source.Camera:
      return enabled ? VideoCameraIcon : VideoCameraSlashIcon;
    case Track.Source.ScreenShare:
      return MonitorArrowUpIcon;
    default:
      return React.Fragment;
  }
}

export type AgentTrackToggleProps = Omit<React.ComponentProps<typeof Toggle>, 'size' | 'variant'> &
  VariantProps<typeof toggleVariants> & {
    source: Parameters<typeof useTrackToggle>[0]['source'];
    pending?: boolean;
  };

export function AgentTrackToggle({
  source,
  pressed,
  pending,
  className,
  variant,
  ...props
}: AgentTrackToggleProps) {
  const IconComponent = getSourceIcon(source, pressed ?? false, pending);

  return (
    <Toggle
      pressed={pressed}
      aria-label={`Toggle ${source}`}
      className={cn(toggleVariants({ variant, className }))}
      {...props}
    >
      <IconComponent weight="bold" className={cn(pending && 'animate-spin')} />
      {props.children}
    </Toggle>
  );
}
