import { useEffect, useMemo, useState } from 'react';
import { Room, RoomEvent, TokenSource } from 'livekit-client';
import { AppConfig } from '@/app-config';
import { toastAlert } from '@/components/livekit/alert-toast';

export function useRoom(appConfig: AppConfig) {
  const room = useMemo(() => new Room(), []);
  const [isSessionActive, setIsSessionStarted] = useState(false);

  useEffect(() => {
    function onDisconnected() {
      setIsSessionStarted(false);
    }

    function onMediaDevicesError(error: Error) {
      toastAlert({
        title: 'Encountered an error with your media devices',
        description: `${error.name}: ${error.message}`,
      });
    }

    room.on(RoomEvent.Disconnected, onDisconnected);
    room.on(RoomEvent.MediaDevicesError, onMediaDevicesError);

    return () => {
      room.off(RoomEvent.Disconnected, onDisconnected);
      room.off(RoomEvent.MediaDevicesError, onMediaDevicesError);
    };
  }, [room]);

  useEffect(() => {
    let aborted = false;

    const tokenSource = TokenSource.custom(async () => {
      const url = new URL(
        process.env.NEXT_PUBLIC_CONN_DETAILS_ENDPOINT ?? '/api/connection-details',
        window.location.origin
      );

      try {
        const res = await fetch(url.toString(), {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Sandbox-Id': appConfig.sandboxId ?? '',
          },
          body: JSON.stringify({
            room_config: appConfig.agentName
              ? {
                  agents: [{ agent_name: appConfig.agentName }],
                }
              : undefined,
          }),
        });
        return await res.json();
      } catch (error) {
        console.error('Error fetching connection details:', error);
        throw new Error('Error fetching connection details!');
      }
    });

    if (isSessionActive && room.state === 'disconnected') {
      const { isPreConnectBufferEnabled } = appConfig;
      Promise.all([
        room.localParticipant.setMicrophoneEnabled(true, undefined, {
          preConnectBuffer: isPreConnectBufferEnabled,
        }),
        tokenSource
          .fetch({ agentName: appConfig.agentName })
          .then((connectionDetails) =>
            room.connect(connectionDetails.serverUrl, connectionDetails.participantToken)
          ),
      ]).catch((error) => {
        if (aborted) {
          // Once the effect has cleaned up after itself, drop any errors
          //
          // These errors are likely caused by this effect rerunning rapidly,
          // resulting in a previous run `disconnect` running in parallel with
          // a current run `connect`
          return;
        }

        toastAlert({
          title: 'There was an error connecting to the agent',
          description: `${error.name}: ${error.message}`,
        });
      });
    }

    return () => {
      aborted = true;
      room.disconnect();
    };
  }, [room, isSessionActive, appConfig]);

  const startSession = () => {
    setIsSessionStarted(true);
  };

  return { room, isSessionActive, startSession };
}
