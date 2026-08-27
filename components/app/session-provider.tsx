'use client';

import { createContext, useContext, useMemo } from 'react';
import { RoomContext } from '@livekit/components-react';
import { APP_CONFIG_DEFAULTS, type AppConfig } from '@/app-config';
import type { BrowserSourceClient } from '@/hooks/useBrowserSourceClient';
import { useRoom } from '@/hooks/useRoom';
import { SelectedVideoTrackProvider } from '@/hooks/useSelectedVideoTrack';
import { ensureBrowserRandomUuid } from '@/lib/browser-runtime-compat';

const DEFAULT_BROWSER_SOURCE_CLIENT: BrowserSourceClient = {
  enabled: false,
  audioEnabled: true,
  videoEnabled: true,
  videoTrack: null,
  audioPending: false,
  videoPending: false,
  setAudioDeviceId: async () => {},
  setAudioEnabled: async () => {},
  setVideoEnabled: async () => {},
  start: async () => {},
  stop: async () => {},
};

const SessionContext = createContext<{
  appConfig: AppConfig;
  isSessionActive: boolean;
  startSession: () => Promise<void>;
  endSession: () => Promise<void>;
  getCurrentSessionId: () => string | null;
  browserSourceClient: BrowserSourceClient;
}>({
  appConfig: APP_CONFIG_DEFAULTS,
  isSessionActive: false,
  startSession: async () => {},
  endSession: async () => {},
  getCurrentSessionId: () => null,
  browserSourceClient: DEFAULT_BROWSER_SOURCE_CLIENT,
});

interface SessionProviderProps {
  appConfig: AppConfig;
  children: React.ReactNode;
}

export const SessionProvider = ({ appConfig, children }: SessionProviderProps) => {
  const compatibility = ensureBrowserRandomUuid();
  if (!compatibility.ok) {
    return (
      <main className="grid min-h-svh place-content-center p-6">
        <div role="alert" className="max-w-lg space-y-2 text-center">
          <h1 className="text-xl font-semibold">Browser compatibility error</h1>
          <p>{compatibility.message}</p>
        </div>
      </main>
    );
  }

  return <CompatibleSessionProvider appConfig={appConfig}>{children}</CompatibleSessionProvider>;
};

const CompatibleSessionProvider = ({ appConfig, children }: SessionProviderProps) => {
  const {
    room,
    isSessionActive,
    startSession,
    endSession,
    getCurrentSessionId,
    browserSourceClient,
  } = useRoom(appConfig);
  const contextValue = useMemo(
    () => ({
      appConfig,
      isSessionActive,
      startSession,
      endSession,
      getCurrentSessionId,
      browserSourceClient,
    }),
    [appConfig, isSessionActive, startSession, endSession, getCurrentSessionId, browserSourceClient]
  );

  return (
    <RoomContext.Provider value={room}>
      <SessionContext.Provider value={contextValue}>
        <SelectedVideoTrackProvider>{children}</SelectedVideoTrackProvider>
      </SessionContext.Provider>
    </RoomContext.Provider>
  );
};

export function useSession() {
  return useContext(SessionContext);
}
