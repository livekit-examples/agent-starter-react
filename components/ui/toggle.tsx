'use client';

import * as React from 'react';
import { type VariantProps, cva } from 'class-variance-authority';
import * as TogglePrimitive from '@radix-ui/react-toggle';
import { cn } from '@/lib/utils';

const toggleVariants = cva(
  [
    'inline-flex items-center justify-center gap-2 rounded-full',
    'text-sm font-medium whitespace-nowrap',
    'cursor-pointer outline-none transition-[color,border,background-color]',
    'focus-visible:ring-ring/50 focus-visible:ring-[3px] focus-visible:border-ring',
    'aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive',
    'disabled:pointer-events-none disabled:opacity-50 disabled:not-allowed',
    'data-[state=on]:bg-button-selected data-[state=on]:border-button-border-selected',
    "[&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 [&_svg]:shrink-0",
  ],
  {
    variants: {
      variant: {
        default:
          'bg-button hover:bg-muted focus:bg-muted hover:text-muted-foreground focus:text-muted-foreground',
        primary:
          'text-fg1 bg-button hover:bg-button-hover focus:bg-button-hover data-[state=off]:bg-button-primary hover:data-[state=off]:bg-button-hover data-[state=off]:text-button-primary-foreground',
        secondary:
          'text-fg1 bg-button hover:bg-button-hover focus:bg-button-hover data-[state=on]:bg-button-secondary hover:data-[state=on]:bg-button-secondary data-[state=on]:text-button-secondary-foreground',
        outline: [
          'border border-button-border bg-button text-button-foreground',
          'hover:bg-background focus:bg-background',
        ],
      },
      size: {
        default: 'h-9 px-2 min-w-9',
        sm: 'h-8 px-1.5 min-w-8',
        lg: 'h-10 px-2.5 min-w-10',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  }
);

function Toggle({
  className,
  variant,
  size,
  ...props
}: React.ComponentProps<typeof TogglePrimitive.Root> & VariantProps<typeof toggleVariants>) {
  return (
    <TogglePrimitive.Root
      data-slot="toggle"
      className={cn(toggleVariants({ variant, size, className }))}
      {...props}
    />
  );
}

export { Toggle, toggleVariants };
