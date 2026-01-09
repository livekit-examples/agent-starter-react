import {
  RoomAudioRenderer,
  type RoomAudioRendererProps,
  SessionProvider,
  type SessionProviderProps,
} from '@livekit/components-react';

export type AgentSessionProviderProps = SessionProviderProps & RoomAudioRendererProps;

export function AgentSessionProvider({
  session,
  children,
  ...roomAudioRendererProps
}: AgentSessionProviderProps) {
  return (
    <SessionProvider session={session}>
      {children}
      <RoomAudioRenderer {...roomAudioRendererProps} />
    </SessionProvider>
  );
}
