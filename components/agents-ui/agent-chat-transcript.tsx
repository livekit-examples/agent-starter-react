'use client';

import { type ComponentProps } from 'react';
import { Streamdown } from 'streamdown';
import { type AgentState, type ReceivedMessage } from '@livekit/components-react';
import { AgentChatIndicator } from '@/components/agents-ui/agent-chat-indicator';
import { Bubble, BubbleContent } from '@/components/ui/bubble';
import { Marker, MarkerContent, MarkerIcon } from '@/components/ui/marker';
import { Message, MessageContent } from '@/components/ui/message';
import {
  MessageScroller,
  MessageScrollerButton,
  MessageScrollerContent,
  MessageScrollerItem,
  MessageScrollerProvider,
  MessageScrollerViewport,
} from '@/components/ui/message-scroller';

/**
 * Props for the AgentChatTranscript component.
 */
export interface AgentChatTranscriptProps extends ComponentProps<'div'> {
  /**
   * The current state of the agent. When 'thinking', displays a loading indicator.
   */
  agentState?: AgentState;
  /**
   * Array of messages to display in the transcript.
   * @defaultValue []
   */
  messages?: ReceivedMessage[];
  /**
   * Additional CSS class names to apply to the conversation container.
   */
  className?: string;
}

/**
 * A chat transcript component that displays a conversation between the user and agent.
 * Shows messages with timestamps and origin indicators, plus a thinking indicator
 * when the agent is processing.
 *
 * @extends ComponentProps<'div'>
 *
 * @example
 * ```tsx
 * <AgentChatTranscript
 *   agentState={agentState}
 *   messages={chatMessages}
 * />
 * ```
 */
export function AgentChatTranscript({
  agentState,
  messages = [],
  className,
  ...props
}: AgentChatTranscriptProps) {
  return (
    <MessageScrollerProvider
      autoScroll
      scrollEdgeThreshold={20}
      defaultScrollPosition="last-anchor"
    >
      <MessageScroller className={className} {...props}>
        <MessageScrollerViewport>
          <MessageScrollerContent aria-busy={agentState === 'thinking'}>
            {messages.map((receivedMessage) => {
              const { id, timestamp, from, message } = receivedMessage;
              const time = new Date(timestamp);
              const isUser = from?.isLocal;
              const locale = typeof navigator !== 'undefined' ? navigator.language : 'en-US';
              const title = time.toLocaleTimeString(locale, { timeStyle: 'full' });

              return (
                <MessageScrollerItem key={id} messageId={id}>
                  <Message align={isUser ? 'end' : 'start'} title={title}>
                    <MessageContent>
                      <Bubble
                        align={isUser ? 'end' : 'start'}
                        variant={isUser ? 'secondary' : 'ghost'}
                      >
                        <BubbleContent>
                          <Streamdown>{message}</Streamdown>
                        </BubbleContent>
                      </Bubble>
                    </MessageContent>
                  </Message>
                </MessageScrollerItem>
              );
            })}

            {/* Agent is thinking indicator */}
            {agentState === 'thinking' && (
              <MessageScrollerItem>
                <Marker role="status">
                  <MarkerIcon>
                    <AgentChatIndicator size="sm" />
                  </MarkerIcon>
                  <MarkerContent className="shimmer">Thinking...</MarkerContent>
                </Marker>
              </MessageScrollerItem>
            )}
          </MessageScrollerContent>
        </MessageScrollerViewport>
        <MessageScrollerButton />
      </MessageScroller>
    </MessageScrollerProvider>
  );
}
