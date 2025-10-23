import { useEffect, useMemo, useRef } from 'react';
import { type VariantProps, cva } from 'class-variance-authority';
import {
  type AgentState,
  BarVisualizer as LiveKitBarVisualizer,
  type TrackReferenceOrPlaceholder,
} from '@livekit/components-react';
import { cn } from '@/lib/utils';

const MIN_HEIGHT = 15; // 15%

export const barVisualizerVariants = cva(
  ['relative flex aspect-square h-36 items-center justify-center'],
  {
    variants: {
      size: {
        default: 'h-32',
        icon: 'h-6',
        xs: 'h-8',
        sm: 'h-16',
        md: 'h-32',
        lg: 'h-64',
        xl: 'h-96',
        '2xl': 'h-128',
      },
    },
    defaultVariants: {
      size: 'default',
    },
  }
);

interface BarVisualizerProps {
  state?: AgentState;
  barCount?: number;
  audioTrack?: TrackReferenceOrPlaceholder;
  className?: string;
}

export function BarVisualizer({
  size,
  state,
  barCount,
  audioTrack,
  className,
}: BarVisualizerProps & VariantProps<typeof barVisualizerVariants>) {
  const ref = useRef<HTMLDivElement>(null);
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

  const x = (1 / (_barCount + (_barCount + 1) / 2)) * 100;

  // reset bars height when audio track is disconnected
  useEffect(() => {
    if (ref.current && !audioTrack) {
      const bars = [...(ref.current.querySelectorAll('& > span') ?? [])] as HTMLElement[];

      bars.forEach((bar) => {
        bar.style.height = `${MIN_HEIGHT}%`;
      });
    }
  }, [audioTrack]);

  return (
    <LiveKitBarVisualizer
      ref={ref}
      barCount={_barCount}
      state={state}
      trackRef={audioTrack}
      options={{ minHeight: x }}
      className={cn(barVisualizerVariants({ size }), className)}
      style={{
        gap: `${x / 2}%`,
      }}
    >
      <span
        className={cn([
          'bg-muted rounded-full',
          'origin-center transition-colors duration-250 ease-linear',
          'data-[lk-highlighted=true]:bg-foreground data-[lk-muted=true]:bg-muted',
        ])}
        style={{
          minHeight: `${x}%`,
          width: `${x}%`,
        }}
      />
    </LiveKitBarVisualizer>
  );
}
