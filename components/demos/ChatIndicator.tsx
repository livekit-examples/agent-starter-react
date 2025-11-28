import { Container } from '../docs/container';
import { ChatIndicator } from '../livekit/chat-indicator';

export default function ChatIndicatorDemo() {
  return (
    <Container componentName="ChatIndicator">
      <ChatIndicator agentState="thinking" />
    </Container>
  );
}
