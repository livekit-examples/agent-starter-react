'use client';

import { useEffect, useMemo, useState } from 'react';
import { Room, RoomEvent } from 'livekit-client';
import { motion } from 'motion/react';
import { RoomAudioRenderer, RoomContext, StartAudio } from '@livekit/components-react';
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
  const room = useMemo(() => new Room(), []);
  const [sessionStarted, setSessionStarted] = useState(false);
  const { connectionDetails, refreshConnectionDetails } = useConnectionDetails();

  useEffect(() => {
    const onDisconnected = () => {
      setSessionStarted(false);
      refreshConnectionDetails();
    };
    const onMediaDevicesError = (error: Error) => {
      toastAlert({
        title: 'Encountered an error with your media devices',
        description: `${error.name}: ${error.message}`,
      });
    };
    room.on(RoomEvent.MediaDevicesError, onMediaDevicesError);
    room.on(RoomEvent.Disconnected, onDisconnected);
    return () => {
      room.off(RoomEvent.Disconnected, onDisconnected);
      room.off(RoomEvent.MediaDevicesError, onMediaDevicesError);
    };
  }, [room, refreshConnectionDetails]);

  // 1. Connect to the room
  const [connected, setConnected] = useState(false);
  useEffect(() => {
    if (!sessionStarted) {
      return;
    }
    if (room.state !== 'disconnected') {
      return;
    }
    if (!connectionDetails) {
      return;
    }

    let aborted = false;
    const connect = async () => {
      try {
        await room.connect(connectionDetails.serverUrl, connectionDetails.participantToken);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } catch (error: any) {
        if (aborted) {
          // Once the effect has cleaned up after itself, drop any errors
          console.error('Aborted connect error:', error);
          return;
        }
        console.error('Error connecting to room:', error);
        toastAlert({
          title: 'There was an error connecting to the agent',
          description: `${error.name}: ${error.message}`,
        });
        return;
      }
      setConnected(true);
    };
    connect();

    return () => {
      aborted = true;
      setConnected(false);
      room.disconnect();
    };
  }, [room, sessionStarted, connectionDetails, appConfig.isPreConnectBufferEnabled]);

  // 2. Configure the room so it can be used to talk to the agent
  useEffect(() => {
    if (!connected) {
      return;
    }

    let aborted = false;
    const configure = async () => {
      try {
        await room.localParticipant.setMicrophoneEnabled(true, undefined, {
          preConnectBuffer: appConfig.isPreConnectBufferEnabled,
        });
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } catch (error: any) {
        if (aborted) {
          // Once the effect has cleaned up after itself, drop any errors
          console.error('Aborted config error:', error);
          return;
        }
        console.error('Error configuring room:', error);
        toastAlert({
          title: 'There was an error connecting to the agent',
          description: `${error.name}: ${error.message}`,
        });
      }
    };
    configure();

    return () => {
      aborted = true;
    };
  }, [room, connected]);

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

      <RoomContext.Provider value={room}>
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
      </RoomContext.Provider>

      <Toaster />
    </>
  );
}
