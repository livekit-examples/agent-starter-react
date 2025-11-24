import { useEffect } from 'react';
import { useLocalParticipant } from '@livekit/components-react';
import { useConnection } from '@/hooks/useConnection';

export function useMicrophone() {
  const { connect } = useConnection();
  const { localParticipant } = useLocalParticipant();

  useEffect(() => {
    connect();
    localParticipant.setMicrophoneEnabled(true, undefined);
  }, [connect, localParticipant]);
}
