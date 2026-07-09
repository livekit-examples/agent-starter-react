'use client';

import { useEffect, useLayoutEffect, useMemo, useState } from 'react';
import { cva } from 'class-variance-authority';
import { LocalAudioTrack, LocalVideoTrack } from 'livekit-client';
import { useMaybeRoomContext, useMediaDeviceSelect } from '@livekit/components-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/livekit/select';
import { cn } from '@/lib/utils';

type DeviceSelectProps = React.ComponentProps<typeof SelectTrigger> & {
  kind: MediaDeviceKind;
  variant?: 'default' | 'small';
  track?: LocalAudioTrack | LocalVideoTrack | undefined;
  requestPermissions?: boolean;
  alwaysVisible?: boolean;
  onMediaDeviceError?: (error: Error) => void;
  onDeviceListChange?: (devices: MediaDeviceInfo[]) => void;
  onActiveDeviceChange?: (deviceId: string) => void;
};

const PERMISSION_PROMPT_DEVICE_VALUE = '__request_media_device_permission__';

const selectVariants = cva(
  'w-full rounded-full px-3 py-2 text-sm cursor-pointer disabled:not-allowed',
  {
    variants: {
      size: {
        default: 'w-[180px]',
        sm: 'w-auto',
      },
    },
    defaultVariants: {
      size: 'default',
    },
  }
);

export function TrackDeviceSelect({
  kind,
  track,
  size = 'default',
  requestPermissions = false,
  alwaysVisible = false,
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
    if (deviceId === PERMISSION_PROMPT_DEVICE_VALUE) {
      setRequestPermissionsState(true);
      return;
    }

    setActiveMediaDevice(deviceId);
    onActiveDeviceChange?.(deviceId);
  };

  const filteredDevices = useMemo(() => devices.filter((d) => d.deviceId !== ''), [devices]);

  if (!alwaysVisible && filteredDevices.length < 2) {
    return null;
  }

  const selectedDeviceId =
    activeDeviceId || filteredDevices[0]?.deviceId || PERMISSION_PROMPT_DEVICE_VALUE;

  return (
    <Select
      open={open}
      value={selectedDeviceId}
      onOpenChange={setOpen}
      onValueChange={handleActiveDeviceChange}
    >
      <SelectTrigger className={cn(selectVariants({ size }), props.className)}>
        {size !== 'sm' && (
          <SelectValue className="font-mono text-sm" placeholder={`Select a ${kind}`} />
        )}
      </SelectTrigger>
      <SelectContent>
        {filteredDevices.length === 0 && (
          <SelectItem value={PERMISSION_PROMPT_DEVICE_VALUE} className="font-mono text-xs">
            Allow {kind === 'audioinput' ? 'microphone' : 'camera'} access
          </SelectItem>
        )}
        {filteredDevices.map((device, index) => (
          <SelectItem key={device.deviceId} value={device.deviceId} className="font-mono text-xs">
            {device.label || getFallbackDeviceLabel(kind, index)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function getFallbackDeviceLabel(kind: MediaDeviceKind, index: number) {
  const label = kind === 'audioinput' ? 'Microphone' : kind === 'videoinput' ? 'Camera' : 'Device';

  return index === 0 ? `Default ${label.toLowerCase()}` : `${label} ${index + 1}`;
}
