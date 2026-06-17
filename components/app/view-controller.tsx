'use client';

import { useRef, useState, useSyncExternalStore } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { useRoomContext } from '@livekit/components-react';
import { useSession } from '@/components/app/session-provider';
import { SessionView } from '@/components/app/session-view';
import { WelcomeView } from '@/components/app/welcome-view';
import { getAgentSessionStopPending, subscribeAgentSessionStop } from '@/lib/session-stop-client';

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

export function ViewController() {
  const room = useRoomContext();
  const isSessionActiveRef = useRef(false);
  const { appConfig, isSessionActive, startSession } = useSession();
  const [startPending, setStartPending] = useState(false);
  const stopPending = useSyncExternalStore(
    subscribeAgentSessionStop,
    getAgentSessionStopPending,
    getAgentSessionStopPending
  );
  const isStartDisabled = isSessionActive || stopPending || startPending;

  // animation handler holds a reference to stale isSessionActive value
  isSessionActiveRef.current = isSessionActive;

  // disconnect room after animation completes
  const handleAnimationComplete = () => {
    if (!isSessionActiveRef.current && room.state !== 'disconnected') {
      room.disconnect();
    }
  };

  const handleStartCall = () => {
    if (isStartDisabled) {
      return;
    }

    void (async () => {
      setStartPending(true);
      try {
        await startSession();
      } finally {
        setStartPending(false);
      }
    })();
  };

  return (
    <AnimatePresence mode="wait">
      {/* Welcome screen */}
      {!isSessionActive && (
        <MotionWelcomeView
          key="welcome"
          {...VIEW_MOTION_PROPS}
          startButtonText={appConfig.startButtonText}
          onStartCall={handleStartCall}
          startDisabled={isStartDisabled}
          startPending={stopPending || startPending}
          startPendingLabel={stopPending ? 'Cleaning up...' : 'Starting...'}
        />
      )}
      {/* Session view */}
      {isSessionActive && (
        <MotionSessionView
          key="session-view"
          {...VIEW_MOTION_PROPS}
          appConfig={appConfig}
          onAnimationComplete={handleAnimationComplete}
        />
      )}
    </AnimatePresence>
  );
}
