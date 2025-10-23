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

export const audioRadialVisualizerVariants = cva(['relative flex items-center justify-center'], {
  variants: {
    size: {
      icon: 'h-[24px] gap-[2px]',
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

export const audioRadialVisualizerBarVariants = cva(
  [
    'rounded-full transition-colors duration-250 ease-linear bg-(--audio-visualizer-idle) data-[lk-highlighted=true]:bg-(--audio-visualizer-active)',
  ],
  {
    variants: {
      size: {
        icon: 'w-[4px] min-h-[4px]',
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

interface AudioRadialVisualizerProps {
  state?: AgentState;
  radius?: number;
  barCount?: number;
  audioTrack?: LocalAudioTrack | RemoteAudioTrack | TrackReferenceOrPlaceholder;
  className?: string;
  barClassName?: string;
}

export function AudioRadialVisualizer({
  size,
  state,
  radius,
  barCount,
  audioTrack,
  className,
  barClassName,
}: AudioRadialVisualizerProps & VariantProps<typeof audioRadialVisualizerVariants>) {
  const _barCount = useMemo(() => {
    if (barCount) {
      return barCount;
    }
    switch (size) {
      case 'icon':
      case 'sm':
        return 9;
      default:
        return 12;
    }
  }, [barCount, size]);

  const volumeBands = useMultibandTrackVolume(audioTrack, {
    bands: Math.floor(_barCount / 2),
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

  const distanceFromCenter = useMemo(() => {
    if (radius) {
      return radius;
    }
    switch (size) {
      case 'icon':
        return 6;
      case 'xl':
        return 128;
      case 'lg':
        return 64;
      case 'sm':
        return 16;
      case 'md':
      default:
        return 32;
    }
  }, [size, radius]);

  const highlightedIndices = useBarAnimator(state, _barCount, sequencerInterval);
  const bands = audioTrack ? [...volumeBands, ...volumeBands] : new Array(_barCount).fill(0);

  return (
    <div className={cn(audioRadialVisualizerVariants({ size }), 'relative', className)}>
      {bands.map((band, idx) => {
        const angle = (idx / _barCount) * Math.PI * 2;

        return (
          <div
            key={idx}
            className={cn('absolute top-1/2 left-1/2 h-1 w-1 -translate-x-1/2 -translate-y-1/2')}
            style={{
              transformOrigin: 'center',
              transform: `rotate(${angle}rad) translateY(${distanceFromCenter}px)`,
            }}
          >
            <div
              data-lk-index={idx}
              data-lk-highlighted={highlightedIndices.includes(idx)}
              className={cn(
                audioRadialVisualizerBarVariants({ size }),
                'absolute top-1/2 left-1/2 origin-bottom -translate-x-1/2',
                barClassName
              )}
              style={{ height: `${band * distanceFromCenter * 2}px` }}
            />
          </div>
        );
      })}
    </div>
  );
}
