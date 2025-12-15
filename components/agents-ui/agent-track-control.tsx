'use client';

import { useEffect, useMemo, useState } from 'react';
import { type VariantProps, cva } from 'class-variance-authority';
import { LocalAudioTrack, LocalVideoTrack } from 'livekit-client';
import {
  type TrackReferenceOrPlaceholder,
  useTrackToggle,
  useMaybeRoomContext,
  useMediaDeviceSelect,
} from '@livekit/components-react';

import { AgentAudioVisualizerBar } from '@/components/agents-ui/agent-audio-visualizer-bar';
import { AgentTrackToggle } from '@/components/agents-ui/agent-track-toggle';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { toggleVariants } from '../ui/toggle';

const selectVariants = cva(
  [
    'rounded-l-none shadow-none pl-2 ',
    'text-foreground hover:text-muted-foreground',
    'peer-data-[state=on]/track:bg-muted peer-data-[state=on]/track:hover:bg-foreground/10',
    'peer-data-[state=off]/track:text-destructive',
    'peer-data-[state=off]/track:focus-visible:border-destructive peer-data-[state=off]/track:focus-visible:ring-destructive/30',
    '[&_svg]:opacity-100',
  ],
  {
    variants: {
      variant: {
        default: [
          'border-none',
          'peer-data-[state=off]/track:bg-destructive/10',
          'peer-data-[state=off]/track:hover:bg-destructive/15',
          'peer-data-[state=off]/track:[&_svg]:!text-destructive',

          'dark:peer-data-[state=on]/track:bg-accent',
          'dark:peer-data-[state=on]/track:hover:bg-foreground/10',
          'dark:peer-data-[state=off]/track:bg-destructive/10',
          'dark:peer-data-[state=off]/track:hover:bg-destructive/15',
        ],
        outline: [
          'border border-l-0',
          'peer-data-[state=off]/track:border-destructive/20',
          'peer-data-[state=off]/track:bg-destructive/10',
          'peer-data-[state=off]/track:hover:bg-destructive/15',
          'peer-data-[state=off]/track:[&_svg]:!text-destructive',
          'peer-data-[state=on]/track:hover:border-foreground/12',

          'dark:peer-data-[state=off]/track:bg-destructive/10',
          'dark:peer-data-[state=off]/track:hover:bg-destructive/15',
          'dark:peer-data-[state=on]/track:bg-accent',
          'dark:peer-data-[state=on]/track:hover:bg-foreground/10',
        ],
      },
      size: {
        default: 'w-[180px]',
        sm: 'w-auto',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
);

type DeviceSelectProps = React.ComponentProps<typeof SelectTrigger> &
  VariantProps<typeof selectVariants> & {
    kind: MediaDeviceKind;
    track?: LocalAudioTrack | LocalVideoTrack | undefined;
    requestPermissions?: boolean;
    onMediaDeviceError?: (error: Error) => void;
    onDeviceListChange?: (devices: MediaDeviceInfo[]) => void;
    onActiveDeviceChange?: (deviceId: string) => void;
  };

export function TrackDeviceSelect({
  kind,
  track,
  size = 'default',
  variant = 'default',
  requestPermissions = false,
  onMediaDeviceError,
  onDeviceListChange,
  onActiveDeviceChange,
  ...props
}: DeviceSelectProps) {
  const room = useMaybeRoomContext();
  const [open, setOpen] = useState(false);
  const [requestPermissionsState, setRequestPermissionsState] = useState(requestPermissions);
  const { devices, activeDeviceId, setActiveMediaDevice } = useMediaDeviceSelect({
    room,
    kind,
    track,
    requestPermissions: requestPermissionsState,
    onError: onMediaDeviceError,
  });

  useEffect(() => {
    onDeviceListChange?.(devices);
  }, [devices, onDeviceListChange]);

  const handleOpenChange = (open: boolean) => {
    setOpen(open);
    if (open) {
      setRequestPermissionsState(true);
    }
  };

  const handleActiveDeviceChange = (deviceId: string) => {
    setActiveMediaDevice(deviceId);
    onActiveDeviceChange?.(deviceId);
  };

  const filteredDevices = useMemo(() => devices.filter((d) => d.deviceId !== ''), [devices]);

  if (filteredDevices.length < 2) {
    return null;
  }

  return (
    <Select
      open={open}
      value={activeDeviceId}
      onOpenChange={handleOpenChange}
      onValueChange={handleActiveDeviceChange}
    >
      <SelectTrigger className={cn(selectVariants({ size, variant }), props.className)}>
        {size !== 'sm' && (
          <SelectValue className="font-mono text-sm" placeholder={`Select a ${kind}`} />
        )}
      </SelectTrigger>
      <SelectContent>
        {filteredDevices.map((device) => (
          <SelectItem key={device.deviceId} value={device.deviceId} className="font-mono text-xs">
            {device.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export type AgentTrackControlProps = VariantProps<typeof toggleVariants> & {
  kind: MediaDeviceKind;
  source: Parameters<typeof useTrackToggle>[0]['source'];
  pressed?: boolean;
  pending?: boolean;
  disabled?: boolean;
  className?: string;
  audioTrack?: TrackReferenceOrPlaceholder;
  onPressedChange?: (pressed: boolean) => void;
  onMediaDeviceError?: (error: Error) => void;
  onActiveDeviceChange?: (deviceId: string) => void;
};

export function AgentTrackControl({
  kind,
  variant = 'default',
  source,
  pressed,
  pending,
  disabled,
  className,
  audioTrack,
  onPressedChange,
  onMediaDeviceError,
  onActiveDeviceChange,
}: AgentTrackControlProps) {
  return (
    <div
      className={cn(
        'flex items-center gap-0 rounded-md',
        variant === 'outline' && 'shadow-xs [&_button]:shadow-none',
        className,
      )}
    >
      <AgentTrackToggle
        variant={variant ?? 'default'}
        source={source}
        pressed={pressed}
        pending={pending}
        disabled={disabled}
        onPressedChange={onPressedChange}
        className="peer/track group/track has-[.audiovisualizer]:w-auto has-[.audiovisualizer]:px-3 has-[~_button]:rounded-r-none has-[~_button]:pr-2 has-[~_button]:pl-3 has-[~_button]:border-r-0 focus:z-10"
      >
        {audioTrack && (
          <AgentAudioVisualizerBar
            size="icon"
            barCount={3}
            audioTrack={audioTrack}
            className="audiovisualizer flex h-6 w-auto items-center justify-center gap-0.5"
          >
            <span
              className={cn([
                'h-full w-0.5 origin-center',
                'group-data-[state=on]/track:bg-foreground group-data-[state=off]/track:bg-destructive',
                'data-lk-muted:bg-muted',
              ])}
            />
          </AgentAudioVisualizerBar>
        )}
      </AgentTrackToggle>
      {kind && (
        <TrackDeviceSelect
          size="sm"
          kind={kind}
          variant={variant}
          requestPermissions={false}
          onMediaDeviceError={onMediaDeviceError}
          onActiveDeviceChange={onActiveDeviceChange}
          className={cn([
            'relative',
            'before:bg-border before:absolute before:inset-y-0 before:left-0 before:my-2.5 before:w-px has-[~_button]:before:content-[""]',
            !pressed && 'before:bg-destructive/20',
          ])}
        />
      )}
    </div>
  );
}
