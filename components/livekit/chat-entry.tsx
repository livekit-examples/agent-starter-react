import * as React from 'react';
import { useMemo } from 'react';
import type { MessageFormatter, ReceivedChatMessage } from '@livekit/components-react';
import { cn } from '@/lib/utils';

export interface ChatEntryProps extends React.HTMLAttributes<HTMLLIElement> {
  /** The chat massage object to display. */
  entry: ReceivedChatMessage;
  /** Hide sender name. Useful when displaying multiple consecutive chat messages from the same person. */
  hideName?: boolean;
  /** Hide message timestamp. */
  hideTimestamp?: boolean;
  /** An optional formatter for the message body. */
  messageFormatter?: MessageFormatter;
}

export const ChatEntry = ({
  entry,
  hideName = false,
  hideTimestamp = false,
  className,
  messageFormatter,
  ...props
}: ChatEntryProps) => {
  const time = new Date(entry.timestamp);
  const hasBeenEdited = !!entry.editTimestamp;
  const name = entry.from?.name || entry.from?.identity;
  const locale = typeof navigator !== 'undefined' ? navigator.language : 'en-US';

  const isUser = entry.from?.isLocal ?? false;
  const messageOrigin = isUser ? 'remote' : 'local';
  const showHeader = !hideTimestamp || !hideName || hasBeenEdited;
  const title = time.toLocaleTimeString(locale, { timeStyle: 'full' });

  const formattedMessage = useMemo(() => {
    return messageFormatter ? messageFormatter(entry.message) : entry.message;
  }, [entry.message, messageFormatter]);

  return (
    <li
      title={title}
      data-lk-message-origin={messageOrigin}
      className={cn('group flex w-full flex-col gap-0.5', className)}
      {...props}
    >
      {showHeader && (
        <header className="text-muted-foreground flex text-sm">
          {!hideName && <strong className="mt-2">{name}</strong>}
          {!hideTimestamp && (
            <span className="align-self-end ml-auto font-mono text-xs opacity-0 transition-opacity ease-linear group-hover:opacity-100">
              {hasBeenEdited && '*'}
              {time.toLocaleTimeString(locale, { timeStyle: 'short' })}
            </span>
          )}
        </header>
      )}

      <span className={cn('max-w-4/5 rounded-[20px]', isUser ? 'bg-muted ml-auto p-2' : 'mr-auto')}>
        {formattedMessage}
      </span>
    </li>
  );
};
