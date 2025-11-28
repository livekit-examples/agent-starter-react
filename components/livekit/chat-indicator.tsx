import { AnimatePresence, motion } from 'motion/react';
import { type AgentState } from '@livekit/components-react';
import { cn } from '@/lib/utils';

const motionAnimationProps = {
  variants: {
    hidden: {
      opacity: 0,
      scale: 0.1,
      transition: {
        duration: 0.1,
        ease: 'linear',
      },
    },
    visible: {
      opacity: [0.5, 1],
      scale: [1, 1.2],
      transition: {
        type: 'spring',
        bounce: 0,
        duration: 0.5,
        repeat: Infinity,
        repeatType: 'mirror' as const,
      },
    },
  },
  initial: 'hidden',
  animate: 'visible',
  exit: 'hidden',
};

export interface ChatIndicatorProps {
  agentState?: AgentState;
  className?: string;
}

export function ChatIndicator({ agentState, className }: ChatIndicatorProps) {
  return (
    <AnimatePresence>
      {agentState === 'thinking' && (
        <motion.span
          {...motionAnimationProps}
          transition={{ duration: 0.1, ease: 'linear' }}
          className={cn('bg-muted-foreground inline-block size-2.5 rounded-full', className)}
        />
      )}
    </AnimatePresence>
  );
}
