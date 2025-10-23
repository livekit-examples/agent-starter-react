'use client';

import { useEffect, useMemo, useState } from 'react';
import { type VariantProps } from 'class-variance-authority';
import { Track } from 'livekit-client';
import {
  type AgentState,
  type TrackReference,
  type TrackReferenceOrPlaceholder,
  useLocalParticipant,
} from '@livekit/components-react';
import { MicrophoneIcon } from '@phosphor-icons/react/dist/ssr';
import { useSession } from '@/components/app/session-provider';
import { AgentControlBar } from '@/components/livekit/agent-control-bar/agent-control-bar';
import { TrackControl } from '@/components/livekit/agent-control-bar/track-control';
// import { TrackDeviceSelect } from '@/components/livekit/agent-control-bar/track-device-select';
// import { TrackToggle } from '@/components/livekit/agent-control-bar/track-toggle';
import { Alert, AlertDescription, AlertTitle, alertVariants } from '@/components/livekit/alert';
import { AlertToast } from '@/components/livekit/alert-toast';
import { BarVisualizer } from '@/components/livekit/audio-visualizer/audio-bar-visualizer/_bar-visualizer';
import {
  AudioBarVisualizer,
  audioBarVisualizerVariants,
} from '@/components/livekit/audio-visualizer/audio-bar-visualizer/audio-bar-visualizer';
import {
  AudioGridVisualizer,
  type GridOptions,
} from '@/components/livekit/audio-visualizer/audio-grid-visualizer/audio-grid-visualizer';
import { gridVariants } from '@/components/livekit/audio-visualizer/audio-grid-visualizer/demos';
import {
  AudioRadialVisualizer,
  audioRadialVisualizerVariants,
} from '@/components/livekit/audio-visualizer/audio-radial-visualizer/audio-radial-visualizer';
import { Button, buttonVariants } from '@/components/livekit/button';
import { ChatEntry } from '@/components/livekit/chat-entry';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/livekit/select';
import { ShimmerText } from '@/components/livekit/shimmer-text';
import { Toggle, toggleVariants } from '@/components/livekit/toggle';

type toggleVariantsType = VariantProps<typeof toggleVariants>['variant'];
type toggleVariantsSizeType = VariantProps<typeof toggleVariants>['size'];
type buttonVariantsType = VariantProps<typeof buttonVariants>['variant'];
type buttonVariantsSizeType = VariantProps<typeof buttonVariants>['size'];
type alertVariantsType = VariantProps<typeof alertVariants>['variant'];
type audioBarVisualizerVariantsSizeType = VariantProps<typeof audioBarVisualizerVariants>['size'];
type audioRadialVisualizerVariantsSizeType = VariantProps<
  typeof audioRadialVisualizerVariants
>['size'];

export function useMicrophone() {
  const { startSession } = useSession();
  const { localParticipant } = useLocalParticipant();

  useEffect(() => {
    startSession();
    localParticipant.setMicrophoneEnabled(true, undefined);
  }, [startSession, localParticipant]);
}

interface ContainerProps {
  componentName: string;
  children: React.ReactNode;
  className?: string;
}

function Container({ children, className }: ContainerProps) {
  return (
    <div className={className}>
      <div className="bg-background border-input space-y-4 rounded-3xl border p-8 drop-shadow-lg/5">
        {children}
      </div>
    </div>
  );
}

function StoryTitle({ children }: { children: React.ReactNode }) {
  return <h4 className="text-muted-foreground mb-2 font-mono text-xs uppercase">{children}</h4>;
}

export const COMPONENTS = {
  // Button
  Button: () => (
    <Container componentName="Button">
      <table className="w-full">
        <thead className="font-mono text-xs font-normal uppercase [&_th]:w-1/5 [&_th]:p-2 [&_th]:text-center [&_th]:font-normal">
          <tr>
            <th></th>
            <th>Small</th>
            <th>Default</th>
            <th>Large</th>
            <th>Icon</th>
          </tr>
        </thead>
        <tbody className="[&_td]:p-2 [&_td:not(:first-child)]:text-center">
          {['default', 'primary', 'secondary', 'outline', 'ghost', 'link', 'destructive'].map(
            (variant) => (
              <tr key={variant}>
                <td className="text-right font-mono text-xs font-normal uppercase">{variant}</td>
                {['sm', 'default', 'lg', 'icon'].map((size) => (
                  <td key={size}>
                    <Button
                      variant={variant as buttonVariantsType}
                      size={size as buttonVariantsSizeType}
                    >
                      {size === 'icon' ? <MicrophoneIcon size={16} weight="bold" /> : 'Button'}
                    </Button>
                  </td>
                ))}
              </tr>
            )
          )}
        </tbody>
      </table>
    </Container>
  ),

  // Toggle
  Toggle: () => (
    <Container componentName="Toggle">
      <table className="w-full">
        <thead className="font-mono text-xs font-normal uppercase [&_th]:w-1/5 [&_th]:p-2 [&_th]:text-center [&_th]:font-normal">
          <tr>
            <th></th>
            <th>Small</th>
            <th>Default</th>
            <th>Large</th>
            <th>Icon</th>
          </tr>
        </thead>
        <tbody className="[&_td]:p-2 [&_td:not(:first-child)]:text-center">
          {['default', 'primary', 'secondary', 'outline'].map((variant) => (
            <tr key={variant}>
              <td className="text-right font-mono text-xs font-normal uppercase">{variant}</td>
              {['sm', 'default', 'lg', 'icon'].map((size) => (
                <td key={size}>
                  <Toggle
                    size={size as toggleVariantsSizeType}
                    variant={variant as toggleVariantsType}
                  >
                    {size === 'icon' ? <MicrophoneIcon size={16} weight="bold" /> : 'Toggle'}
                  </Toggle>
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </Container>
  ),

  // Alert
  Alert: () => (
    <Container componentName="Alert">
      {['default', 'destructive'].map((variant) => (
        <div key={variant}>
          <StoryTitle>{variant}</StoryTitle>
          <Alert key={variant} variant={variant as alertVariantsType}>
            <AlertTitle>Alert {variant} title</AlertTitle>
            <AlertDescription>This is a {variant} alert description.</AlertDescription>
          </Alert>
        </div>
      ))}
    </Container>
  ),

  // Select
  Select: () => (
    <Container componentName="Select">
      <div className="grid w-full grid-cols-2 gap-2">
        <div>
          <StoryTitle>Size default</StoryTitle>
          <Select>
            <SelectTrigger>
              <SelectValue placeholder="Select a track" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1">Track 1</SelectItem>
              <SelectItem value="2">Track 2</SelectItem>
              <SelectItem value="3">Track 3</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <StoryTitle>Size sm</StoryTitle>
          <Select>
            <SelectTrigger size="sm">
              <SelectValue placeholder="Select a track" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1">Track 1</SelectItem>
              <SelectItem value="2">Track 2</SelectItem>
              <SelectItem value="3">Track 3</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
    </Container>
  ),

  // Audio bar visualizer
  AudioBarVisualizer: () => {
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
            <label className="font-mono text-xs uppercase" htmlFor="state">
              State
            </label>
            <Select value={state} onValueChange={(value) => setState(value as AgentState)}>
              <SelectTrigger id="state" className="w-full">
                <SelectValue placeholder="Select a state" />
              </SelectTrigger>
              <SelectContent>
                {states.map((state) => (
                  <SelectItem key={state} value={state}>
                    {state}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

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
            />
          </div>
          <div className="text-center">Original BarVisualizer</div>
          <div className="border-border grid place-items-center rounded-xl border p-4 py-8">
            <BarVisualizer
              size={size as audioBarVisualizerVariantsSizeType}
              state={state}
              audioTrack={micTrackRef!}
              barCount={parseInt(barCount) || undefined}
              className="mx-auto"
            />
          </div>
        </div>
      </Container>
    );
  },

  // Audio bar visualizer
  AudioRadialVisualizer: () => {
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
            <label className="font-mono text-xs uppercase" htmlFor="state">
              State
            </label>
            <Select value={state} onValueChange={(value) => setState(value as AgentState)}>
              <SelectTrigger id="state" className="w-full">
                <SelectValue placeholder="Select a state" />
              </SelectTrigger>
              <SelectContent>
                {states.map((state) => (
                  <SelectItem key={state} value={state}>
                    {state}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

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
              size={size as audioBarVisualizerVariantsSizeType}
              state={state}
              audioTrack={micTrackRef!}
              barCount={parseInt(barCount) || undefined}
              className="mx-auto"
            />
          </div>
        </div>
      </Container>
    );
  },

  // Audio bar visualizer
  AudioGridVisualizer: () => {
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

    const { microphoneTrack, localParticipant } = useLocalParticipant();
    const [rowCount, setRowCount] = useState(rowCounts[0]);
    const [columnCount, setColumnCount] = useState(columnCounts[0]);
    const [state, setState] = useState<AgentState>(states[0]);
    const [demoIndex, setDemoIndex] = useState(0);

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
            <label className="font-mono text-xs uppercase" htmlFor="state">
              State
            </label>
            <Select value={state} onValueChange={(value) => setState(value as AgentState)}>
              <SelectTrigger id="state" className="w-full">
                <SelectValue placeholder="Select a state" />
              </SelectTrigger>
              <SelectContent>
                {states.map((state) => (
                  <SelectItem key={state} value={state}>
                    {state}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

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
            options={demoOptions}
          />
        </div>
        <div className="border-border bg-muted overflow-x-auto rounded-xl border p-8">
          <pre className="text-muted-foreground text-sm">
            <code>{JSON.stringify(demoOptions, null, 2)}</code>
          </pre>
        </div>
      </Container>
    );
  },

  // Agent control bar
  AgentControlBar: () => {
    useMicrophone();

    return (
      <Container componentName="AgentControlBar">
        <div className="relative flex items-center justify-center">
          <AgentControlBar
            className="w-full"
            controls={{
              leave: true,
              chat: true,
              camera: true,
              microphone: true,
              screenShare: true,
            }}
          />
        </div>
      </Container>
    );
  },

  // Track device select
  // TrackDeviceSelect: () => (
  //   <Container componentName="TrackDeviceSelect">
  //     <div className="grid grid-cols-2 gap-4">
  //       <div>
  //         <StoryTitle>Size default</StoryTitle>
  //         <TrackDeviceSelect kind="audioinput" />
  //       </div>
  //       <div>
  //         <StoryTitle>Size sm</StoryTitle>
  //         <TrackDeviceSelect size="sm" kind="audioinput" />
  //       </div>
  //     </div>
  //   </Container>
  // ),

  // Track toggle
  // TrackToggle: () => (
  //   <Container componentName="TrackToggle">
  //     <div className="grid grid-cols-2 gap-4">
  //       <div>
  //         <StoryTitle>Track.Source.Microphone</StoryTitle>
  //         <TrackToggle variant="outline" source={Track.Source.Microphone} />
  //       </div>
  //       <div>
  //         <StoryTitle>Track.Source.Camera</StoryTitle>
  //         <TrackToggle variant="outline" source={Track.Source.Camera} />
  //       </div>
  //     </div>
  //   </Container>
  // ),

  // Track control
  TrackControl: () => {
    const { microphoneTrack, localParticipant } = useLocalParticipant();
    const micTrackRef = useMemo<TrackReferenceOrPlaceholder | undefined>(() => {
      return {
        participant: localParticipant,
        source: Track.Source.Microphone,
        publication: microphoneTrack,
      } as TrackReference;
    }, [localParticipant, microphoneTrack]);

    useMicrophone();

    return (
      <Container componentName="TrackSelector">
        <div className="grid grid-cols-2 gap-8">
          <div className="flex flex-col gap-8">
            <div>
              <StoryTitle>Track.Source.Microphone</StoryTitle>
              <TrackControl kind="audioinput" source={Track.Source.Microphone} />
            </div>
            <div>
              <StoryTitle>Track.Source.Microphone</StoryTitle>
              <TrackControl
                kind="audioinput"
                source={Track.Source.Microphone}
                audioTrackRef={micTrackRef}
              />
            </div>
          </div>

          <div>
            <StoryTitle>Track.Source.Camera</StoryTitle>
            <TrackControl kind="videoinput" source={Track.Source.Camera} />
          </div>
        </div>
      </Container>
    );
  },

  // Chat entry
  ChatEntry: () => (
    <Container componentName="ChatEntry">
      <div className="mx-auto max-w-prose space-y-4">
        <ChatEntry
          locale="en-US"
          timestamp={Date.now() + 1000}
          message="Hello, how are you?"
          messageOrigin="local"
          name="User"
        />
        <ChatEntry
          locale="en-US"
          timestamp={Date.now() + 5000}
          message="I am good, how about you?"
          messageOrigin="remote"
          name="Agent"
        />
      </div>
    </Container>
  ),

  // Shimmer text
  ShimmerText: () => (
    <Container componentName="ShimmerText">
      <div className="text-center">
        <ShimmerText>This is shimmer text</ShimmerText>
      </div>
    </Container>
  ),

  // Alert toast
  AlertToast: () => (
    <Container componentName="AlertToast">
      <StoryTitle>Alert toast</StoryTitle>
      <div className="mx-auto max-w-prose">
        <AlertToast
          id="alert-toast"
          title="Alert toast"
          description="This is a alert toast description."
        />
      </div>
    </Container>
  ),
};
