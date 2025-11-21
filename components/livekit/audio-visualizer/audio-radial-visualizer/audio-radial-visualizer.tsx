import { ReactNode, useMemo } from 'react';
import { type VariantProps, cva } from 'class-variance-authority';
import { type LocalAudioTrack, type RemoteAudioTrack } from 'livekit-client';
import {
  type AgentState,
  type TrackReferenceOrPlaceholder,
  useMultibandTrackVolume,
} from '@livekit/components-react';
import { cloneSingleChild, cn } from '@/lib/utils';
import { useBarAnimator } from './hooks/useBarAnimator';

export const audioRadialVisualizerVariants = cva(
  [
    'relative flex items-center justify-center',
    '[&_[data-lk-index]]:absolute [&_[data-lk-index]]:top-1/2 [&_[data-lk-index]]:left-1/2 [&_[data-lk-index]]:origin-bottom [&_[data-lk-index]]:-translate-x-1/2',
    '[&_[data-lk-index]]:rounded-full [&_[data-lk-index]]:transition-colors [&_[data-lk-index]]:duration-250 [&_[data-lk-index]]:ease-linear [&_[data-lk-index]]:bg-(--audio-visualizer-idle) [&_[data-lk-index]]:data-[lk-highlighted=true]:bg-(--audio-visualizer-active)',
  ],
  {
    variants: {
      size: {
        icon: ['h-[24px] gap-[2px]', '[&_[data-lk-index]]:w-[4px] [&_[data-lk-index]]:min-h-[4px]'],
        sm: ['h-[56px] gap-[4px]', '[&_[data-lk-index]]:w-[8px] [&_[data-lk-index]]:min-h-[8px]'],
        md: [
          'h-[112px] gap-[8px]',
          '[&_[data-lk-index]]:w-[16px] [&_[data-lk-index]]:min-h-[16px]',
        ],
        lg: [
          'h-[224px] gap-[16px]',
          '[&_[data-lk-index]]:w-[32px] [&_[data-lk-index]]:min-h-[32px]',
        ],
        xl: [
          'h-[448px] gap-[32px]',
          '[&_[data-lk-index]]:w-[64px] [&_[data-lk-index]]:min-h-[64px]',
        ],
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
  children?: ReactNode;
}

export function AudioRadialVisualizer({
  size,
  state,
  radius,
  barCount,
  audioTrack,
  className,
  children,
}: AudioRadialVisualizerProps & VariantProps<typeof audioRadialVisualizerVariants>) {
  const _barCount = useMemo(() => {
    if (barCount) {
      return barCount;
    }
    switch (size) {
      case 'icon':
      case 'sm':
        return 8;
      default:
        return 12;
    }
  }, [barCount, size]);

  const volumeBands = useMultibandTrackVolume(audioTrack, {
    bands: Math.ceil(_barCount / 2),
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
  const bands = audioTrack
    ? [...volumeBands, ...volumeBands].slice(0, _barCount)
    : new Array(_barCount).fill(0);

  return (
    <div className={cn(audioRadialVisualizerVariants({ size }), 'relative', className)}>
      {bands.map((band, idx) => {
        const angle = (idx / _barCount) * Math.PI * 2;

        return (
          <div
            key={idx}
            className="absolute top-1/2 left-1/2 h-1 w-1 -translate-x-1/2 -translate-y-1/2"
            style={{
              transformOrigin: 'center',
              transform: `rotate(${angle}rad) translateY(${distanceFromCenter}px)`,
            }}
          >
            {children ? (
              cloneSingleChild(children, {
                key: idx,
                'data-lk-index': idx,
                'data-lk-highlighted': highlightedIndices.includes(idx),
              })
            ) : (
              <div
                data-lk-index={idx}
                data-lk-highlighted={highlightedIndices.includes(idx)}
                style={{ height: `${band * distanceFromCenter * 2}px` }}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
