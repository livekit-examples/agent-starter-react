import { CSSProperties, type ReactNode, memo, useMemo } from 'react';
import { type VariantProps, cva } from 'class-variance-authority';
import { LocalAudioTrack, RemoteAudioTrack } from 'livekit-client';
import {
  type AgentState,
  type TrackReferenceOrPlaceholder,
  useMultibandTrackVolume,
} from '@livekit/components-react';
import { cloneSingleChild, cn } from '@/lib/utils';
import { type Coordinate, useGridAnimator } from './hooks/useGridAnimator';

export const audioGridVisualizerVariants = cva(
  [
    'grid',
    '[&_>_*]:size-1 [&_>_*]:rounded-full',
    '[&_>_*]:bg-foreground/10 [&_>_[data-lk-highlighted=true]]:bg-foreground [&_>_[data-lk-highlighted=true]]:scale-125 [&_>_[data-lk-highlighted=true]]:shadow-[0px_0px_10px_2px_rgba(255,255,255,0.4)]',
  ],
  {
    variants: {
      size: {
        icon: ['gap-[2px] [&_>_*]:size-[4px]'],
        sm: ['gap-[4px] [&_>_*]:size-[4px]'],
        md: ['gap-[8px] [&_>_*]:size-[8px]'],
        lg: ['gap-[8px] [&_>_*]:size-[8px]'],
        xl: ['gap-[8px] [&_>_*]:size-[8px]'],
      },
    },
    defaultVariants: {
      size: 'md',
    },
  }
);

export interface GridOptions {
  radius?: number;
  interval?: number;
  rowCount?: number;
  columnCount?: number;
  transformer?: (index: number, rowCount: number, columnCount: number) => CSSProperties;
  className?: string;
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
  size: VariantProps<typeof audioGridVisualizerVariants>['size'] = 'md',
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
    const isHighlighted = volumeBands[index % columnCount] >= threshold;

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

export type AudioGridVisualizerProps = GridOptions & {
  state: AgentState;
  audioTrack?: LocalAudioTrack | RemoteAudioTrack | TrackReferenceOrPlaceholder;
  className?: string;
  children?: ReactNode;
} & VariantProps<typeof audioGridVisualizerVariants>;

export function AudioGridVisualizer({
  size = 'md',
  state,
  radius,
  rowCount: _rowCount = 5,
  columnCount: _columnCount = 5,
  transformer,
  interval = 100,
  className,
  children,
  audioTrack,
}: AudioGridVisualizerProps) {
  const { columnCount, rowCount, items } = useGrid(size, _columnCount, _rowCount);
  const highlightedCoordinate = useGridAnimator(state, rowCount, columnCount, interval, radius);
  const volumeBands = useMultibandTrackVolume(audioTrack, {
    bands: columnCount,
    loPass: 100,
    hiPass: 200,
  });

  return (
    <div
      className={cn(audioGridVisualizerVariants({ size }), className)}
      style={{ gridTemplateColumns: `repeat(${columnCount}, 1fr)` }}
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
