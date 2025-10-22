'use client';

import { AgentControlBar } from '@/components/livekit/agent-control-bar/agent-control-bar';
import { Button } from '@/components/livekit/button';
import { ChatEntry } from '@/components/livekit/chat-entry';

export default function Page() {
  return (
    <>
      <header className="grid h-96 place-content-center space-y-6 text-center">
        <h1 className="text-5xl">
          <span className="font-bold tracking-tighter">LiveKit</span>{' '}
          <span className="font-light tracking-tighter">UI</span>
        </h1>
        <p className="text-lg text-pretty">
          A set of Open Source UI components for
          <br />
          building beautiful voice experiences.
        </p>
        <div className="flex justify-center gap-4">
          <Button variant="primary" asChild>
            <a href="/ui/components">View components</a>
          </Button>
          <Button variant="ghost" asChild>
            <a href="https://docs.livekit.io/agents/start/frontend/">Read our docs</a>
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-3xl space-y-8">
        <div className="border-border bg-background h-96 rounded-3xl border p-8">
          <div className="flex h-full flex-col gap-4">
            <div className="flex-1 grow">
              <ChatEntry
                locale="en-US"
                name="User"
                message="Hello, how are you?"
                messageOrigin="local"
                timestamp={1761096559966}
              />
              <ChatEntry
                locale="en-US"
                name="Agent"
                message="I am good, how about you?"
                messageOrigin="remote"
                timestamp={1761096569216}
              />
            </div>
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
        </div>
      </main>
    </>
  );
}
