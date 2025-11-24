import { useMemo, useState } from 'react';
import { type VariantProps } from 'class-variance-authority';
import { Track } from 'livekit-client';
import { useLocalParticipant } from '@livekit/components-react';
import {
  type AgentState,
  type TrackReference,
  type TrackReferenceOrPlaceholder,
} from '@livekit/components-react';
import { Container } from '@/components/docs/container';
import {
  AudioRadialVisualizer,
  audioRadialVisualizerVariants,
} from '@/components/livekit/audio-visualizer/audio-radial-visualizer/audio-radial-visualizer';
import { Button } from '@/components/livekit/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/livekit/select';
import { useMicrophone } from '@/hooks/useMicrophone';

type audioRadialVisualizerVariantsSizeType = VariantProps<
  typeof audioRadialVisualizerVariants
>['size'];

export default function AudioRadialVisualizerDemo() {
  const barCounts = ['0', '4', '8', '12', '16', '24'];
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
  const [size, setSize] = useState<audioRadialVisualizerVariantsSizeType>(
    'md' as audioRadialVisualizerVariantsSizeType
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
            onValueChange={(value) => setSize(value as audioRadialVisualizerVariantsSizeType)}
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
        <div className="grid place-items-center py-20">
          <AudioRadialVisualizer
            size={size as audioRadialVisualizerVariantsSizeType}
            state={state}
            audioTrack={micTrackRef!}
            barCount={parseInt(barCount) || undefined}
            className="mx-auto"
          />
        </div>
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
