import { type VariantProps, cva } from 'class-variance-authority';
import { type HTMLMotionProps, motion } from 'motion/react';
import { cn } from '@/lib/utils';

const motionAnimationProps = {
  variants: {
    hidden: {
      opacity: 0,
      scale: 0.1,
      transition: {
        duration: 0.1,
        ease: 'linear' as const,
      },
    },
    visible: {
      opacity: [0.5, 1],
      scale: [1, 1.2],
      transition: {
        type: 'spring' as const,
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

/** Props for the AgentChatIndicator component. */
export interface AgentChatIndicatorProps {
  /**
   * The size of the indicator dot.
   *
   * @defaultValue 'md'
   */
  size?: 'sm' | 'md' | 'lg';
  /** Additional CSS class names to apply to the indicator. */
  className?: string;
}

/**
 * An animated indicator that shows the agent is processing or thinking. Displays as a pulsing dot,
 * typically used in chat interfaces.
 *
 * @example
 *
 * ```tsx
 * {agentState === 'thinking' && <AgentChatIndicator size="md" />}
 * ```
 *
 * @extends ComponentProps<'span'>
 */
export function AgentChatIndicator({
  size = 'md',
  className,
  ...props
}: AgentChatIndicatorProps &
  HTMLMotionProps<'span'> &
  VariantProps<typeof agentChatIndicatorVariants>) {
  return (
    <motion.span
      {...motionAnimationProps}
      transition={{ duration: 0.1, ease: 'linear' as const }}
      className={cn(agentChatIndicatorVariants({ size }), className)}
      {...props}
    />
  );
}
