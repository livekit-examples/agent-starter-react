'use client';

import { createContext, useContext, useMemo } from 'react';
import { RoomContext } from '@livekit/components-react';
import { APP_CONFIG_DEFAULTS, type AppConfig } from '@/app-config';
import type { BrowserSourceClient } from '@/hooks/useBrowserSourceClient';
import { useRoom } from '@/hooks/useRoom';
import { SelectedVideoTrackProvider } from '@/hooks/useSelectedVideoTrack';

const DEFAULT_BROWSER_SOURCE_CLIENT: BrowserSourceClient = {
  enabled: false,
  audioEnabled: true,
  videoEnabled: true,
  videoTrack: null,
  audioPending: false,
  videoPending: false,
  setAudioEnabled: async () => {},
  setVideoEnabled: async () => {},
  start: async () => {},
  stop: () => {},
};

const SessionContext = createContext<{
  appConfig: AppConfig;
  isSessionActive: boolean;
  startSession: () => void;
  endSession: () => void;
  browserSourceClient: BrowserSourceClient;
}>({
  appConfig: APP_CONFIG_DEFAULTS,
  isSessionActive: false,
  startSession: () => {},
  endSession: () => {},
  browserSourceClient: DEFAULT_BROWSER_SOURCE_CLIENT,
});

interface SessionProviderProps {
  appConfig: AppConfig;
  children: React.ReactNode;
}

export const SessionProvider = ({ appConfig, children }: SessionProviderProps) => {
  const { room, isSessionActive, startSession, endSession, browserSourceClient } =
    useRoom(appConfig);
  const contextValue = useMemo(
    () => ({ appConfig, isSessionActive, startSession, endSession, browserSourceClient }),
    [appConfig, isSessionActive, startSession, endSession, browserSourceClient]
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
