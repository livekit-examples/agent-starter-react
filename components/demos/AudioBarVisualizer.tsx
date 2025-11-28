import { useMemo, useState } from 'react';
import { type VariantProps } from 'class-variance-authority';
import { Track } from 'livekit-client';
import {
  type AgentState,
  type TrackReference,
  type TrackReferenceOrPlaceholder,
  useLocalParticipant,
} from '@livekit/components-react';
import { Container } from '@/components/docs/container';
import {
  AudioBarVisualizer,
  audioBarVisualizerVariants,
} from '@/components/livekit/audio-visualizer/audio-bar-visualizer/audio-bar-visualizer';
import { Button } from '@/components/livekit/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/livekit/select';
import { useMicrophone } from '@/hooks/useMicrophone';

type audioBarVisualizerVariantsSizeType = VariantProps<typeof audioBarVisualizerVariants>['size'];

export default function AudioBarVisualizerDemo() {
  const barCounts = ['0', '3', '5', '7', '9'];
  const sizes = ['icon', 'sm', 'md', 'lg', 'xl'];
  const states = [
    'disconnected',
    'connecting',
    'initializing',
    'listening',
    'thinking',
    'speaking',
  ] as AgentState[];

  const { microphoneTrack, localParticipant } = useLocalParticipant();
  const [barCount, setBarCount] = useState<string>(barCounts[0]);
  const [size, setSize] = useState<audioBarVisualizerVariantsSizeType>(
    'md' as audioBarVisualizerVariantsSizeType
  );
  const [state, setState] = useState<AgentState>(states[0]);

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

  return (
    <Container componentName="AudioVisualizer">
      <div className="flex items-center gap-2">
        <div className="flex-1">
          <label className="font-mono text-xs uppercase" htmlFor="size">
            Size
          </label>
          <Select
            value={size as string}
            onValueChange={(value) => setSize(value as audioBarVisualizerVariantsSizeType)}
          >
            <SelectTrigger id="size" className="w-full">
              <SelectValue placeholder="Select a size" />
            </SelectTrigger>
            <SelectContent>
              {sizes.map((size) => (
                <SelectItem key={size} value={size as string}>
                  {size.toUpperCase()}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex-1">
          <label className="font-mono text-xs uppercase" htmlFor="barCount">
            Bar count
          </label>
          <Select value={barCount.toString()} onValueChange={(value) => setBarCount(value)}>
            <SelectTrigger id="barCount" className="w-full">
              <SelectValue placeholder="Select a bar count" />
            </SelectTrigger>
            <SelectContent>
              {barCounts.map((barCount) => (
                <SelectItem key={barCount} value={barCount.toString()}>
                  {parseInt(barCount) || 'Default'}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="relative flex flex-col justify-center gap-4">
        <div className="grid place-items-center py-8">
          <AudioBarVisualizer
            size={size as audioBarVisualizerVariantsSizeType}
            state={state}
            audioTrack={micTrackRef!}
            barCount={parseInt(barCount) || undefined}
            className="mx-auto"
          >
            <div className="data-[lk-highlighted=true]:!bg-primary rounded-full" />
          </AudioBarVisualizer>
        </div>
        {/* <details>
          <summary className="text-muted-foreground font-mono text-xs uppercase">
            <span className="inline-block cursor-pointer p-1">Original BarVisualizer</span>
          </summary>
          <div className="border-border grid place-items-center rounded-xl border p-4 py-8">
            <BarVisualizer
              size={size as audioBarVisualizerVariantsSizeType}
              state={state}
              audioTrack={micTrackRef!}
              barCount={parseInt(barCount) || undefined}
              className="mx-auto"
            />
          </div>
        </details> */}
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
    </Container>
  );
}
