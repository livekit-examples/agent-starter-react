'use client';

import { useMemo } from 'react';
import { useTheme } from 'next-themes';
import { AnimatePresence, type MotionProps, motion } from 'motion/react';
import { useSessionContext } from '@livekit/components-react';
import type { AppConfig } from '@/app-config';
import { AgentSessionView_01 } from '@/components/agents-ui/blocks/agent-session-view-01';
import { WelcomeView } from '@/components/app/welcome-view';
import { usePrefersReducedMotion } from '@/hooks/use-reduced-motion';

const MotionWelcomeView = motion.create(WelcomeView);
const MotionSessionView = motion.create(AgentSessionView_01);

const VIEW_MOTION_PROPS: MotionProps = {
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

interface ViewControllerProps {
  appConfig: AppConfig;
  username?: string;
  onUsernameChange?: (name: string) => void;
  roomName?: string;
  onRoomNameChange?: (name: string) => void;
  agentName?: string;
  onAgentNameChange?: (name: string) => void;
  isChatFullscreen?: boolean;
}

export function ViewController({
  appConfig,
  username,
  onUsernameChange,
  roomName,
  onRoomNameChange,
  agentName,
  onAgentNameChange,
  isChatFullscreen,
}: ViewControllerProps) {
  const { isConnected, connectionState, start } = useSessionContext();
  const { resolvedTheme } = useTheme();
  const reducedMotion = usePrefersReducedMotion();
  const isConnecting = connectionState === 'connecting';

  const viewMotionProps = useMemo<MotionProps>(() => {
    if (!reducedMotion) return VIEW_MOTION_PROPS;
    return { ...VIEW_MOTION_PROPS, transition: { duration: 0 } };
  }, [reducedMotion]);

  return (
    <AnimatePresence mode="wait">
      {/* Welcome view */}
      {!isConnected && (
        <MotionWelcomeView
          key="welcome"
          {...viewMotionProps}
          startButtonText={appConfig.startButtonText}
          onStartCall={start}
          isConnecting={isConnecting}
          username={username}
          onUsernameChange={onUsernameChange}
          roomName={roomName}
          onRoomNameChange={onRoomNameChange}
          agentName={agentName}
          onAgentNameChange={onAgentNameChange}
        />
      )}
      {/* Session view */}
      {isConnected && (
        <MotionSessionView
          key="session-view"
          {...viewMotionProps}
          supportsChatInput={appConfig.supportsChatInput}
          supportsVideoInput={appConfig.supportsVideoInput}
          supportsScreenShare={appConfig.supportsScreenShare}
          isPreConnectBufferEnabled={appConfig.isPreConnectBufferEnabled}
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
          isChatFullscreen={isChatFullscreen}
          agentName={agentName}
          className="fixed inset-0"
        />
      )}
    </AnimatePresence>
  );
}
