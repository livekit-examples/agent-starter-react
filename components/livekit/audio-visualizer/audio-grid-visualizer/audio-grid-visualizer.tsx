import { CSSProperties, ComponentType, JSX, memo, useMemo } from 'react';
import { LocalAudioTrack, RemoteAudioTrack } from 'livekit-client';
import {
  type AgentState,
  type TrackReferenceOrPlaceholder,
  useMultibandTrackVolume,
} from '@livekit/components-react';
import { cn } from '@/lib/utils';
import { type Coordinate, useGridAnimator } from './hooks/useGridAnimator';

type GridComponentType =
  | ComponentType<{ style?: CSSProperties; className?: string }>
  | keyof JSX.IntrinsicElements;

export interface GridOptions {
  radius?: number;
  interval?: number;
  rowCount?: number;
  columnCount?: number;
  className?: string;
  baseClassName?: string;
  offClassName?: string;
  onClassName?: string;
  GridComponent?: GridComponentType;
  transformer?: (index: number, rowCount: number, columnCount: number) => CSSProperties;
}

function useGrid(options: GridOptions) {
  return useMemo(() => {
    const { columnCount = 5, rowCount } = options;

    const _columnCount = columnCount;
    const _rowCount = rowCount ?? columnCount;
    const items = new Array(_columnCount * _rowCount).fill(0).map((_, idx) => idx);

    return { columnCount: _columnCount, rowCount: _rowCount, items };
  }, [options]);
}

interface GridCellProps {
  index: number;
  state: AgentState;
  options: GridOptions;
  rowCount: number;
  volumeBands: number[];
  columnCount: number;
  highlightedCoordinate: Coordinate;
  Component: GridComponentType;
}

const GridCell = memo(function GridCell({
  index,
  state,
  options,
  rowCount,
  volumeBands,
  columnCount,
  highlightedCoordinate,
  Component,
}: GridCellProps) {
  const { interval = 100, baseClassName, onClassName, offClassName, transformer } = options;

  if (state === 'speaking') {
    const y = Math.floor(index / columnCount);
    const rowMidPoint = Math.floor(rowCount / 2);
    const volumeChunks = 1 / (rowMidPoint + 1);
    const distanceToMid = Math.abs(rowMidPoint - y);
    const threshold = distanceToMid * volumeChunks;
    const isOn = volumeBands[index % columnCount] >= threshold;

    return <Component className={cn(baseClassName, isOn ? onClassName : offClassName)} />;
  }

  let transformerStyle: CSSProperties | undefined;
  if (transformer) {
    transformerStyle = transformer(index, rowCount, columnCount);
  }

  const isOn =
    highlightedCoordinate.x === index % columnCount &&
    highlightedCoordinate.y === Math.floor(index / columnCount);

  const transitionDurationInSeconds = interval / (isOn ? 1000 : 100);

  return (
    <Component
      style={{
        transitionProperty: 'all',
        transitionDuration: `${transitionDurationInSeconds}s`,
        transitionTimingFunction: 'ease-out',
        ...transformerStyle,
      }}
      className={cn(baseClassName, isOn ? onClassName : offClassName)}
    />
  );
});

export interface AudioGridVisualizerProps {
  state: AgentState;
  options: GridOptions;
  audioTrack?: LocalAudioTrack | RemoteAudioTrack | TrackReferenceOrPlaceholder;
}

export function AudioGridVisualizer({ state, options, audioTrack }: AudioGridVisualizerProps) {
  const { radius, interval = 100, className, GridComponent = 'div' } = options;
  const { columnCount, rowCount, items } = useGrid(options);
  const highlightedCoordinate = useGridAnimator(state, rowCount, columnCount, interval, radius);
  const volumeBands = useMultibandTrackVolume(audioTrack, {
    bands: columnCount,
    loPass: 100,
    hiPass: 200,
  });

  return (
    <div
      className={cn('grid gap-1', className)}
      style={{ gridTemplateColumns: `repeat(${columnCount}, 1fr)` }}
    >
      {items.map((idx) => (
        <GridCell
          key={idx}
          index={idx}
          state={state}
          options={options}
          rowCount={rowCount}
          columnCount={columnCount}
          volumeBands={volumeBands}
          highlightedCoordinate={highlightedCoordinate}
          Component={GridComponent}
        />
      ))}
    </div>
  );
}
