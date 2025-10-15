import { Track } from 'livekit-client';
import { AgentControlBar } from '@/components/livekit/agent-control-bar/agent-control-bar';
import { DeviceSelect } from '@/components/livekit/device-select';
import { TrackToggle } from '@/components/livekit/track-toggle';
import { Container } from '../Container';

export default function LiveKit() {
  return (
    <>
      {/* Device select */}
      <Container>
        <div className="flex items-center justify-between">
          <h3 className="text-muted-foreground text-sm">A device select component.</h3>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <h4 className="text-muted-foreground mb-2 font-mono text-xs uppercase">Size default</h4>
            <DeviceSelect kind="audioinput" />
          </div>
          <div>
            <h4 className="text-muted-foreground mb-2 font-mono text-xs uppercase">Size sm</h4>
            <DeviceSelect size="sm" kind="audioinput" />
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

      {/* Agent control bar */}
      <Container>
        <div className="flex items-center justify-between">
          <h3 className="text-muted-foreground text-sm">A control bar component.</h3>
        </div>
        <div className="relative flex items-center justify-center">
          <AgentControlBar
            className="w-full"
            capabilities={{
              supportsChatInput: true,
              supportsVideoInput: true,
              supportsScreenShare: true,
            }}
          />
        </div>
      </Container>
    </>
  );
}
