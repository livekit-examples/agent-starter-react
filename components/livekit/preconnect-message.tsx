import { AnimatePresence, motion } from 'motion/react';
import { ShimmerMessage } from '@/components/livekit/shimmer-message';
import { useChatTranscriptions } from '@/hooks/useChatAndTranscription';
import { cn } from '@/lib/utils';

interface PreConnectMessageProps {
  className?: string;
}

export function PreConnectMessage({ className }: PreConnectMessageProps) {
  const messages = useChatTranscriptions();

  return (
    <AnimatePresence>
      {messages.length === 0 && (
        <motion.p
          initial={{ opacity: 0 }}
          animate={{
            opacity: 1,
            transition: {
              ease: 'easeIn',
              duration: 0.5,
              delay: 0.8,
            },
          }}
          exit={{
            opacity: 0,
            transition: {
              ease: 'easeIn',
              duration: 0.5,
              delay: 0,
            },
          }}
          aria-hidden={messages.length > 0}
          className={cn('pointer-events-none text-center', className)}
        >
          <ShimmerMessage>Agent is listening, ask it a question</ShimmerMessage>
        </motion.p>
      )}
    </AnimatePresence>
  );
}
