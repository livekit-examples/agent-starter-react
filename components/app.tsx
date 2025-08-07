'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Room, RoomEvent } from 'livekit-client';
import { motion } from 'motion/react';
import {
  LiveKitRoom,
  RoomAudioRenderer,
  RoomContext,
  StartAudio,
  useRoomConnection,
} from '@livekit/components-react';
import { toastAlert } from '@/components/alert-toast';
import { SessionView } from '@/components/session-view';
import { Toaster } from '@/components/ui/sonner';
import { Welcome } from '@/components/welcome';
import useConnectionDetails from '@/hooks/useConnectionDetails';
import type { AppConfig } from '@/lib/types';

const MotionWelcome = motion.create(Welcome);
const MotionSessionView = motion.create(SessionView);

interface AppProps {
  appConfig: AppConfig;
}

export function App({ appConfig }: AppProps) {
  const [sessionStarted, setSessionStarted] = useState(false);
  const { connectionDetails, refreshConnectionDetails } = useConnectionDetails();

  const enableMicrophonePreConnectBuffer = useCallback(async (room: Room) => {
    room.localParticipant.setMicrophoneEnabled(true, undefined, {
      preConnectBuffer: appConfig.isPreConnectBufferEnabled,
    });
  }, []);

  const onDisconnected = useCallback(() => {
    setSessionStarted(false);
    refreshConnectionDetails();
  }, [refreshConnectionDetails]);
  const onMediaDeviceFailure = useCallback((error: Error) => {
    toastAlert({
      title: 'Encountered an error with your media devices',
      description: `${error.name}: ${error.message}`,
    });
  }, []);

  const { startButtonText } = appConfig;

  return (
    <>
      <MotionWelcome
        key="welcome"
        startButtonText={startButtonText}
        onStartCall={() => setSessionStarted(true)}
        disabled={sessionStarted}
        initial={{ opacity: 0 }}
        animate={{ opacity: sessionStarted ? 0 : 1 }}
        transition={{ duration: 0.5, ease: 'linear', delay: sessionStarted ? 0 : 0.5 }}
      />

      <LiveKitRoom
        connect={sessionStarted && connectionDetails !== null}
        token={connectionDetails?.participantToken!}
        serverUrl={connectionDetails?.serverUrl!}
        connectionSideEffect={enableMicrophonePreConnectBuffer}
        onDisconnected={onDisconnected}
        onMediaDeviceFailure={onMediaDeviceFailure}
      >
        <RoomAudioRenderer />
        <StartAudio label="Start Audio" />
        {/* --- */}
        <MotionSessionView
          key="session-view"
          appConfig={appConfig}
          disabled={!sessionStarted}
          sessionStarted={sessionStarted}
          initial={{ opacity: 0 }}
          animate={{ opacity: sessionStarted ? 1 : 0 }}
          transition={{
            duration: 0.5,
            ease: 'linear',
            delay: sessionStarted ? 0.5 : 0,
          }}
        />
      </LiveKitRoom>

      <Toaster />
    </>
  );
}
