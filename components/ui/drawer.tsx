'use client';

import { type ReactNode, useEffect, useRef } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { cn } from '@/lib/shadcn/utils';

interface DrawerProps {
  open: boolean;
  onClose: () => void;
  side?: 'left' | 'right';
  className?: string;
  /** Element to focus when the drawer opens. Defaults to the first focusable element. */
  autoFocusSelector?: string;
  children: ReactNode;
}

const FOCUSABLE_SELECTOR =
  'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

/**
 * Accessible slide-over panel with backdrop, ESC-to-close, focus lock and body
 * scroll lock. Shared by the left and right sidebars.
 */
export function Drawer({
  open,
  onClose,
  side = 'left',
  className,
  autoFocusSelector,
  children,
}: DrawerProps) {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
        return;
      }
      if (e.key !== 'Tab') return;

      const focusables = panelRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR) ?? [];
      if (focusables.length === 0) return;

      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [open, onClose]);

  useEffect(() => {
    if (!open || !panelRef.current) return;
    const target = autoFocusSelector
      ? panelRef.current.querySelector<HTMLElement>(autoFocusSelector)
      : panelRef.current.querySelector<HTMLElement>(FOCUSABLE_SELECTOR);
    target?.focus();
  }, [open, autoFocusSelector]);

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50">
          <motion.div
            key="drawer-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
            aria-hidden="true"
            className="absolute inset-0 bg-black/40"
          />
          <motion.aside
            key="drawer-panel"
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-label="Боковая панель"
            initial={{ x: side === 'left' ? '-100%' : '100%' }}
            animate={{ x: 0 }}
            exit={{ x: side === 'left' ? '-100%' : '100%' }}
            transition={{ type: 'spring', damping: 28, stiffness: 220 }}
            className={cn(
              'bg-sidebar text-sidebar-foreground absolute top-0 flex h-full flex-col shadow-2xl',
              side === 'left'
                ? 'border-sidebar-border/40 left-0 border-r'
                : 'border-sidebar-border/40 right-0 border-l',
              className
            )}
          >
            {children}
          </motion.aside>
        </div>
      )}
    </AnimatePresence>
  );
}
