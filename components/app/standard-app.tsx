'use client';

import { useMemo } from 'react';
import { TokenSource } from 'livekit-client';
import { useSession } from '@livekit/components-react';
import type { AppConfig } from '@/app-config';
import { AgentSessionProvider } from '@/components/agents-ui/agent-session-provider';
import { StartAudioButton } from '@/components/agents-ui/start-audio-button';
import { AppSetup, AppToaster } from '@/components/app/app-setup';
import { ViewController } from '@/components/app/view-controller';
import { getSandboxTokenSource } from '@/lib/utils';

interface StandardAppProps {
  appConfig: AppConfig;
  /** Optional pre-connect settings rendered on the welcome screen. */
  welcomeSlot?: React.ReactNode;
}

/**
 * The default LiveKit agent experience (voice / standard video). This is the
 * original `App` body, unchanged apart from an optional welcome-screen slot.
 */
export function StandardApp({ appConfig, welcomeSlot }: StandardAppProps) {
  const tokenSource = useMemo(() => {
    return typeof process.env.NEXT_PUBLIC_CONN_DETAILS_ENDPOINT === 'string'
      ? getSandboxTokenSource(appConfig)
      : TokenSource.endpoint('/api/token');
  }, [appConfig]);

  const session = useSession(
    tokenSource,
    appConfig.agentName ? { agentName: appConfig.agentName } : undefined
  );

  return (
    <AgentSessionProvider session={session}>
      <AppSetup />
      <main className="grid h-svh grid-cols-1 place-content-center">
        <ViewController appConfig={appConfig} welcomeSlot={welcomeSlot} />
      </main>
      <StartAudioButton label="Start Audio" />
      <AppToaster />
    </AgentSessionProvider>
  );
}
