import { Track } from 'livekit-client';
import { type ReceivedChatMessage } from '@livekit/components-react';
import { PlusIcon } from '@phosphor-icons/react/dist/ssr';
import { AgentControlBar } from '@/components/livekit/agent-control-bar/agent-control-bar';
import { TrackDeviceSelect } from '@/components/livekit/agent-control-bar/track-device-select';
import { TrackSelector } from '@/components/livekit/agent-control-bar/track-selector';
import { TrackToggle } from '@/components/livekit/agent-control-bar/track-toggle';
import { Alert, AlertDescription, AlertTitle } from '@/components/livekit/alert';
import { AlertToast } from '@/components/livekit/alert-toast';
import { Button } from '@/components/livekit/button';
import { ChatEntry } from '@/components/livekit/chat-entry';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/livekit/select';
import { ShimmerText } from '@/components/livekit/shimmer-text';
import { Toggle } from '@/components/livekit/toggle';
import { Container } from './_container';

const buttonVariants = [
  'default',
  'primary',
  'secondary',
  'outline',
  'ghost',
  'link',
  'destructive',
] as const;
const toggleVariants = ['default', 'primary', 'secondary', 'outline'] as const;
const alertVariants = ['default', 'destructive'] as const;

function StoryTitle({ children }: { children: React.ReactNode }) {
  return <h4 className="text-muted-foreground mb-2 font-mono text-xs uppercase">{children}</h4>;
}

export default function Base() {
  return (
    <>
      <h2 className="mt-40 mb-8 text-4xl font-extralight tracking-tight">Primitives</h2>

      {/* Button */}
      <Container componentName="Button">
        {buttonVariants.map((variant) => (
          <div key={variant}>
            <StoryTitle>{variant}</StoryTitle>
            <div className="flex justify-center gap-8">
              <div>
                <Button variant={variant} size="sm">
                  Size sm
                </Button>
              </div>
              <div>
                <Button variant={variant}>Size default</Button>
              </div>
              <div>
                <Button variant={variant} size="lg">
                  Size lg
                </Button>
              </div>
              <div>
                <Button variant={variant} size="icon">
                  <PlusIcon size={16} weight="bold" />
                </Button>
              </div>
            </div>
          </div>
        ))}
      </Container>

      {/* Toggle */}
      <Container componentName="Toggle">
        {toggleVariants.map((variant) => (
          <div key={variant}>
            <StoryTitle>{variant}</StoryTitle>
            <div className="flex justify-center gap-8">
              <div>
                <Toggle key={variant} variant={variant} size="sm">
                  Size sm
                </Toggle>
              </div>
              <div>
                <Toggle key={variant} variant={variant}>
                  Size default
                </Toggle>
              </div>
              <div>
                <Toggle key={variant} variant={variant} size="lg">
                  Size lg
                </Toggle>
              </div>
            </div>
          </div>
        ))}
      </Container>

      {/* Alert */}
      <Container componentName="Alert">
        {alertVariants.map((variant) => (
          <div key={variant}>
            <StoryTitle>{variant}</StoryTitle>
            <Alert key={variant} variant={variant}>
              <AlertTitle>Alert {variant} title</AlertTitle>
              <AlertDescription>This is a {variant} alert description.</AlertDescription>
            </Alert>
          </div>
        ))}
      </Container>

      {/* Select */}
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

      <h2 className="mt-40 mb-4 text-4xl font-extralight tracking-tight">Components</h2>

      {/* Agent control bar */}
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

      {/* Track device select */}
      <Container componentName="TrackDeviceSelect">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <StoryTitle>Size default</StoryTitle>
            <TrackDeviceSelect kind="audioinput" />
          </div>
          <div>
            <StoryTitle>Size sm</StoryTitle>
            <TrackDeviceSelect size="sm" kind="audioinput" />
          </div>
        </div>
      </Container>

      {/* Track toggle */}
      <Container componentName="TrackToggle">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <StoryTitle>Track.Source.Microphone</StoryTitle>
            <TrackToggle variant="outline" source={Track.Source.Microphone} />
          </div>
          <div>
            <StoryTitle>Track.Source.Camera</StoryTitle>
            <TrackToggle variant="outline" source={Track.Source.Camera} />
          </div>
        </div>
      </Container>

      {/* Track selector */}
      <Container componentName="TrackSelector">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <StoryTitle>Track.Source.Camera</StoryTitle>
            <TrackSelector kind="videoinput" source={Track.Source.Camera} />
          </div>
          <div>
            <StoryTitle>Track.Source.Microphone</StoryTitle>
            <TrackSelector kind="audioinput" source={Track.Source.Microphone} />
          </div>
        </div>
      </Container>

      {/* Chat entry */}
      <Container componentName="ChatEntry">
        <div className="mx-auto max-w-prose space-y-4">
          <ChatEntry
            entry={
              {
                id: '1',
                timestamp: Date.now(),
                message: 'Hello, how are you?',
                from: {
                  identity: 'user',
                  isLocal: true,
                  name: 'User',
                  audioTrackPublications: new Map(),
                  videoTrackPublications: new Map(),
                  trackPublications: new Map(),
                  audioLevel: 0,
                },
              } as ReceivedChatMessage
            }
          />
          <ChatEntry
            entry={
              {
                id: '1',
                timestamp: Date.now(),
                message: 'I am good, how about you?',
                from: {
                  identity: 'agent',
                  isLocal: false,
                  name: 'Agent',
                  audioTrackPublications: new Map(),
                  videoTrackPublications: new Map(),
                  trackPublications: new Map(),
                  audioLevel: 0,
                },
              } as ReceivedChatMessage
            }
          />
        </div>
      </Container>

      {/* Shimmer text */}
      <Container componentName="ShimmerText">
        <div className="text-center">
          <ShimmerText>This is shimmer text</ShimmerText>
        </div>
      </Container>

      {/* Alert toast */}
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
    </>
  );
}
