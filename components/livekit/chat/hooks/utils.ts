import * as React from 'react';
import type { MessageFormatter, ReceivedChatMessage } from '@livekit/components-react';

export const useChatMessage = (entry: ReceivedChatMessage, messageFormatter?: MessageFormatter) => {
  const formattedMessage = React.useMemo(() => {
    return messageFormatter ? messageFormatter(entry.message) : entry.message;
  }, [entry.message, messageFormatter]);
  const hasBeenEdited = !!entry.editTimestamp;
  const time = new Date(entry.timestamp);
  const locale = typeof navigator !== 'undefined' ? navigator.language : 'en-US';

  const name = entry.from?.name && entry.from.name !== '' ? entry.from.name : entry.from?.identity;

  return { message: formattedMessage, hasBeenEdited, time, locale, name };
};
