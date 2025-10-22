import { useMemo } from 'react';
import { type VariantProps, cva } from 'class-variance-authority';
import { type LocalAudioTrack, type RemoteAudioTrack } from 'livekit-client';
import {
  type AgentState,
  type TrackReferenceOrPlaceholder,
  useMultibandTrackVolume,
} from '@livekit/components-react';
import { cn } from '@/lib/utils';
import { useBarAnimator } from './hooks/useBarAnimator';

export const audioBarVisualizerVariants = cva(['relative flex items-center justify-center'], {
  variants: {
    size: {
      icon: 'h-[24px] gap-[2px]',
      xs: 'h-[32px] gap-[2px]',
      sm: 'h-[56px] gap-[4px]',
      md: 'h-[112px] gap-[8px]',
      lg: 'h-[224px] gap-[16px]',
      xl: 'h-[448px] gap-[32px]',
    },
  },
  defaultVariants: {
    size: 'md',
  },
});

export const audioBarVisualizerBarVariants = cva(
  [
    'rounded-full transition-colors duration-250 ease-linear bg-(--audio-visualizer-idle) data-[lk-highlighted=true]:bg-(--audio-visualizer-active)',
  ],
  {
    variants: {
      size: {
        icon: 'w-[4px] min-h-[4px]',
        xs: 'w-[4px] min-h-[4px]',
        sm: 'w-[8px] min-h-[8px]',
        md: 'w-[16px] min-h-[16px]',
        lg: 'w-[32px] min-h-[32px]',
        xl: 'w-[64px] min-h-[64px]',
      },
    },
    defaultVariants: {
      size: 'md',
    },
  }
);

interface AudioBarVisualizerProps {
  state?: AgentState;
  barCount?: number;
  audioTrack?: LocalAudioTrack | RemoteAudioTrack | TrackReferenceOrPlaceholder;
  className?: string;
  barClassName?: string;
}

export function AudioBarVisualizer({
  size,
  state,
  barCount,
  audioTrack,
  className,
  barClassName,
}: AudioBarVisualizerProps & VariantProps<typeof audioBarVisualizerVariants>) {
  const _barCount = useMemo(() => {
    if (barCount) {
      return barCount;
    }
    switch (size) {
      case 'icon':
      case 'xs':
        return 3;
      default:
        return 5;
    }
  }, [barCount, size]);

  const volumeBands = useMultibandTrackVolume(audioTrack, {
    bands: _barCount,
    loPass: 100,
    hiPass: 200,
  });

  const sequencerInterval = useMemo(() => {
    switch (state) {
      case 'connecting':
        return 2000 / _barCount;
      case 'initializing':
        return 500;
      case 'listening':
        return 500;
      case 'thinking':
        return 150;
      default:
        return 1000;
    }
  }, [state, _barCount]);

  const highlightedIndices = useBarAnimator(state, _barCount, sequencerInterval);

  const bands = audioTrack ? volumeBands : new Array(_barCount).fill(0);
  return (
    <div className={cn(audioBarVisualizerVariants({ size }), className)}>
      {bands.map((band, idx) => (
        <div
          key={idx}
          data-lk-index={idx}
          data-lk-highlighted={highlightedIndices.includes(idx)}
          className={cn(audioBarVisualizerBarVariants({ size }), barClassName)}
          style={{ height: `${band * 100}%` }}
        />
      ))}
    </div>
  );
}
