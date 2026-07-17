'use client';

import { type ReactNode, useCallback, useMemo } from 'react';
import { SessionProvider } from '@livekit/components-react';
import { useSpatiusAvatar } from '@/hooks/useSpatiusAvatar';
import type { SpatiusAvatarContextValue, UseSpatiusAvatarOptions } from '@/lib/spatius/types';
import { SpatiusAvatarContext } from './spatius-avatar-context';

export interface SpatiusAvatarProviderProps extends UseSpatiusAvatarOptions {
  children: ReactNode;
  /** Called after the avatar is torn down (e.g. the control bar's leave button). */
  onDisconnect?: () => void;
}

/**
 * Connects a Spatius avatar (via {@link useSpatiusAvatar}) and provides a
 * `@livekit/components-react` session bound to the SDK-owned room, so the rest of
 * the agent UI works on the same room.
 *
 * Note: no `RoomAudioRenderer` here — the AvatarKit SDK plays the avatar's audio
 * itself (a second sink would double the audio), matching the Spatius reference.
 */
export function SpatiusAvatarProvider({
  children,
  onDisconnect,
  ...options
}: SpatiusAvatarProviderProps) {
  const avatar = useSpatiusAvatar(options);

  const end = useCallback(async () => {
    try {
      await avatar.disconnect();
    } finally {
      onDisconnect?.();
    }
  }, [avatar, onDisconnect]);

  const session = useMemo(() => ({ ...avatar.session, end }), [avatar.session, end]);

  const value = useMemo<SpatiusAvatarContextValue>(
    () => ({ renderMode: 'canvas', ...avatar, session }),
    [avatar, session]
  );

  return (
    <SpatiusAvatarContext.Provider value={value}>
      <SessionProvider session={session}>{children}</SessionProvider>
    </SpatiusAvatarContext.Provider>
  );
}
