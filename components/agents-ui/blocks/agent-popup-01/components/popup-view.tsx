'use client';

import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { type AgentControlBarControls } from '@/components/agents-ui/agent-control-bar';
import { AgentSessionView_01 } from '@/components/agents-ui/blocks/agent-session-view-01/components/agent-session-block';
import type { AudioVisualizerConfig } from '@/components/agents-ui/blocks/agent-session-view-01/components/agent-session-block';
import { StartAudioButton } from '@/components/agents-ui/start-audio-button';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/shadcn/utils';
import type { AgentPopupError } from './agent-popup-block';

interface ErrorOverlayProps {
  logo?: string;
  agentName?: string;
  error?: AgentPopupError;
}

function ErrorOverlay({ logo, agentName, error }: ErrorOverlayProps) {
  const [logoFailed, setLogoFailed] = useState(false);
  useEffect(() => {
    setLogoFailed(false);
  }, [logo]);
  const showLogo = Boolean(logo) && !logoFailed;

  return error ? (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      data-testid="error-overlay"
      className={cn(
        'bg-background absolute inset-0 z-50 flex h-full w-full flex-col items-center justify-center gap-5 px-6 text-center transition-opacity'
      )}
    >
      {showLogo ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={logo}
          alt={`${agentName ?? 'Agent'} logo`}
          className="size-6 object-contain"
          referrerPolicy="no-referrer"
          onError={() => setLogoFailed(true)}
        />
      ) : null}
      <span className="text-foreground leading-tight font-medium text-pretty">{error?.title}</span>
      <span className="text-muted-foreground text-sm text-balance">{error?.description}</span>
    </motion.div>
  ) : null;
}

export interface PopupViewProps {
  agentName?: string;
  logo?: string;
  error?: AgentPopupError;
  controls: AgentControlBarControls;
  themeMode?: 'dark' | 'light';
  preConnectMessage?: string;
  isPreConnectBufferEnabled?: boolean;
  audioVisualizer?: AudioVisualizerConfig;
  onDisconnect?: () => void;
}

export function PopupView({
  agentName,
  logo,
  error,
  controls,
  themeMode,
  isPreConnectBufferEnabled,
  preConnectMessage,
  audioVisualizer,
  onDisconnect,
}: PopupViewProps) {
  return (
    <motion.div
      initial={{ opacity: 0, translateY: 8 }}
      animate={{ opacity: 1, translateY: 0 }}
      exit={{ opacity: 0, translateY: 8 }}
      transition={{ type: 'spring', bounce: 0, duration: 0.4 }}
      className="fixed right-4 bottom-20 left-4 z-50 h-[480px] md:left-auto md:w-[360px]"
    >
      <div className="relative flex h-full w-full flex-col overflow-hidden rounded-[40px] border drop-shadow-md">
        <AnimatePresence>
          <ErrorOverlay logo={logo} agentName={agentName} error={error} />
        </AnimatePresence>
        <StartAudioButton label="Enable Audio" className="mx-4 mt-2 rounded-full" />
        <AgentSessionView_01
          controls={controls}
          themeMode={themeMode}
          isPreConnectBufferEnabled={isPreConnectBufferEnabled}
          preConnectMessage={preConnectMessage}
          audioVisualizer={audioVisualizer}
          onDisconnect={onDisconnect}
        />
      </div>
    </motion.div>
  );
}
