'use client';

import { AnimatePresence, type HTMLMotionProps, motion } from 'motion/react';
import { type ReceivedChatMessage } from '@livekit/components-react';
import { ChatEntry } from '@/components/livekit/chat-entry';

const MotionContainer = motion.create('div');
const MotionChatEntry = motion.create(ChatEntry);

const CONTAINER_MOTION_PROPS = {
  variants: {
    hidden: {
      opacity: 0,
      transition: {
        ease: 'easeOut',
        duration: 0.3,
        staggerChildren: 0.1,
        staggerDirection: -1,
      },
    },
    visible: {
      opacity: 1,
      transition: {
        delay: 0.2,
        ease: 'easeOut',
        duration: 0.3,
        staggerDelay: 0.2,
        staggerChildren: 0.1,
        staggerDirection: 1,
      },
    },
  },
  initial: 'hidden',
  animate: 'visible',
  exit: 'hidden',
};

const MESSAGE_MOTION_PROPS = {
  variants: {
    hidden: {
      opacity: 0,
      translateY: 10,
    },
    visible: {
      opacity: 1,
      translateY: 0,
    },
  },
};

interface ChatTranscriptProps {
  hidden?: boolean;
  messages?: ReceivedChatMessage[];
  showParticipantNames?: boolean;
}

export function ChatTranscript({
  hidden = false,
  messages = [],
  showParticipantNames = false,
  ...props
}: ChatTranscriptProps & Omit<HTMLMotionProps<'div'>, 'ref'>) {
  return (
    <AnimatePresence>
      {!hidden && (
        <MotionContainer {...CONTAINER_MOTION_PROPS} {...props}>
          {messages.map(({ id, timestamp, from, message, editTimestamp }: ReceivedChatMessage) => {
            const locale = navigator?.language ?? 'en-US';

            // 处理 from 为 undefined 的情况
            let messageOrigin: 'local' | 'remote' = 'remote';
            let participantName = '';

            if (from) {
              messageOrigin = from.isLocal ? 'local' : 'remote';
              if (showParticipantNames) {
                participantName = from.name || from.identity || 'Unknown';
              } else {
                participantName = ''; // 默认不显示任何名称
              }
            } else {
              // 如果 from 为 undefined，根据消息内容推断来源
              messageOrigin = message.length > 100 ? 'remote' : 'local';
              if (showParticipantNames) {
                participantName = messageOrigin === 'remote' ? 'Assistant' : 'User';
              } else {
                participantName = ''; // 默认不显示任何名称
              }
            }

            const hasBeenEdited = !!editTimestamp;

            return (
              <MotionChatEntry
                key={id}
                locale={locale}
                timestamp={timestamp}
                message={message}
                messageOrigin={messageOrigin}
                name={participantName}
                hasBeenEdited={hasBeenEdited}
                {...MESSAGE_MOTION_PROPS}
              />
            );
          })}
        </MotionContainer>
      )}
    </AnimatePresence>
  );
}
