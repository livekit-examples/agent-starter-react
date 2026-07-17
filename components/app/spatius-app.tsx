'use client';

import { useCallback, useState } from 'react';
import { useTheme } from 'next-themes';
import type { AppConfig } from '@/app-config';
import { AgentSessionView_01 } from '@/components/agents-ui/blocks/agent-session-view-01';
import { StartAudioButton } from '@/components/agents-ui/start-audio-button';
import { AppSetup, AppToaster } from '@/components/app/app-setup';
import { WelcomeView } from '@/components/app/welcome-view';
import { SpatiusAvatarProvider } from '@/components/spatius-avatar';
import type { SpatiusSettings } from '@/lib/spatius/config';
import { type SpatiusConnection, resolveSpatiusConnection } from '@/lib/spatius/token';

interface SpatiusAppProps {
  appConfig: AppConfig;
  settings: SpatiusSettings;
  /** Pre-connect settings rendered on the welcome screen. */
  welcomeSlot?: React.ReactNode;
}

/**
 * Spatius avatar experience. The Spatius `AvatarPlayer` owns the LiveKit
 * connection, so we resolve a token up front and hand the credentials to
 * {@link SpatiusAvatarProvider}, which connects and adopts the room for the rest
 * of the agent UI. Lazily loaded (client-only) so the WASM decoder and its
 * `RTCPeerConnection` patch never load on the standard path.
 */
export function SpatiusApp({ appConfig, settings, welcomeSlot }: SpatiusAppProps) {
  const { resolvedTheme } = useTheme();
  const [connection, setConnection] = useState<SpatiusConnection | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const start = useCallback(async () => {
    setConnecting(true);
    setError(null);
    try {
      setConnection(await resolveSpatiusConnection(appConfig, settings.agentName));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to connect.');
    } finally {
      setConnecting(false);
    }
  }, [appConfig, settings.agentName]);

  if (!connection) {
    return (
      <main className="grid h-svh grid-cols-1 place-content-center">
        <WelcomeView
          startButtonText={connecting ? 'Connecting…' : appConfig.startButtonText}
          onStartCall={() => void start()}
          configSlot={welcomeSlot}
        />
        {error && (
          <p className="text-destructive fixed inset-x-0 top-6 mx-auto w-fit text-sm" role="alert">
            {error}
          </p>
        )}
      </main>
    );
  }

  return (
    <SpatiusAvatarProvider
      appId={settings.appId}
      avatarId={settings.avatarId}
      connection={connection}
      onDisconnect={() => setConnection(null)}
      onAvatarError={(err) => setError(err.message)}
    >
      <AppSetup />
      <main className="grid h-svh grid-cols-1 place-content-center">
        <AgentSessionView_01
          supportsChatInput={appConfig.supportsChatInput}
          supportsVideoInput={appConfig.supportsVideoInput}
          supportsScreenShare={appConfig.supportsScreenShare}
          isPreConnectBufferEnabled={false}
          audioVisualizerType={appConfig.audioVisualizerType}
          audioVisualizerColor={
            resolvedTheme === 'dark'
              ? appConfig.audioVisualizerColorDark
              : appConfig.audioVisualizerColor
          }
          audioVisualizerColorShift={appConfig.audioVisualizerColorShift}
          audioVisualizerBarCount={appConfig.audioVisualizerBarCount}
          audioVisualizerGridRowCount={appConfig.audioVisualizerGridRowCount}
          audioVisualizerGridColumnCount={appConfig.audioVisualizerGridColumnCount}
          audioVisualizerRadialBarCount={appConfig.audioVisualizerRadialBarCount}
          audioVisualizerRadialRadius={appConfig.audioVisualizerRadialRadius}
          audioVisualizerWaveLineWidth={appConfig.audioVisualizerWaveLineWidth}
          className="fixed inset-0"
        />
      </main>
      <StartAudioButton label="Start Audio" />
      <AppToaster />
    </SpatiusAvatarProvider>
  );
}
