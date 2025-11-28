import { useMicrophone } from '@/hooks/useMicrophone';
import { Container } from '../docs/container';
import { AgentControlBar } from '../livekit/agent-control-bar/agent-control-bar';

export default function AgentControlBarDemo() {
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
}
