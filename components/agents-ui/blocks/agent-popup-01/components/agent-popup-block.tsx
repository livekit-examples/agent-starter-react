'use client';

import { type ComponentProps, useCallback, useEffect, useRef, useState } from 'react';
import { type TokenSourceConfigurable, type TokenSourceFixed } from 'livekit-client';
import { useAgent, useSession } from '@livekit/components-react';
import { type AgentControlBarControls } from '@/components/agents-ui/agent-control-bar';
import { AgentSessionProvider } from '@/components/agents-ui/agent-session-provider';
import type { AudioVisualizerConfig } from '@/components/agents-ui/blocks/agent-session-view-01/components/agent-session-block';
import { PopupView } from './popup-view';
import { Trigger } from './trigger';

const DEFAULT_CONTROLS: AgentControlBarControls = {
  leave: false,
  microphone: true,
  chat: false,
  camera: false,
  screenShare: false,
};

export interface AgentPopupError {
  title: string;
  description: string;
}

function TriggerProvider({ ...props }: ComponentProps<typeof Trigger>) {
  const { isConnected } = useAgent();

  return <Trigger {...props} isConnected={isConnected} />;
}

export interface AgentPopupProps {
  /** Logo shown in the trigger bubble in place of the default agent icon. */
  logo?: string;
  /** @default 'Agent' */
  agentName?: string;
  /** Where to fetch a LiveKit session token from. See `useSession`'s `tokenSource` argument. */
  tokenSource: TokenSourceConfigurable | TokenSourceFixed;
  /**
   * Theme mode forwarded to the aura visualizer (`audioVisualizer.type === 'aura'`) so the
   * shader's blend mode adapts to the theme mode. Ignored by other visualizer types.
   */
  themeMode?: 'dark' | 'light';
  /**
   * Message shown above the controls before the first chat message is sent.
   *
   * @default 'Agent is listening, ask it a question'
   */
  preConnectMessage?: string;
  /**
   * An object with the following keys: leave, microphone, screenShare, camera, chat. Each key maps
   * to a boolean value that determines whether the control is displayed.
   *
   * @default { leave: false, microphone: true, chat: false, camera: false, screenShare: false }
   */
  controls?: AgentControlBarControls;
  /** Brand color used for the trigger bubble's idle ring/disc and fallback icon contrast. */
  triggerColor?: `#${string}`;
  /**
   * Shows a pre-connect buffer state with a shimmer message before messages appear.
   *
   * @default true
   */
  isPreConnectBufferEnabled?: boolean;
  /**
   * Configures the visualizer style rendered in the main tile area.
   *
   * @default { type: 'bar', size: 'lg' }
   */
  audioVisualizer?: AudioVisualizerConfig;
}

export function AgentPopup_01({
  logo,
  themeMode,
  tokenSource,
  triggerColor,
  agentName = 'Agent',
  controls = DEFAULT_CONTROLS,
  isPreConnectBufferEnabled,
  preConnectMessage,
  audioVisualizer = {
    type: 'bar',
    size: 'lg',
  },
}: AgentPopupProps) {
  const session = useSession(tokenSource);
  const [popupOpen, setPopupOpen] = useState(false);
  const [error, setError] = useState<AgentPopupError>();

  // Drive the session lifecycle off the popup-open state. Opening the popup
  // connects; closing it (or unmounting) tears the room down so we don't
  // leave a mic-hot connection while the bubble sits idle.
  //
  // useSession returns a fresh object on every connectionState change (the
  // discriminated union swaps shape), so we can't depend on `session`
  // directly - that would tear down + restart the room every time it
  // transitioned through connecting -> connected. We pin the start/end
  // calls via a ref instead, and only react to popupOpen.
  const sessionRef = useRef(session);
  sessionRef.current = session;

  useEffect(() => {
    if (!popupOpen) return;
    let cancelled = false;
    sessionRef.current.start().catch((cause) => {
      if (cancelled) return;

      console.error('agent-popup-01: session.start failed:', cause);
      setError({
        title: 'Could not connect to the agent',
        description: cause instanceof Error ? cause.message : String(cause),
      });
    });
    return () => {
      cancelled = true;
      void sessionRef.current.end();
    };
  }, [popupOpen]);

  const handleToggle = useCallback(() => {
    setPopupOpen((open) => {
      const next = !open;
      if (!next) setError(undefined);
      return next;
    });
  }, []);

  const finalControls = {
    ...DEFAULT_CONTROLS,
    ...controls,
  };

  return (
    <AgentSessionProvider session={session}>
      <TriggerProvider
        logo={logo}
        error={error}
        color={triggerColor}
        agentName={agentName}
        isPressed={popupOpen}
        onToggle={handleToggle}
        className="fixed right-4 bottom-4 z-50"
      />
      {popupOpen && (
        <PopupView
          logo={logo}
          error={error}
          agentName={agentName}
          themeMode={themeMode}
          isPreConnectBufferEnabled={isPreConnectBufferEnabled}
          preConnectMessage={preConnectMessage}
          audioVisualizer={audioVisualizer}
          controls={finalControls}
          onDisconnect={handleToggle}
        />
      )}
    </AgentSessionProvider>
  );
}
