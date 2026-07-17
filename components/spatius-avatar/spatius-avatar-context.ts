'use client';

import { createContext, useContext } from 'react';
import type { SpatiusAvatarContextValue } from '@/lib/spatius/types';

export const SpatiusAvatarContext = createContext<SpatiusAvatarContextValue | null>(null);

/** Returns the Spatius avatar context, or `null` when not inside a Spatius provider. */
export function useMaybeSpatiusAvatarContext(): SpatiusAvatarContextValue | null {
  return useContext(SpatiusAvatarContext);
}

/** Returns the Spatius avatar context, throwing when used outside a provider. */
export function useSpatiusAvatarContext(): SpatiusAvatarContextValue {
  const context = useContext(SpatiusAvatarContext);
  if (!context) {
    throw new Error('useSpatiusAvatarContext must be used within a Spatius avatar provider.');
  }
  return context;
}
