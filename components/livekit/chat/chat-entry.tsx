import * as React from 'react';
import type { MessageFormatter, ReceivedChatMessage } from '@livekit/components-react';
import { cn } from '@/lib/utils';
import { useChatMessage } from './hooks/utils';
import { ReceivedMessage, SentMessage } from '@/agent-sdk';

export interface ChatEntryProps extends React.HTMLAttributes<HTMLLIElement> {
  /** The chat massage object to display. */
  entry: ReceivedMessage | SentMessage;
  /** Hide sender name. Useful when displaying multiple consecutive chat messages from the same person. */
  hideName?: boolean;
  /** Hide message timestamp. */
  hideTimestamp?: boolean;
  /** An optional formatter for the message body. */
  messageFormatter?: MessageFormatter;
}

export const ChatEntry = ({
  entry,
  messageFormatter,
  hideName,
  hideTimestamp,
  className,
  ...props
}: ChatEntryProps) => {
  // FIXME: Where would this kind of metadata come from for real?
  // const { message, hasBeenEdited, time, locale, name } = useChatMessage(entry, messageFormatter);
  const message = entry.content.text;
  const hasBeenEdited = false;
  const time = entry.timestamp;
  const locale = typeof navigator !== 'undefined' ? navigator.language : 'en-US';
  const name = entry.direction === 'outbound' ? 'User' : 'Agent';

  const isUser = entry.direction === 'outbound';//entry.from?.isLocal ?? false;
  const messageOrigin = isUser ? 'remote' : 'local';

  return (
    <li
      data-lk-message-origin={messageOrigin}
      title={time.toLocaleTimeString(locale, { timeStyle: 'full' })}
      className={cn('group flex flex-col gap-0.5', className)}
      {...props}
    >
      {(!hideTimestamp || !hideName || hasBeenEdited) && (
        <span className="text-muted-foreground flex text-sm">
          {!hideName && <strong className="mt-2">{name}</strong>}

          {!hideTimestamp && (
            <span className="align-self-end ml-auto font-mono text-xs opacity-0 transition-opacity ease-linear group-hover:opacity-100">
              {hasBeenEdited && '*'}
              {time.toLocaleTimeString(locale, { timeStyle: 'short' })}
            </span>
          )}
        </span>
      )}

      <span className={cn('max-w-4/5 rounded-[20px] p-2', isUser ? 'bg-muted ml-auto' : 'mr-auto')}>
        {message}
      </span>
    </li>
  );
};
