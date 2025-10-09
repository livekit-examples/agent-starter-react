'use client';

import { AnimatePresence, motion } from 'motion/react';
import { RoomAudioRenderer, RoomContext, StartAudio } from '@livekit/components-react';
import type { AppConfig } from '@/app-config';
import { SessionView } from '@/components/app/session-view';
import { WelcomeView } from '@/components/app/welcome-view';
import { Toaster } from '@/components/livekit/toaster';
import { useRoom } from '@/hooks/useRoom';

const MotionWelcomeView = motion.create(WelcomeView);
const MotionSessionView = motion.create(SessionView);

const VIEW_MOTION_PROPS = {
  variants: {
    visible: {
      opacity: 1,
    },
    hidden: {
      opacity: 0,
    },
  },
  initial: 'hidden',
  animate: 'visible',
  exit: 'hidden',
  transition: {
    duration: 0.5,
    ease: 'linear',
  },
};

interface AppProps {
  appConfig: AppConfig;
}

export function App({ appConfig }: AppProps) {
  const { room, sessionStarted, setSessionStarted } = useRoom(appConfig);
  const { startButtonText } = appConfig;

  const handleStartCall = () => {
    setSessionStarted(true);
  };

  return (
    <RoomContext.Provider value={room}>
      <main className="grid h-svh grid-cols-1 place-content-center">
        <AnimatePresence mode="wait">
          {/* Welcome screen */}
          {!sessionStarted && (
            <MotionWelcomeView
              key="welcome"
              {...VIEW_MOTION_PROPS}
              startButtonText={startButtonText}
              onStartCall={handleStartCall}
            />
          )}

          {/* Session view */}
          {sessionStarted && (
            <MotionSessionView key="session-view" {...VIEW_MOTION_PROPS} appConfig={appConfig} />
          )}
        </AnimatePresence>
      </main>

      <StartAudio label="Start Audio" />
      <RoomAudioRenderer />
      <Toaster />
    </RoomContext.Provider>
  );
}
