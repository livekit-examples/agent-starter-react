'use client';

import { cva } from 'class-variance-authority';
import { LocalAudioTrack, LocalVideoTrack } from 'livekit-client';
import { useMaybeRoomContext, useMediaDeviceSelect } from '@livekit/components-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';

type DeviceSelectProps = React.ComponentProps<typeof SelectTrigger> & {
  kind: MediaDeviceKind;
  track?: LocalAudioTrack | LocalVideoTrack | undefined;
  requestPermissions?: boolean;
  onMediaDeviceError?: (error: Error) => void;
  initialSelection?: string;
  onActiveDeviceChange?: (deviceId: string) => void;
  onDeviceListChange?: (devices: MediaDeviceInfo[]) => void;
  variant?: 'default' | 'small';
};

const selectVariants = cva(
  [
    'w-full rounded-full px-3 py-2 text-sm cursor-pointer',
    'disabled:not-allowed hover:bg-button-hover focus:bg-button-hover',
  ],
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

export function DeviceSelect({
  kind,
  track,
  requestPermissions,
  onMediaDeviceError,
  // initialSelection,
  // onActiveDeviceChange,
  // onDeviceListChange,
  ...props
}: DeviceSelectProps) {
  const size = props.size || 'default';

  const room = useMaybeRoomContext();
  const { devices, activeDeviceId, setActiveMediaDevice } = useMediaDeviceSelect({
    kind,
    room,
    track,
    requestPermissions,
    onError: onMediaDeviceError,
  });
  return (
    <Select value={activeDeviceId} onValueChange={setActiveMediaDevice}>
      <SelectTrigger className={cn(selectVariants({ size }), props.className)}>
        {size !== 'sm' && (
          <SelectValue className="font-mono text-sm" placeholder={`Select a ${kind}`} />
        )}
      </SelectTrigger>
      <SelectContent>
        {devices.map((device) => (
          <SelectItem key={device.deviceId} value={device.deviceId} className="font-mono text-xs">
            {device.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
