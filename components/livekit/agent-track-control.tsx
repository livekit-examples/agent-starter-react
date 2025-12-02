'use client';

import { useEffect, useLayoutEffect, useMemo, useState } from 'react';
import { type VariantProps, cva } from 'class-variance-authority';
import { LocalAudioTrack, LocalVideoTrack } from 'livekit-client';
import {
  BarVisualizer,
  type TrackReferenceOrPlaceholder,
  useTrackToggle,
} from '@livekit/components-react';
import { useMaybeRoomContext, useMediaDeviceSelect } from '@livekit/components-react';
import { AgentTrackToggle, type toggleVariants } from '@/components/livekit/agent-track-toggle';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';

const selectVariants = cva(
  [
    'border-none pl-2 shadow-none !text-foreground',
    'bg-muted data-[state=on]:bg-muted hover:text-foreground',
    'peer-data-[state=off]/track:text-destructive peer-data-[state=off]/track:[&_svg]:!text-destructive',
    '[&_svg]:!opacity-100',
  ],
  {
    variants: {
      variant: {
        primary: [
          'text-destructive hover:text-foreground hover:bg-foreground/10 hover:data-[state=on]:bg-foreground/10',
          'dark:bg-muted dark:hover:bg-foreground/10 dark:hover:data-[state=on]:bg-foreground/10',
          '[&_svg]:!text-foreground hover:data-[state=on]:[&_svg]:!text-destructive',
        ],
        secondary: [
          'hover:bg-foreground/10 data-[state=on]:bg-blue-500/20 data-[state=on]:hover:bg-blue-500/30 data-[state=on]:text-blue-700',
          'dark:text-foreground dark:data-[state=on]:text-blue-300',
          '[&_svg]:!text-foreground',
        ],
      },
      size: {
        default: 'w-[180px]',
        sm: 'w-auto',
      },
    },
    defaultVariants: {
      variant: 'primary',
      size: 'default',
    },
  }
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
  variant = 'primary',
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

  // When the select opens, ensure that media devices are re-requested in case when they were last
  // requested, permissions were not granted
  useLayoutEffect(() => {
    if (open) {
      setRequestPermissionsState(true);
    }
  }, [open]);

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
      onOpenChange={setOpen}
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

interface AgentTrackControlProps extends VariantProps<typeof toggleVariants> {
  kind: MediaDeviceKind;
  source: Parameters<typeof useTrackToggle>[0]['source'];
  pressed?: boolean;
  pending?: boolean;
  disabled?: boolean;
  className?: string;
  audioTrackRef?: TrackReferenceOrPlaceholder;
  onPressedChange?: (pressed: boolean) => void;
  onMediaDeviceError?: (error: Error) => void;
  onActiveDeviceChange?: (deviceId: string) => void;
}

export function AgentTrackControl({
  kind,
  variant,
  source,
  pressed,
  pending,
  disabled,
  className,
  audioTrackRef,
  onPressedChange,
  onMediaDeviceError,
  onActiveDeviceChange,
}: AgentTrackControlProps) {
  return (
    <div className={cn('flex items-center gap-0', className)}>
      <AgentTrackToggle
        variant={variant}
        source={source}
        pressed={pressed}
        pending={pending}
        disabled={disabled}
        onPressedChange={onPressedChange}
        className="peer/track group/track has-[.audiovisualizer]:w-auto has-[.audiovisualizer]:px-3 has-[~_button]:rounded-r-none has-[~_button]:pr-2 has-[~_button]:pl-3"
      >
        {audioTrackRef && (
          <BarVisualizer
            barCount={3}
            track={audioTrackRef}
            options={{ minHeight: 5 }}
            className="audiovisualizer flex h-6 w-auto items-center justify-center gap-0.5"
          >
            <span
              className={cn([
                'h-full w-0.5 origin-center',
                'group-data-[state=on]/track:bg-foreground group-data-[state=off]/track:bg-destructive',
                'data-lk-muted:bg-muted',
              ])}
            />
          </BarVisualizer>
        )}
      </AgentTrackToggle>

      <TrackDeviceSelect
        size="sm"
        kind={kind}
        variant={variant}
        requestPermissions={false}
        onMediaDeviceError={onMediaDeviceError}
        onActiveDeviceChange={onActiveDeviceChange}
        className={cn([
          'relative',
          'before:bg-border before:absolute before:inset-y-0 before:-left-px before:my-2.5 before:w-px has-[~_button]:before:content-[""]',
          !pressed && 'before:bg-destructive/20',
        ])}
      />
    </div>
  );
}
