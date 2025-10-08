'use client';

import { AnimatePresence, motion } from 'motion/react';
import { RoomAudioRenderer, RoomContext, StartAudio } from '@livekit/components-react';
import { Toaster } from '@/components/livekit/toaster';
import { SessionView } from '@/components/session-view';
import { Welcome } from '@/components/welcome';
import { useRoom } from '@/hooks/useRoom';
import type { AppConfig } from '@/lib/types';

const MotionWelcome = motion.create(Welcome);
const MotionSessionView = motion.create(SessionView);

interface AppProps {
  appConfig: AppConfig;
}

export function App({ appConfig }: AppProps) {
  const { room, sessionStarted, setSessionStarted } = useRoom(appConfig);
  const { startButtonText } = appConfig;

  const transition = {
    duration: 0.5,
    ease: 'linear',
  };

  const handleStartCall = () => {
    setSessionStarted(true);
  };

  return (
    <RoomContext.Provider value={room}>
      <main className="grid h-svh grid-cols-1 place-content-center">
        <AnimatePresence mode="wait">
          {/* Welcome screen */}
          {!sessionStarted && (
            <MotionWelcome
              key="welcome"
              startButtonText={startButtonText}
              onStartCall={handleStartCall}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={transition}
            />
          )}

          {/* Session view */}
          {sessionStarted && (
            <MotionSessionView
              key="session-view"
              appConfig={appConfig}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={transition}
            />
          )}
        </AnimatePresence>
      </main>

      <StartAudio label="Start Audio" />
      <RoomAudioRenderer />
      <Toaster />
    </RoomContext.Provider>
  );
}
