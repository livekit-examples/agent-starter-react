import { Container } from '../docs/container';
import { ChatEntry } from '../livekit/chat-entry';

export default function ChatEntryDemo() {
  return (
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
  );
}
