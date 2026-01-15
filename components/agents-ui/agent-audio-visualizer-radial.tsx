'use client';

import { type ComponentProps, useMemo } from 'react';
import { type VariantProps, cva } from 'class-variance-authority';
import { type LocalAudioTrack, type RemoteAudioTrack } from 'livekit-client';
import {
  type AgentState,
  type TrackReferenceOrPlaceholder,
  useMultibandTrackVolume,
} from '@livekit/components-react';
import { useAgentAudioVisualizerRadialAnimator } from '@/hooks/agents-ui/use-agent-audio-visualizer-radial';
import { cn } from '@/lib/shadcn/utils';

export const AgentAudioVisualizerRadialVariants = cva(
  [
    'relative flex items-center justify-center',
    '[&_[data-lk-index]]:absolute [&_[data-lk-index]]:top-1/2 [&_[data-lk-index]]:left-1/2 [&_[data-lk-index]]:origin-bottom [&_[data-lk-index]]:-translate-x-1/2',
    '[&_[data-lk-index]]:rounded-full [&_[data-lk-index]]:transition-colors [&_[data-lk-index]]:duration-150 [&_[data-lk-index]]:ease-linear [&_[data-lk-index]]:bg-transparent [&_[data-lk-index]]:data-[lk-highlighted=true]:bg-current',
    'has-data-[lk-state=connecting]:[&_[data-lk-index]]:duration-300 has-data-[lk-state=connecting]:[&_[data-lk-index]]:bg-current/10',
    'has-data-[lk-state=initializing]:[&_[data-lk-index]]:duration-300 has-data-[lk-state=initializing]:[&_[data-lk-index]]:bg-current/10',
    'has-data-[lk-state=listening]:[&_[data-lk-index]]:duration-300 has-data-[lk-state=listening]:[&_[data-lk-index]]:bg-current/10 has-data-[lk-state=listening]:[&_[data-lk-index]]:duration-300',
    'has-data-[lk-state=thinking]:animate-spin has-data-[lk-state=thinking]:[animation-duration:5s] has-data-[lk-state=thinking]:[&_[data-lk-index]]:bg-current',
  ],
  {
    variants: {
      size: {
        icon: ['h-[24px] gap-[2px]'],
        sm: ['h-[56px] gap-[4px]'],
        md: ['h-[112px] gap-[8px]'],
        lg: ['h-[224px] gap-[16px]'],
        xl: ['h-[448px] gap-[32px]'],
      },
    },
    defaultVariants: {
      size: 'md',
    },
  }
);

/**
 * Props for the AgentAudioVisualizerRadial component.
 */
export interface AgentAudioVisualizerRadialProps {
  /**
   * The size of the visualizer.
   * @defaultValue 'md'
   */
  size?: 'icon' | 'sm' | 'md' | 'lg' | 'xl';
  /**
   * The current state of the agent. Determines the animation pattern.
   * @defaultValue 'connecting'
   */
  state?: AgentState;
  /**
   * The radius (distance from center) for the radial bars.
   * If not provided, defaults based on size.
   */
  radius?: number;
  /**
   * The number of bars to display around the circle.
   * Should be divisible by 4 for optimal visual results.
   * If not provided, defaults to 12 for 'icon'/'sm', 24 for others.
   */
  barCount?: number;
  /**
   * The audio track to visualize. Can be a local/remote audio track or a track reference.
   */
  audioTrack?: LocalAudioTrack | RemoteAudioTrack | TrackReferenceOrPlaceholder;
  /**
   * Additional CSS class names to apply to the container.
   */
  className?: string;
}

/**
 * A radial (circular) audio visualizer that responds to agent state and audio levels.
 * Displays animated bars arranged in a circle that react to the current agent state
 * and audio volume when speaking.
 *
 * @extends ComponentProps<'div'>
 *
 * @example
 * ```tsx
 * <AgentAudioVisualizerRadial
 *   size="lg"
 *   state="speaking"
 *   barCount={24}
 *   audioTrack={agentAudioTrack}
 * />
 * ```
 */
export function AgentAudioVisualizerRadial({
  size = 'md',
  state = 'connecting',
  radius,
  barCount,
  audioTrack,
  className,
  ...props
}: AgentAudioVisualizerRadialProps &
  ComponentProps<'div'> &
  VariantProps<typeof AgentAudioVisualizerRadialVariants>) {
  const _barCount = useMemo(() => {
    if (barCount) {
      return barCount;
    }
    switch (size) {
      case 'icon':
      case 'sm':
        return 12;
      default:
        return 24;
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
      case 'listening':
        return 500;
      case 'initializing':
        return 250;
      case 'thinking':
        return Infinity;
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

  if (_barCount % 4 !== 0) {
    console.warn('barCount should be divisible by 4 for optimal visual results');
  }

  const highlightedIndices = useAgentAudioVisualizerRadialAnimator(
    state,
    _barCount,
    sequencerInterval
  );
  const bands = useMemo(
    () => (audioTrack ? volumeBands : new Array(_barCount).fill(0)),
    [audioTrack, volumeBands, _barCount]
  );

  const dotSize = useMemo(() => {
    return (distanceFromCenter * Math.PI) / _barCount;
  }, [distanceFromCenter, _barCount]);

  return (
    <div
      className={cn(AgentAudioVisualizerRadialVariants({ size }), 'relative', className)}
      {...props}
    >
      {bands.map((band, idx) => {
        const angle = (idx / _barCount) * Math.PI * 2;

        return (
          <div
            key={`${_barCount}-${idx}`}
            data-lk-state={state}
            className="absolute top-1/2 left-1/2 h-1 w-1 -translate-x-1/2 -translate-y-1/2"
            style={{
              transformOrigin: 'center',
              transform: `rotate(${angle}rad) translateY(${distanceFromCenter}px)`,
            }}
          >
            <div
              data-lk-index={idx}
              data-lk-highlighted={highlightedIndices.includes(idx)}
              style={{
                width: dotSize,
                minHeight: dotSize,
                height: state === 'speaking' ? `${dotSize * 10 * band}px` : 0,
              }}
            />
          </div>
        );
      })}
    </div>
  );
}
