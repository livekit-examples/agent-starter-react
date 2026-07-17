'use client';

import { WarningIcon } from '@phosphor-icons/react/dist/ssr';
import { Toaster } from '@/components/ui/sonner';
import { useAgentErrors } from '@/hooks/useAgentErrors';
import { useDebugMode } from '@/hooks/useDebug';

const IN_DEVELOPMENT = process.env.NODE_ENV !== 'production';

/** Shared session-scoped side effects (debug mode + agent error toasts). */
export function AppSetup() {
  useDebugMode({ enabled: IN_DEVELOPMENT });
  useAgentErrors();
  return null;
}

/** Shared toast host, styled to match the app theme. */
export function AppToaster() {
  return (
    <Toaster
      icons={{
        warning: <WarningIcon weight="bold" />,
      }}
      position="top-center"
      className="toaster group"
      style={
        {
          '--normal-bg': 'var(--popover)',
          '--normal-text': 'var(--popover-foreground)',
          '--normal-border': 'var(--border)',
        } as React.CSSProperties
      }
    />
  );
}
