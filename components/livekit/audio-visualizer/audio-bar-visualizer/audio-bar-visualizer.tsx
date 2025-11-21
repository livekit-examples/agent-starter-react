import { type ReactNode, useMemo } from 'react';
import { type VariantProps, cva } from 'class-variance-authority';
import { type LocalAudioTrack, type RemoteAudioTrack } from 'livekit-client';
import {
  type AgentState,
  type TrackReferenceOrPlaceholder,
  useMultibandTrackVolume,
} from '@livekit/components-react';
import { cloneSingleChild, cn } from '@/lib/utils';
import { useBarAnimator } from './hooks/useBarAnimator';

export const audioBarVisualizerVariants = cva(
  [
    'relative flex items-center justify-center',
    '[&_>_*]:rounded-full [&_>_*]:transition-colors [&_>_*]:duration-250 [&_>_*]:ease-linear',
    '[&_>_*]:bg-(--audio-visualizer-idle) [&_>_*]:data-[lk-highlighted=true]:bg-(--audio-visualizer-active)',
  ],
  {
    variants: {
      size: {
        icon: ['h-[24px] gap-[2px]', '[&_>_*]:w-[4px] [&_>_*]:min-h-[4px]'],
        sm: ['h-[56px] gap-[4px]', '[&_>_*]:w-[8px] [&_>_*]:min-h-[8px]'],
        md: ['h-[112px] gap-[8px]', '[&_>_*]:w-[16px] [&_>_*]:min-h-[16px]'],
        lg: ['h-[224px] gap-[16px]', '[&_>_*]:w-[32px] [&_>_*]:min-h-[32px]'],
        xl: ['h-[448px] gap-[32px]', '[&_>_*]:w-[64px] [&_>_*]:min-h-[64px]'],
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
  children?: ReactNode | ReactNode[];
}

export function AudioBarVisualizer({
  size,
  state,
  barCount,
  audioTrack,
  className,
  children,
}: AudioBarVisualizerProps & VariantProps<typeof audioBarVisualizerVariants>) {
  const _barCount = useMemo(() => {
    if (barCount) {
      return barCount;
    }
    switch (size) {
      case 'icon':
      case 'sm':
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
        return 2000;
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
      {bands.map((band, idx) =>
        children ? (
          cloneSingleChild(children, {
            key: idx,
            'data-lk-index': idx,
            'data-lk-highlighted': highlightedIndices.includes(idx),
            style: { height: `${band * 100}%` },
          })
        ) : (
          <div
            key={idx}
            data-lk-index={idx}
            data-lk-highlighted={highlightedIndices.includes(idx)}
            style={{ height: `${band * 100}%` }}
          />
        )
      )}
    </div>
  );
}
