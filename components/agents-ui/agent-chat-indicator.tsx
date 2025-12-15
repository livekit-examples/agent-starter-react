import { motion } from 'motion/react';
import { cva, VariantProps } from 'class-variance-authority';
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

const agentChatIndicatorVariants = cva('bg-muted-foreground inline-block size-2.5 rounded-full', {
  variants: {
    size: {
      sm: 'size-2.5',
      md: 'size-4',
      lg: 'size-6',
    },
  },
  defaultVariants: {
    size: 'md',
  },
});

export interface AgentChatIndicatorProps extends VariantProps<typeof agentChatIndicatorVariants> {
  className?: string;
}

export function AgentChatIndicator({ size, className }: AgentChatIndicatorProps) {
  return (
    <motion.span
      {...motionAnimationProps}
      transition={{ duration: 0.1, ease: 'linear' }}
      className={cn(agentChatIndicatorVariants({ size }), className)}
    />
  );
}
