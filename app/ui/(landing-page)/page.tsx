'use client';

import Link from 'next/link';
import { useVoiceAssistant } from '@livekit/components-react';
import { AgentControlBar } from '@/components/livekit/agent-control-bar/agent-control-bar';
import { AudioBarVisualizer } from '@/components/livekit/audio-visualizer/audio-bar-visualizer/audio-bar-visualizer';
import { Button } from '@/components/livekit/button';
import { ChatEntry } from '@/components/livekit/chat-entry';
import { useMicrophone } from '../_components';

export default function Page() {
  const { state, audioTrack } = useVoiceAssistant();

  useMicrophone();

  return (
    <>
      <header className="grid h-96 place-content-center space-y-6 text-center">
        <h1 className="flex items-baseline justify-center gap-2 text-5xl">
          <svg
            height="48"
            viewBox="0 0 123 28"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className="text-foreground"
          >
            <path
              d="M4.7 0H0v27.6h17v-4H4.7V0ZM24.8 12.5h-4.5v15h4.5v-15ZM38.2 27 32.4 8H28l6 19.6h8.6l6-19.6H44l-5.8 19ZM59.8 7.6c-5.9 0-9.6 4.2-9.6 10.2 0 6 3.6 10.2 9.6 10.2 4.6 0 8-2 9.2-6.2h-4.6c-.7 1.9-2 3-4.5 3-2.8 0-4.7-2-5-5.7h14.4l.1-1.4c0-6.1-3.8-10.1-9.6-10.1Zm-5 8.4c.5-3.6 2.4-5.2 5-5.2 2.9 0 4.7 2 5 5.2h-10ZM96 0h-5.9L78.7 12.6V0H74v27.6h4.7v-14l12.6 14h6L84.1 13 96.1 0ZM104 8h-4.6v15h4.5V8ZM20.3 8h-4.6v4.5h4.6V8ZM108.5 23h-4.6v4.6h4.6V23ZM122 23h-4.5v4.6h4.6V23ZM122 12.5V8h-4.5V0H113v8h-4.6v4.5h4.6V23h4.5V12.5h4.6Z"
              fill="currentColor"
            />
          </svg>
          <span className="font-extralight tracking-tighter">UI</span>
        </h1>
        <p className="text-lg text-pretty">
          A set of Open Source UI components for
          <br />
          building beautiful voice experiences.
        </p>
        <div className="flex justify-center gap-4">
          <Button variant="primary" asChild>
            <Link href="/ui/components">View components</Link>
          </Button>
          <Button variant="ghost" asChild>
            <Link href="https://docs.livekit.io/agents/start/frontend/">Read our docs</Link>
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-5xl space-y-8">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="border-border bg-background h-96 rounded-3xl border p-8">
            <div className="flex h-full flex-col gap-4">
              <div className="grid flex-1 grow place-content-center">
                <AudioBarVisualizer state={state} audioTrack={audioTrack!} />
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
        </div>
      </main>
    </>
  );
}
