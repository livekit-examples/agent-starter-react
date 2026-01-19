'use client';

import React, {
  type CSSProperties,
  Children,
  type ComponentProps,
  type ReactNode,
  cloneElement,
  isValidElement,
  memo,
  useMemo,
} from 'react';
import { type VariantProps, cva } from 'class-variance-authority';
import { LocalAudioTrack, RemoteAudioTrack } from 'livekit-client';
import {
  type AgentState,
  type TrackReferenceOrPlaceholder,
  useMultibandTrackVolume,
} from '@livekit/components-react';
import {
  type Coordinate,
  useAgentAudioVisualizerGridAnimator,
} from '@/hooks/agents-ui/use-agent-audio-visualizer-grid';
import { cn } from '@/lib/shadcn/utils';

function cloneSingleChild(
  children: ReactNode | ReactNode[],
  props?: Record<string, unknown>,
  key?: unknown
) {
  return Children.map(children, (child) => {
    // Checking isValidElement is the safe way and avoids a typescript error too.
    if (isValidElement(child) && Children.only(children)) {
      const childProps = child.props as Record<string, unknown>;
      if (childProps.className) {
        // make sure we retain classnames of both passed props and child
        props ??= {};
        props.className = cn(childProps.className as string, props.className as string);
        props.style = {
          ...(childProps.style as CSSProperties),
          ...(props.style as CSSProperties),
        };
      }
      return cloneElement(child, { ...props, key: key ? String(key) : undefined });
    }
    return child;
  });
}

export const AgentAudioVisualizerGridVariants = cva(
  [
    'grid',
    '*:size-1 *:rounded-full',
    '*:bg-foreground/10 [&_>_[data-lk-highlighted=true]]:bg-foreground [&_>_[data-lk-highlighted=true]]:scale-125 [&_>_[data-lk-highlighted=true]]:shadow-[0px_0px_10px_2px_rgba(255,255,255,0.4)]',
  ],
  {
    variants: {
      size: {
        icon: ['gap-[2px] *:size-[4px]'],
        sm: ['gap-[4px] *:size-[4px]'],
        md: ['gap-[8px] *:size-[8px]'],
        lg: ['gap-[8px] *:size-[8px]'],
        xl: ['gap-[8px] *:size-[8px]'],
      },
    },
    defaultVariants: {
      size: 'md',
    },
  }
);

/**
 * Configuration options for the grid visualizer.
 */
export interface GridOptions {
  /**
   * The radius for the animation spread effect.
   */
  radius?: number;
  /**
   * The interval in milliseconds between animation frames.
   * @defaultValue 100
   */
  interval?: number;
  /**
   * The number of rows in the grid.
   * @defaultValue 5
   */
  rowCount?: number;
  /**
   * The number of columns in the grid.
   * @defaultValue 5
   */
  columnCount?: number;
  /**
   * A function to transform the style of each grid cell based on its position.
   * Receives the cell index, row count, and column count as arguments.
   */
  transformer?: (index: number, rowCount: number, columnCount: number) => CSSProperties;
  /**
   * Additional CSS class names to apply to the container.
   */
  className?: string;
  /**
   * Custom children to render as grid cells.
   */
  children?: ReactNode;
}

const sizeDefaults = {
  icon: 3,
  sm: 5,
  md: 5,
  lg: 5,
  xl: 5,
};

function useGrid(
  size: VariantProps<typeof AgentAudioVisualizerGridVariants>['size'] = 'md',
  columnCount = sizeDefaults[size as keyof typeof sizeDefaults],
  rowCount = sizeDefaults[size as keyof typeof sizeDefaults]
) {
  return useMemo(() => {
    const _columnCount = columnCount;
    const _rowCount = rowCount ?? columnCount;
    const items = new Array(_columnCount * _rowCount).fill(0).map((_, idx) => idx);

    return { columnCount: _columnCount, rowCount: _rowCount, items };
  }, [columnCount, rowCount]);
}

interface GridCellProps {
  index: number;
  state: AgentState;
  interval: number;
  transformer?: (index: number, rowCount: number, columnCount: number) => CSSProperties;
  rowCount: number;
  columnCount: number;
  volumeBands: number[];
  highlightedCoordinate: Coordinate;
  children: ReactNode;
}

const GridCell = memo(function GridCell({
  index,
  state,
  interval,
  transformer,
  rowCount,
  columnCount,
  volumeBands,
  highlightedCoordinate,
  children,
}: GridCellProps) {
  if (state === 'speaking') {
    const y = Math.floor(index / columnCount);
    const rowMidPoint = Math.floor(rowCount / 2);
    const volumeChunks = 1 / (rowMidPoint + 1);
    const distanceToMid = Math.abs(rowMidPoint - y);
    const threshold = distanceToMid * volumeChunks;
    const isHighlighted = (volumeBands[index % columnCount] ?? 0) >= threshold;

    return cloneSingleChild(children, {
      'data-lk-index': index,
      'data-lk-highlighted': isHighlighted,
    });
  }

  let transformerStyle: CSSProperties | undefined;
  if (transformer) {
    transformerStyle = transformer(index, rowCount, columnCount);
  }

  const isHighlighted =
    highlightedCoordinate.x === index % columnCount &&
    highlightedCoordinate.y === Math.floor(index / columnCount);

  const transitionDurationInSeconds = interval / (isHighlighted ? 1000 : 100);

  return cloneSingleChild(children, {
    'data-lk-index': index,
    'data-lk-highlighted': isHighlighted,
    style: {
      transitionProperty: 'all',
      transitionDuration: `${transitionDurationInSeconds}s`,
      transitionTimingFunction: 'ease-out',
      ...transformerStyle,
    },
  });
});

/**
 * Props for the AgentAudioVisualizerGrid component.
 */
export type AgentAudioVisualizerGridProps = GridOptions & {
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
   * The audio track to visualize. Can be a local/remote audio track or a track reference.
   */
  audioTrack?: LocalAudioTrack | RemoteAudioTrack | TrackReferenceOrPlaceholder;
  /**
   * Additional CSS class names to apply to the container.
   */
  className?: string;
  /**
   * Custom children to render as grid cells. Each child receives data-lk-index
   * and data-lk-highlighted props.
   */
  children?: ReactNode;
} & VariantProps<typeof AgentAudioVisualizerGridVariants>;

/**
 * A grid-style audio visualizer that responds to agent state and audio levels.
 * Displays an animated grid of cells that react to the current agent state
 * and audio volume when speaking.
 *
 * @extends ComponentProps<'div'>
 *
 * @example
 * ```tsx
 * <AgentAudioVisualizerGrid
 *   size="md"
 *   state="speaking"
 *   rowCount={5}
 *   columnCount={5}
 *   audioTrack={agentAudioTrack}
 * />
 * ```
 */
export function AgentAudioVisualizerGrid({
  size = 'md',
  state = 'connecting',
  radius,
  rowCount: _rowCount = 5,
  columnCount: _columnCount = 5,
  transformer,
  interval = 100,
  className,
  children,
  audioTrack,
  style,
  ...props
}: AgentAudioVisualizerGridProps & ComponentProps<'div'>) {
  const { columnCount, rowCount, items } = useGrid(size, _columnCount, _rowCount);
  const highlightedCoordinate = useAgentAudioVisualizerGridAnimator(
    state,
    rowCount,
    columnCount,
    interval,
    radius
  );
  const volumeBands = useMultibandTrackVolume(audioTrack, {
    bands: columnCount,
    loPass: 100,
    hiPass: 200,
  });

  return (
    <div
      className={cn(AgentAudioVisualizerGridVariants({ size }), className)}
      style={{ ...style, gridTemplateColumns: `repeat(${columnCount}, 1fr)` }}
      {...props}
    >
      {items.map((idx) => (
        <GridCell
          key={idx}
          index={idx}
          state={state}
          interval={interval}
          transformer={transformer}
          rowCount={rowCount}
          columnCount={columnCount}
          volumeBands={volumeBands}
          highlightedCoordinate={highlightedCoordinate}
        >
          {children ?? <div />}
        </GridCell>
      ))}
    </div>
  );
}
