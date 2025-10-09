import { Track } from 'livekit-client';
import { type ReceivedChatMessage } from '@livekit/components-react';
import { ChatTranscript } from '@/components/app/chat-transcript';
import { PreConnectMessage } from '@/components/app/preconnect-message';
import { ThemeToggle } from '@/components/app/theme-toggle';
import { AgentControlBar } from '@/components/livekit/agent-control-bar/agent-control-bar';
import { AlertToast } from '@/components/livekit/alert-toast';
import { ChatEntry } from '@/components/livekit/chat-entry';
import { ShimmerMessage } from '@/components/livekit/shimmer-message';
import { TrackDeviceSelect } from '@/components/livekit/track-device-select';
import { TrackSelector } from '@/components/livekit/track-selector';
import { TrackToggle } from '@/components/livekit/track-toggle';
import { Container } from '../_container';

export default function LiveKit() {
  return (
    <>
      {/* Agent control bar */}
      <Container>
        <div className="flex items-center justify-between">
          <h3 className="text-muted-foreground text-sm">A control bar component.</h3>
        </div>
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
      {/* Alert toast */}
      <Container>
        <div className="flex items-center justify-between">
          <h3 className="text-muted-foreground text-sm">A alert toast component.</h3>
        </div>
        <div className="space-y-4">
          <AlertToast
            id="alert-toast"
            title="Alert toast"
            description="This is a alert toast description."
          />
        </div>
      </Container>
      {/* Chat entry */}
      <Container>
        <div className="flex items-center justify-between">
          <h3 className="text-muted-foreground text-sm">A chat entry component.</h3>
        </div>
        <div className="space-y-4">
          <ChatEntry
            hideName
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
            hideName
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
      {/* Shimmer message */}
      <Container>
        <div className="flex items-center justify-between">
          <h3 className="text-muted-foreground text-sm">A shimmer message component.</h3>
        </div>
        <div className="space-y-4 text-center">
          <ShimmerMessage>This is a shimmer message</ShimmerMessage>
        </div>
      </Container>
      {/* Preconnect message */}
      <Container>
        <div className="flex items-center justify-between">
          <h3 className="text-muted-foreground text-sm">A preconnect message component.</h3>
        </div>
        <div className="space-y-4">
          <PreConnectMessage />
        </div>
      </Container>
      {/* Theme toggle */}
      <Container>
        <div className="flex items-center justify-between">
          <h3 className="text-muted-foreground text-sm">A theme toggle component.</h3>
        </div>
        <div className="flex justify-center space-y-4">
          <div>
            <ThemeToggle />
          </div>
        </div>
      </Container>
      {/* Device select */}
      <Container>
        <div className="flex items-center justify-between">
          <h3 className="text-muted-foreground text-sm">A device select component.</h3>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <h4 className="text-muted-foreground mb-2 font-mono text-xs uppercase">Size default</h4>
            <TrackDeviceSelect kind="audioinput" />
          </div>
          <div>
            <h4 className="text-muted-foreground mb-2 font-mono text-xs uppercase">Size sm</h4>
            <TrackDeviceSelect size="sm" kind="audioinput" />
          </div>
        </div>
      </Container>
      {/* Track toggle */}
      <Container>
        <div className="flex items-center justify-between">
          <h3 className="text-muted-foreground text-sm">A track toggle component.</h3>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <h4 className="text-muted-foreground mb-2 font-mono text-xs uppercase">
              Track.Source.Microphone
            </h4>
            <TrackToggle variant="outline" source={Track.Source.Microphone} />
          </div>
          <div>
            <h4 className="text-muted-foreground mb-2 font-mono text-xs uppercase">
              Track.Source.Camera
            </h4>
            <TrackToggle variant="outline" source={Track.Source.Camera} />
          </div>
        </div>
      </Container>
      {/* Track selector */}
      <Container>
        <div className="flex items-center justify-between">
          <h3 className="text-muted-foreground text-sm">A track selector component.</h3>
        </div>
        <div className="space-y-4">
          <TrackSelector kind="videoinput" source={Track.Source.Camera} />
          <TrackSelector kind="audioinput" source={Track.Source.Microphone} />
        </div>
      </Container>
      {/* Transcript */}
      <Container>
        <div className="flex items-center justify-between">
          <h3 className="text-muted-foreground text-sm">A transcript component.</h3>
        </div>
        <div className="relative space-y-4">
          <ChatTranscript
            messages={[
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
              } as ReceivedChatMessage,
              {
                id: '2',
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
              } as ReceivedChatMessage,
            ]}
          />
        </div>
      </Container>
    </>
  );
}
