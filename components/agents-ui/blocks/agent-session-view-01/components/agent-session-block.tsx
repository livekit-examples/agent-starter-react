'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { RpcError, type RpcInvocationData } from 'livekit-client';
import { AnimatePresence, type MotionProps, motion } from 'motion/react';
import { useAgent, useSessionContext, useSessionMessages } from '@livekit/components-react';
import { AgentChatTranscript } from '@/components/agents-ui/agent-chat-transcript';
import {
  AgentControlBar,
  type AgentControlBarControls,
  type Command,
} from '@/components/agents-ui/agent-control-bar';
import { CallStatus } from '@/components/app/call-status';
import { cn } from '@/lib/shadcn/utils';
import { TileLayout } from './tile-view';

const BOTTOM_VIEW_MOTION_PROPS: MotionProps = {
  variants: {
    visible: {
      opacity: 1,
      translateY: '0%',
    },
    hidden: {
      opacity: 0,
      translateY: '100%',
    },
  },
  initial: 'hidden',
  animate: 'visible',
  exit: 'hidden',
  transition: {
    duration: 0.3,
    delay: 0.5,
    ease: 'easeOut',
  },
};

const CHAT_MOTION_PROPS: MotionProps = {
  variants: {
    hidden: {
      opacity: 0,
      transition: {
        ease: 'easeOut',
        duration: 0.3,
      },
    },
    visible: {
      opacity: 1,
      transition: {
        delay: 0.2,
        ease: 'easeOut',
        duration: 0.3,
      },
    },
  },
  initial: 'hidden',
  animate: 'visible',
  exit: 'hidden',
};

const SHIMMER_MOTION_PROPS: MotionProps = {
  variants: {
    visible: {
      opacity: 1,
      transition: {
        ease: 'easeIn',
        duration: 0.5,
        delay: 0.8,
      },
    },
    hidden: {
      opacity: 0,
      transition: {
        ease: 'easeIn',
        duration: 0.5,
        delay: 0,
      },
    },
  },
  initial: 'hidden',
  animate: 'visible',
  exit: 'hidden',
};

interface FadeProps {
  top?: boolean;
  bottom?: boolean;
  className?: string;
}

export function Fade({ top = false, bottom = false, className }: FadeProps) {
  return (
    <div
      className={cn(
        'from-background pointer-events-none h-4 bg-linear-to-b to-transparent',
        top && 'bg-linear-to-b',
        bottom && 'bg-linear-to-t',
        className
      )}
    />
  );
}

export interface AgentSessionView_01Props {
  /**
   * Theme mode forwarded to the aura visualizer (`audioVisualizerType="aura"`) so
   * the shader's blend mode adapts to the theme mode.
   * Ignored by other visualizer types.
   */
  themeMode?: 'dark' | 'light';
  /**
   * Message shown above the controls before the first chat message is sent.
   *
   * @default 'Agent is listening, ask it a question'
   */
  preConnectMessage?: string;
  /**
   * Enables or disables the chat toggle and transcript input controls.
   *
   * @default true
   */
  supportsChatInput?: boolean;
  /**
   * Enables or disables camera controls in the bottom control bar.
   *
   * @default true
   */
  supportsVideoInput?: boolean;
  /**
   * Enables or disables screen sharing controls in the bottom control bar.
   *
   * @default true
   */
  supportsScreenShare?: boolean;
  /**
   * Shows a pre-connect buffer state with a shimmer message before messages appear.
   *
   * @default true
   */
  isPreConnectBufferEnabled?: boolean;

  /** Selects the visualizer style rendered in the main tile area. */
  audioVisualizerType?: 'bar' | 'wave' | 'grid' | 'radial' | 'aura';
  /** Primary hex color used by supported audio visualizer variants. */
  audioVisualizerColor?: `#${string}`;
  /** Hue shift intensity used by certain visualizers. */
  audioVisualizerColorShift?: number;
  /** Number of bars to render when `audioVisualizerType` is `bar`. */
  audioVisualizerBarCount?: number;
  /** Number of rows in the visualizer when `audioVisualizerType` is `grid`. */
  audioVisualizerGridRowCount?: number;
  /** Number of columns in the visualizer when `audioVisualizerType` is `grid`. */
  audioVisualizerGridColumnCount?: number;
  /** Number of radial bars when `audioVisualizerType` is `radial`. */
  audioVisualizerRadialBarCount?: number;
  /** Base radius of the radial visualizer when `audioVisualizerType` is `radial`. */
  audioVisualizerRadialRadius?: number;
  /** Stroke width of the wave path when `audioVisualizerType` is `wave`. */
  audioVisualizerWaveLineWidth?: number;
  /** Optional class name merged onto the outer `<section>` container. */
  className?: string;
  /**
   * When true, the chat transcript expands to fill the full screen width
   * instead of the centered default width.
   *
   * @default false
   */
  isChatFullscreen?: boolean;
  /** Name of the agent shown in the in-call status pill. */
  agentName?: string;
}

export function AgentSessionView_01({
  preConnectMessage = 'Агент слушает, задайте вопрос',
  supportsChatInput = true,
  supportsVideoInput = true,
  supportsScreenShare = true,
  isPreConnectBufferEnabled = true,
  isChatFullscreen = false,
  agentName,
  audioVisualizerType,
  audioVisualizerColor,
  audioVisualizerColorShift,
  audioVisualizerBarCount,
  audioVisualizerGridRowCount,
  audioVisualizerGridColumnCount,
  audioVisualizerRadialBarCount,
  audioVisualizerRadialRadius,
  audioVisualizerWaveLineWidth,
  themeMode,
  ref,
  className,
  ...props
}: React.ComponentProps<'section'> & AgentSessionView_01Props) {
  const session = useSessionContext();
  const { messages } = useSessionMessages(session);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [clearedAt, setClearedAt] = useState<number>(0);
  const [rpcCommands, setRpcCommands] = useState<Command[] | undefined>(undefined);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const { state: agentState } = useAgent();

  useEffect(() => {
    const room = session.room;
    if (!room) return;

    room.registerRpcMethod('clear_chat', async (_data: RpcInvocationData) => {
      setClearedAt(Date.now());
      return JSON.stringify({ success: true });
    });

    room.registerRpcMethod('update_commands', async (data: RpcInvocationData) => {
      const payload = JSON.parse(data.payload) as { commands: Command[] };
      if (Array.isArray(payload.commands)) {
        setRpcCommands(payload.commands);
      }
      return JSON.stringify({ success: true });
    });

    room.registerRpcMethod('getUserLocation', async (data: RpcInvocationData) => {
      try {
        const params = JSON.parse(data.payload) as { highAccuracy?: boolean };
        const position: GeolocationPosition = await new Promise((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject, {
            enableHighAccuracy: params.highAccuracy ?? false,
            timeout: data.responseTimeout,
          });
        });

        return JSON.stringify({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        });
      } catch {
        throw new RpcError(1, 'Could not retrieve user location');
      }
    });

    // Request the user's live geolocation and forward it to the agent (backend) via RPC.
    const sendUserLocation = () => {
      const agentParticipant = Array.from(room.remoteParticipants.values())[0];
      if (!agentParticipant) return;
      room.off('participantConnected', sendUserLocation);

      navigator.geolocation.getCurrentPosition(
        async (position: GeolocationPosition) => {
          try {
            await room.localParticipant?.performRpc({
              destinationIdentity: agentParticipant.identity,
              method: 'setUserLocation',
              payload: JSON.stringify({
                latitude: position.coords.latitude,
                longitude: position.coords.longitude,
                accuracy: position.coords.accuracy,
              }),
              responseTimeout: 10000,
            });
          } catch (error) {
            console.error('Failed to send geolocation to agent:', error);
          }
        },
        (error) => {
          console.error('Failed to retrieve geolocation:', error);
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
      );
    };

    sendUserLocation();
    room.on('participantConnected', sendUserLocation);

    return () => {
      room.unregisterRpcMethod('clear_chat');
      room.unregisterRpcMethod('update_commands');
      room.unregisterRpcMethod('getUserLocation');
      room.off('participantConnected', sendUserLocation);
    };
  }, [session.room]);

  const filteredMessages =
    clearedAt > 0 ? messages.filter((m) => m.timestamp > clearedAt) : messages;

  const handleClear = useCallback(() => {
    setClearedAt(Date.now());
  }, []);

  const controls: AgentControlBarControls = {
    leave: true,
    microphone: true,
    chat: supportsChatInput,
    camera: supportsVideoInput,
    screenShare: supportsScreenShare,
  };

  return (
    <section
      ref={ref}
      className={cn('bg-background relative z-10 h-full w-full overflow-hidden', className)}
      {...props}
    >
      {/* In-call status */}
      <div className="absolute inset-x-0 top-4 z-30 flex justify-center md:top-6">
        <CallStatus agentName={agentName} />
      </div>
      <Fade top className="absolute inset-x-4 top-0 z-10 h-40" />
      {/* transcript */}
      <AnimatePresence>
        {isChatOpen && (
          <motion.div
            {...CHAT_MOTION_PROPS}
            className="absolute inset-x-0 top-0 bottom-[135px] overflow-hidden md:bottom-[170px]"
          >
            <AgentChatTranscript
              agentState={agentState}
              messages={filteredMessages}
              isFullscreen={isChatFullscreen}
              className={cn(
                '**:data-[slot=message-scroller-content]:p-4 **:data-[slot=message-scroller-content]:pt-40!',
                isChatFullscreen
                  ? 'md:**:data-[slot=message-scroller-content]:px-6 md:**:data-[slot=message-scroller-content]:pt-44'
                  : 'mx-auto max-w-2xl md:**:data-[slot=message-scroller-content]:p-6'
              )}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Tile layout */}
      <TileLayout
        isChatOpen={isChatOpen}
        themeMode={themeMode}
        audioVisualizerType={audioVisualizerType}
        audioVisualizerColor={audioVisualizerColor}
        audioVisualizerColorShift={audioVisualizerColorShift}
        audioVisualizerBarCount={audioVisualizerBarCount}
        audioVisualizerRadialBarCount={audioVisualizerRadialBarCount}
        audioVisualizerRadialRadius={audioVisualizerRadialRadius}
        audioVisualizerGridRowCount={audioVisualizerGridRowCount}
        audioVisualizerGridColumnCount={audioVisualizerGridColumnCount}
        audioVisualizerWaveLineWidth={audioVisualizerWaveLineWidth}
      />
      {/* Bottom */}
      <motion.div
        {...BOTTOM_VIEW_MOTION_PROPS}
        className="absolute inset-x-3 bottom-0 z-50 md:inset-x-12"
      >
        {/* Pre-connect message */}
        {isPreConnectBufferEnabled && (
          <AnimatePresence>
            {messages.length === 0 && (
              <motion.p
                key="pre-connect-message"
                aria-hidden={messages.length > 0}
                {...SHIMMER_MOTION_PROPS}
                className="shimmer shimmer-duration-2000 pointer-events-none mx-auto block w-full max-w-2xl pb-4 text-center text-sm font-semibold"
              >
                {preConnectMessage}
              </motion.p>
            )}
          </AnimatePresence>
        )}
        <div className="bg-background relative mx-auto max-w-2xl pb-3 md:pb-12">
          <AgentControlBar
            variant="livekit"
            controls={controls}
            commands={rpcCommands}
            isChatOpen={isChatOpen}
            isConnected={session.isConnected}
            onDisconnect={session.end}
            onIsChatOpenChange={setIsChatOpen}
            onClear={handleClear}
          />
        </div>
      </motion.div>
    </section>
  );
}
