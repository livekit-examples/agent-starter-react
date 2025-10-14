import { type VariantProps } from 'class-variance-authority';
import { Track } from 'livekit-client';
import { MicrophoneIcon } from '@phosphor-icons/react/dist/ssr';
import { AgentControlBar } from '@/components/livekit/agent-control-bar/agent-control-bar';
import { TrackDeviceSelect } from '@/components/livekit/agent-control-bar/track-device-select';
import { TrackSelector } from '@/components/livekit/agent-control-bar/track-selector';
import { TrackToggle } from '@/components/livekit/agent-control-bar/track-toggle';
import { Alert, AlertDescription, AlertTitle, alertVariants } from '@/components/livekit/alert';
import { AlertToast } from '@/components/livekit/alert-toast';
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
import { cn } from '@/lib/utils';

type toggleVariantsType = VariantProps<typeof toggleVariants>['variant'];
type toggleVariantsSizeType = VariantProps<typeof toggleVariants>['size'];
type buttonVariantsType = VariantProps<typeof buttonVariants>['variant'];
type buttonVariantsSizeType = VariantProps<typeof buttonVariants>['size'];
type alertVariantsType = VariantProps<typeof alertVariants>['variant'];

interface ContainerProps {
  componentName?: string;
  children: React.ReactNode;
  className?: string;
}

function Container({ componentName, children, className }: ContainerProps) {
  return (
    <div className={cn('space-y-4', className)}>
      <h3 className="text-foreground text-2xl font-bold">
        <span className="tracking-tight">{componentName}</span>
      </h3>
      <div className="bg-background border-input space-y-4 rounded-3xl border p-8 drop-shadow-lg/5">
        {children}
      </div>
    </div>
  );
}

function StoryTitle({ children }: { children: React.ReactNode }) {
  return <h4 className="text-muted-foreground mb-2 font-mono text-xs uppercase">{children}</h4>;
}

export default function Base() {
  return (
    <>
      <h2 className="mt-40 mb-8 text-4xl font-extralight tracking-tight">Primitives</h2>

      {/* Button */}
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

      {/* Toggle */}
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

      {/* Alert */}
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
