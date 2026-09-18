'use client';

import { useEffect, useMemo, useState } from 'react';
import { Menu, Table2 } from 'lucide-react';
import { TokenSource } from 'livekit-client';
import { useSession } from '@livekit/components-react';
import { WarningIcon } from '@phosphor-icons/react/dist/ssr';
import type { AppConfig } from '@/app-config';
import { AgentSessionProvider } from '@/components/agents-ui/agent-session-provider';
import { StartAudioButton } from '@/components/agents-ui/start-audio-button';
import { Sidebar } from '@/components/app/sidebar';
import { RightSidebar } from '@/components/app/right-sidebar';
import { ViewController } from '@/components/app/view-controller';
import { Button } from '@/components/ui/button';
import { Toaster } from '@/components/ui/sonner';
import { useAgentErrors } from '@/hooks/useAgentErrors';
import { useDebugMode } from '@/hooks/useDebug';

const IN_DEVELOPMENT = process.env.NODE_ENV !== 'production';

function AppSetup() {
  useDebugMode({ enabled: IN_DEVELOPMENT });
  useAgentErrors();

  return null;
}

interface AppProps {
  appConfig: AppConfig;
  roomName?: string;
}

export function App({ appConfig, roomName: initialRoomName }: AppProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [rightSidebarOpen, setRightSidebarOpen] = useState(false);
  const [username, setUsername] = useState(() => {
    if (typeof window !== 'undefined') {
      return new URLSearchParams(window.location.search).get('username') || '';
    }
    return '';
  });
  const [roomName, setRoomName] = useState(() => {
    if (typeof window !== 'undefined') {
      const queryRoom = new URLSearchParams(window.location.search).get('room') || '';
      return initialRoomName || queryRoom;
    }
    return initialRoomName || '';
  });
  const [isChatFullscreen, setIsChatFullscreen] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('chat-fullscreen') === 'true';
    }
    return false;
  });

  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('chat-fullscreen', String(isChatFullscreen));
    }
  }, [isChatFullscreen]);
  const [agentName, setAgentName] = useState<string | undefined>(() => {
    if (typeof window !== 'undefined') {
      return new URLSearchParams(window.location.search).get('agent') ?? undefined;
    }
  });

  const fallbackUser = typeof window !== 'undefined'
    ? new URLSearchParams(window.location.search).get('user') ?? `va_user_${Math.floor(Math.random() * 10_000)}`
    : `va_user_${Math.floor(Math.random() * 10_000)}`;

  const participantIdentity = username || fallbackUser;
  const participantName = username || fallbackUser;
  const finalRoomName = roomName || `va_room_${Math.floor(Math.random() * 10_000)}`;

  const tokenSource = useMemo(() => {
    const sandboxEndpoint = process.env.NEXT_PUBLIC_CONN_DETAILS_ENDPOINT;
    const url = sandboxEndpoint ?? '/api/token';
    const sandboxId = appConfig.sandboxId;
    const roomConfig = (agentName ?? appConfig.agentName)
      ? { agents: [{ agent_name: agentName ?? appConfig.agentName }] }
      : undefined;

    return TokenSource.custom(async () => {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (sandboxEndpoint && sandboxId) {
        headers['X-Sandbox-Id'] = sandboxId;
      }

      const res = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          room_name: finalRoomName,
          participant_identity: participantIdentity,
          participant_name: participantName,
          room_config: roomConfig,
          participant_metadata: JSON.stringify({ role: 'user', department: 'engineering' }),
          participant_attributes: { region: 'us-east', language: 'ru', timezone: 'UTC' },
        }),
      });
      return await res.json();
    });
  }, [agentName, appConfig, finalRoomName, participantIdentity, participantName]);

  const session = useSession(tokenSource);
  const isConnected = session.isConnected;

  return (
    <AgentSessionProvider session={session}>
      <AppSetup />
      <main className="grid h-svh grid-cols-1 place-content-center">
        <ViewController
          appConfig={appConfig}
          username={username}
          onUsernameChange={setUsername}
          roomName={roomName}
          onRoomNameChange={setRoomName}
          agentName={agentName}
          onAgentNameChange={setAgentName}
          isChatFullscreen={isChatFullscreen}
        />
      </main>
      <StartAudioButton label="Начать аудио" />

      {isConnected && (
        <>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setSidebarOpen(true)}
            className="fixed left-3 top-3 z-50 md:left-6 md:top-6"
            aria-label="Открыть боковую панель"
          >
            <Menu className="size-5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setRightSidebarOpen(true)}
            className="fixed right-3 top-3 z-50 md:right-6 md:top-6"
            aria-label="Открыть правую панель"
          >
            <Table2 className="size-5" />
          </Button>
        </>
      )}

      <Sidebar
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        isChatFullscreen={isChatFullscreen}
        onChatFullscreenChange={setIsChatFullscreen}
      />
      <RightSidebar open={rightSidebarOpen} onClose={() => setRightSidebarOpen(false)} />

      <Toaster
        icons={{
          warning: <WarningIcon weight="bold" />,
        }}
        position="top-center"
        className="toaster group"
        style={
          {
            '--normal-bg': 'var(--popover)',
            '--normal-text': 'var(--popover-foreground)',
            '--normal-border': 'var(--border)',
          } as React.CSSProperties
        }
      />
    </AgentSessionProvider>
  );
}
