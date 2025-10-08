import { useRef } from 'react';
import { motion } from 'motion/react';
import { type ReceivedChatMessage } from '@livekit/components-react';
import { ChatEntry } from '@/components/livekit/chat-entry';
import { Skrim } from '@/components/livekit/skrim';
import { useAutoScroll } from '@/hooks/useAutoScroll';
import { cn } from '@/lib/utils';

const MotionChatEntry = motion.create(ChatEntry);

interface TranscriptProps {
  messages: ReceivedChatMessage[];
}

export function Transcript({
  className,
  messages,
  ...props
}: TranscriptProps & React.HTMLAttributes<HTMLDivElement>) {
  const scrollContentRef = useRef<HTMLDivElement>(null);

  useAutoScroll(scrollContentRef.current);

  return (
    <div className={cn('fixed inset-0', 'grid grid-cols-1 grid-rows-1', className)} {...props}>
      <div ref={scrollContentRef} className="overflow-y-scroll">
        <div className="mx-auto max-w-2xl space-y-3 px-4 pt-40 pb-[150px] md:px-6 md:pb-[180px]">
          {messages.map((message: ReceivedChatMessage) => (
            <MotionChatEntry
              hideName
              key={message.id}
              entry={message}
              initial={{
                opacity: 0,
                height: 0,
                transformOrigin: 'top',
              }}
              animate={{
                opacity: 1,
                height: 'auto',
              }}
              transition={{ duration: 0.5, ease: 'easeOut' }}
            />
          ))}
        </div>
      </div>

      <Skrim top className="absolute inset-x-4 top-0 h-40" />
    </div>
  );
}
