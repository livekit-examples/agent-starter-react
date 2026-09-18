'use client';

import { type ComponentProps, useState } from 'react';
import { defaultSchema } from 'hast-util-sanitize';
import { Check, Copy } from 'lucide-react';
import rehypeSanitize from 'rehype-sanitize';
import { Streamdown, type StreamdownProps, defaultRehypePlugins } from 'streamdown';
import { type AgentState, type ReceivedMessage } from '@livekit/components-react';
import { AgentChatIndicator } from '@/components/agents-ui/agent-chat-indicator';
import { Bubble, BubbleContent } from '@/components/ui/bubble';
import { Button } from '@/components/ui/button';
import { Marker, MarkerContent, MarkerIcon } from '@/components/ui/marker';
import { Message, MessageAvatar, MessageContent, MessageFooter } from '@/components/ui/message';
import {
  MessageScroller,
  MessageScrollerButton,
  MessageScrollerContent,
  MessageScrollerItem,
  MessageScrollerProvider,
  MessageScrollerViewport,
} from '@/components/ui/message-scroller';
import { AGENT_AVATAR_LABEL, THINKING_TEXT } from '@/lib/agent-states';
import { cn } from '@/lib/shadcn/utils';

const chatRehypeSchema = {
  ...defaultSchema,
  protocols: {
    ...(defaultSchema.protocols ?? {}),
    src: [...(defaultSchema.protocols?.src ?? []), 'data'],
  },
  tagNames: [...(defaultSchema.tagNames ?? []), 'iframe'],
  attributes: {
    ...(defaultSchema.attributes ?? {}),
    iframe: [
      'allow',
      'allowFullScreen',
      'height',
      'loading',
      'name',
      'referrerPolicy',
      'sandbox',
      'src',
      'title',
      'width',
    ],
  },
};

const chatRehypePlugins: NonNullable<StreamdownProps['rehypePlugins']> = [
  defaultRehypePlugins.raw,
  defaultRehypePlugins.katex,
  [rehypeSanitize, chatRehypeSchema],
  defaultRehypePlugins.harden,
];

function CopyMessageButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // clipboard unavailable, ignore
    }
  };

  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      onClick={handleCopy}
      aria-label={copied ? 'Скопировано' : 'Скопировать сообщение'}
      className="h-5 gap-1 rounded-full px-2 text-[11px] opacity-0 transition-opacity group-hover/message:opacity-100 focus-visible:opacity-100"
    >
      {copied ? <Check className="size-3" /> : <Copy className="size-3" />}
      {copied ? 'Скопировано' : 'Копировать'}
    </Button>
  );
}

/**
 * Props for the AgentChatTranscript component.
 */
export interface AgentChatTranscriptProps
  extends
    ComponentProps<'div'>,
    ComponentProps<typeof MessageScrollerProvider>,
    ComponentProps<typeof MessageScrollerViewport>,
    ComponentProps<typeof MessageScrollerContent> {
  /**
   * Whether to automatically scroll to the bottom of the transcript when new messages are added.
   * @defaultValue true
   */
  autoScroll?: boolean;
  /**
   * The scroll anchor to use when auto-scrolling.
   * @defaultValue false
   */
  scrollAnchor?: boolean | 'user' | 'other' | 'any';
  /**
   * The scroll button render function
   */
  scrollButtonRender?: ComponentProps<typeof MessageScrollerButton>['render'];
  /**
   * The scroll button behavior
   */
  scrollButtonBehavior?: ComponentProps<typeof MessageScrollerButton>['behavior'];
  /**
   * The scroll button direction
   */
  scrollButtonDirection?: ComponentProps<typeof MessageScrollerButton>['direction'];
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
  /**
   * When true, every message is aligned the same way (stacked vertically)
   * instead of user messages aligning right and agent messages aligning left.
   */
  isFullscreen?: boolean;
}

/**
 * A chat transcript component that displays a conversation between the user and agent.
 * Shows messages with timestamps and origin indicators, plus a thinking indicator
 * when the agent is processing.
 *
 * @extends ComponentProps<'div'>, ComponentProps<typeof MessageScrollerProvider>, ComponentProps<typeof MessageScrollerViewport>, ComponentProps<typeof MessageScrollerContent>
 *
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
  scrollAnchor,
  autoScroll = true,
  scrollMargin,
  scrollEdgeThreshold,
  preserveScrollOnPrepend,
  scrollPreviousItemPeek,
  defaultScrollPosition = 'last-anchor',
  scrollButtonRender,
  scrollButtonBehavior,
  scrollButtonDirection,
  spacerClassName,
  agentState,
  messages = [],
  isFullscreen = false,
  className,
  ...props
}: AgentChatTranscriptProps) {
  return (
    <MessageScrollerProvider
      autoScroll={autoScroll}
      scrollMargin={scrollMargin}
      defaultScrollPosition={defaultScrollPosition}
      scrollEdgeThreshold={scrollEdgeThreshold}
      scrollPreviousItemPeek={scrollPreviousItemPeek}
    >
      <MessageScroller className={className} {...props}>
        <MessageScrollerViewport preserveScrollOnPrepend={preserveScrollOnPrepend}>
          <MessageScrollerContent
            spacerClassName={spacerClassName}
            aria-busy={agentState === 'thinking'}
          >
            {messages.map((receivedMessage) => {
              const { id, timestamp, from, message } = receivedMessage;
              const time = new Date(timestamp);
              const isUser = from?.isLocal;
              const align = isFullscreen ? 'start' : isUser ? 'end' : 'start';
              const locale = typeof navigator !== 'undefined' ? navigator.language : 'ru-RU';
              const title = time.toLocaleTimeString(locale, { timeStyle: 'full' });
              const timeLabel = time.toLocaleTimeString(locale, {
                hour: '2-digit',
                minute: '2-digit',
              });
              let _scrollAnchor = false;

              if (
                scrollAnchor === 'any' ||
                (scrollAnchor === 'user' && isUser) ||
                (scrollAnchor === 'other' && !isUser)
              ) {
                _scrollAnchor = true;
              }

              return (
                <MessageScrollerItem key={id} messageId={id} scrollAnchor={_scrollAnchor}>
                  <Message align={align} title={title}>
                    {!isUser && (
                      <MessageAvatar
                        aria-label={AGENT_AVATAR_LABEL}
                        className="size-6 min-w-0 text-[10px] font-semibold"
                      >
                        {AGENT_AVATAR_LABEL.slice(0, 1)}
                      </MessageAvatar>
                    )}
                    <MessageContent>
                      <Bubble align={align} variant={isUser ? 'secondary' : 'ghost'}>
                        <BubbleContent>
                          <Streamdown rehypePlugins={chatRehypePlugins}>{message}</Streamdown>
                        </BubbleContent>
                      </Bubble>
                      <MessageFooter
                        className={cn('gap-1.5', align === 'end' && 'flex-row-reverse')}
                      >
                        <span className="tabular-nums">{timeLabel}</span>
                        <CopyMessageButton text={message} />
                      </MessageFooter>
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
                  <MarkerContent className="shimmer">{THINKING_TEXT}</MarkerContent>
                </Marker>
              </MessageScrollerItem>
            )}
          </MessageScrollerContent>
        </MessageScrollerViewport>

        {/* Scroll to bottom button */}
        <MessageScrollerButton
          variant="outline"
          className="rounded-full"
          render={scrollButtonRender}
          behavior={scrollButtonBehavior}
          direction={scrollButtonDirection}
        />
      </MessageScroller>
    </MessageScrollerProvider>
  );
}
