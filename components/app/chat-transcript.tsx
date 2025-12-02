'use client';

import { AnimatePresence, type HTMLMotionProps, motion } from 'motion/react';
import { type ReceivedMessage } from '@livekit/components-react';
import {
  Conversation,
  ConversationContent,
  ConversationScrollButton,
} from '@/components/ai-elements/conversation';
import { Message, MessageContent, MessageResponse } from '@/components/ai-elements/message';
import { cn } from '@/lib/utils';

const MotionContainer = motion.create('div');
const MotionMessage = motion.create(Message);

const CONTAINER_MOTION_PROPS = {
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
  initial: 'hidden',
  whileInView: 'visible',
};

interface ChatTranscriptProps {
  hidden?: boolean;
  messages?: ReceivedMessage[];
}

export function ChatTranscript({
  hidden = false,
  messages = [],
  className,
  ...props
}: ChatTranscriptProps & Omit<HTMLMotionProps<'div'>, 'ref'>) {
  return (
    <div className="absolute top-0 flex h-full w-full flex-col">
      <AnimatePresence>
        {!hidden && (
          <MotionContainer
            {...props}
            {...CONTAINER_MOTION_PROPS}
            className={cn('flex h-full w-full flex-col gap-4', className)}
          >
            <Conversation>
              <ConversationContent className="mx-auto w-full max-w-2xl px-4 pt-40 pb-[150px] md:px-6 md:pb-[200px]">
                {messages.map((receivedMessage) => {
                  const { id, timestamp, from, message } = receivedMessage;
                  const locale = navigator?.language ?? 'en-US';
                  const messageOrigin = from?.isLocal ? 'user' : 'assistant';
                  const time = new Date(timestamp);
                  const title = time.toLocaleTimeString(locale, { timeStyle: 'full' });

                  return (
                    <MotionMessage
                      key={id}
                      title={title}
                      from={messageOrigin}
                      {...MESSAGE_MOTION_PROPS}
                    >
                      <MessageContent className="group-[.is-user]:rounded-4xl">
                        <MessageResponse>{message}</MessageResponse>
                      </MessageContent>
                    </MotionMessage>
                  );
                })}
              </ConversationContent>
              <ConversationScrollButton className="bottom-48" />
            </Conversation>
          </MotionContainer>
        )}
      </AnimatePresence>
    </div>
  );
}
