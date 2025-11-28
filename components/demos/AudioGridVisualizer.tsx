import { useMemo, useState } from 'react';
import { Track } from 'livekit-client';
import { useLocalParticipant } from '@livekit/components-react';
import {
  type AgentState,
  type TrackReference,
  type TrackReferenceOrPlaceholder,
} from '@livekit/components-react';
import { Container } from '@/components/docs/container';
import { StoryTitle } from '@/components/docs/story-title';
import { AudioGridVisualizer } from '@/components/livekit/audio-visualizer/audio-grid-visualizer/audio-grid-visualizer';
import { type GridOptions } from '@/components/livekit/audio-visualizer/audio-grid-visualizer/audio-grid-visualizer';
import { gridVariants } from '@/components/livekit/audio-visualizer/audio-grid-visualizer/demos';
import { Button } from '@/components/livekit/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/livekit/select';
import { useMicrophone } from '@/hooks/useMicrophone';

export default function AudioGridVisualizerDemo() {
  const rowCounts = ['3', '5', '7', '9', '11', '13', '15'];
  const columnCounts = ['3', '5', '7', '9', '11', '13', '15'];
  const states = [
    'disconnected',
    'connecting',
    'initializing',
    'listening',
    'thinking',
    'speaking',
  ] as AgentState[];

  const [rowCount, setRowCount] = useState(rowCounts[0]);
  const [columnCount, setColumnCount] = useState(columnCounts[0]);
  const [state, setState] = useState<AgentState>(states[0]);
  const [demoIndex, setDemoIndex] = useState(0);
  const { microphoneTrack, localParticipant } = useLocalParticipant();

  const micTrackRef = useMemo<TrackReferenceOrPlaceholder | undefined>(() => {
    return state === 'speaking'
      ? ({
          participant: localParticipant,
          source: Track.Source.Microphone,
          publication: microphoneTrack,
        } as TrackReference)
      : undefined;
  }, [state, localParticipant, microphoneTrack]);

  useMicrophone();

  const demoOptions = {
    rowCount: parseInt(rowCount),
    columnCount: parseInt(columnCount),
    ...gridVariants[demoIndex],
  };

  return (
    <Container componentName="AudioVisualizer">
      <div className="flex items-center gap-2">
        <div className="flex-1">
          <label className="font-mono text-xs uppercase" htmlFor="rowCount">
            Row count
          </label>
          <Select value={rowCount.toString()} onValueChange={(value) => setRowCount(value)}>
            <SelectTrigger id="rowCount" className="w-full">
              <SelectValue placeholder="Select a bar count" />
            </SelectTrigger>
            <SelectContent>
              {rowCounts.map((rowCount) => (
                <SelectItem key={rowCount} value={rowCount.toString()}>
                  {parseInt(rowCount) || 'Default'}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex-1">
          <label className="font-mono text-xs uppercase" htmlFor="columnCount">
            Column count
          </label>
          <Select value={columnCount.toString()} onValueChange={(value) => setColumnCount(value)}>
            <SelectTrigger id="columnCount" className="w-full">
              <SelectValue placeholder="Select a column count" />
            </SelectTrigger>
            <SelectContent>
              {columnCounts.map((columnCount) => (
                <SelectItem key={columnCount} value={columnCount.toString()}>
                  {parseInt(columnCount) || 'Default'}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex-1">
          <label className="font-mono text-xs uppercase" htmlFor="demoIndex">
            Demo
          </label>
          <Select
            value={demoIndex.toString()}
            onValueChange={(value) => setDemoIndex(parseInt(value))}
          >
            <SelectTrigger id="demoIndex" className="w-full">
              <SelectValue placeholder="Select a demo" />
            </SelectTrigger>
            <SelectContent>
              {gridVariants.map((_, idx) => (
                <SelectItem key={idx} value={idx.toString()}>
                  Demo {String(idx + 1)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid place-items-center py-12">
        <AudioGridVisualizer
          key={`${demoIndex}-${rowCount}-${columnCount}`}
          state={state}
          audioTrack={micTrackRef!}
          {...(demoOptions as GridOptions)}
        />
      </div>

      <div className="flex flex-wrap gap-4">
        {states.map((stateType) => (
          <Button
            key={stateType}
            size="sm"
            variant={state === stateType ? 'primary' : 'default'}
            onClick={() => setState(stateType)}
            className={'flex-1'}
          >
            {stateType}
          </Button>
        ))}
      </div>

      <div>
        <StoryTitle>Demo options</StoryTitle>
        <div className="border-border bg-muted overflow-x-auto rounded-xl border p-8">
          <pre className="text-muted-foreground text-sm">
            <code>{JSON.stringify(demoOptions, null, 2)}</code>
          </pre>
        </div>
      </div>
    </Container>
  );
}
