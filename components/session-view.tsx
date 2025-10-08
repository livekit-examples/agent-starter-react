'use client';

import React, { useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  AgentControlBar,
  type ControlBarControls,
} from '@/components/livekit/agent-control-bar/agent-control-bar';
import { PreConnectMessage } from '@/components/livekit/preconnect-message';
import { Skrim } from '@/components/livekit/skrim';
import { TileLayout } from '@/components/livekit/tile-layout';
import { Transcript } from '@/components/livekit/transcript';
import { useChatTranscriptions } from '@/hooks/useChatAndTranscription';
import { useConnectionTimeout } from '@/hooks/useConnectionTimout';
import { useDebugMode } from '@/hooks/useDebug';
import type { AppConfig } from '@/lib/types';

const IN_DEVELOPMENT = process.env.NODE_END !== 'production';

const MotionTranscript = motion.create(Transcript);

interface SessionViewProps {
  appConfig: AppConfig;
}

export const SessionView = ({ appConfig, ref }: React.ComponentProps<'div'> & SessionViewProps) => {
  useConnectionTimeout(200_000);
  useDebugMode({ enabled: IN_DEVELOPMENT });

  const messages = useChatTranscriptions();
  const [chatOpen, setChatOpen] = useState(false);

  const controls: ControlBarControls = {
    leave: true,
    microphone: true,
    chat: appConfig.supportsChatInput,
    camera: appConfig.supportsVideoInput,
    screenShare: appConfig.supportsVideoInput,
  };

  return (
    <section ref={ref} className="bg-background relative z-10 h-full w-full overflow-hidden">
      {/* Transcript */}
      <AnimatePresence>
        {chatOpen && (
          <MotionTranscript
            messages={messages}
            initial={{
              opacity: 0,
              translateY: 10,
            }}
            animate={{
              opacity: 1,
              translateY: 0,
              transition: {
                delay: 0.2,
                duration: 0.3,
                ease: 'easeOut',
              },
            }}
            exit={{
              opacity: 0,
              translateY: 10,
              transition: {
                duration: 0.3,
                ease: 'easeOut',
              },
            }}
          />
        )}
      </AnimatePresence>

      {/* Tile Layout */}
      <TileLayout chatOpen={chatOpen} />

      {/* Bottom */}
      <motion.div
        initial={{
          opacity: 0,
          translateY: '100%',
        }}
        animate={{
          opacity: 1,
          translateY: '0%',
        }}
        transition={{
          duration: 0.3,
          delay: 0.5,
          ease: 'easeOut',
        }}
        className="fixed inset-x-3 bottom-0 z-50 md:inset-x-12"
      >
        {appConfig.isPreConnectBufferEnabled && <PreConnectMessage className="pb-4" />}
        <div className="bg-background relative mx-auto max-w-2xl pb-3 md:pb-12">
          <Skrim bottom className="absolute inset-x-0 top-0 h-4 -translate-y-full" />
          <AgentControlBar controls={controls} onChatOpenChange={setChatOpen} />
        </div>
      </motion.div>
    </section>
  );
};
