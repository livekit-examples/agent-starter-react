import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Room, RoomEvent, TokenSource } from 'livekit-client';
import { AppConfig } from '@/app-config';
import { toastAlert } from '@/components/livekit/alert-toast';
import { useBrowserSourceClient } from '@/hooks/useBrowserSourceClient';
import { getBrowserRoomSessionId } from '@/lib/browser-room-session';
import { readConnectionDetailsResponse } from '@/lib/connection-details-response';

export function useRoom(appConfig: AppConfig) {
  const aborted = useRef(false);
  const room = useMemo(
    () =>
      new Room({
        reconnectPolicy: { nextRetryDelayInMs: () => null },
      }),
    []
  );
  const [isSessionActive, setIsSessionActive] = useState(false);
  const handleBrowserVideoError = useCallback((error: Error) => {
    toastAlert({
      title: 'Camera could not start',
      description: `${error.name}: ${error.message}`,
    });
  }, []);
  const browserSourceClient = useBrowserSourceClient(room, appConfig, {
    onVideoError: handleBrowserVideoError,
  });

  useEffect(() => {
    function onDisconnected() {
      setIsSessionActive(false);
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
    return () => {
      aborted.current = true;
      room.disconnect();
    };
  }, [room]);

  const tokenSource = useMemo(
    () =>
      TokenSource.custom(async () => {
        const url = new URL(
          process.env.NEXT_PUBLIC_CONN_DETAILS_ENDPOINT ?? '/api/connection-details',
          window.location.origin
        );

        try {
          const roomId = appConfig.usesBrowserRawMediaInput ? getBrowserRoomSessionId() : undefined;

          const res = await fetch(url.toString(), {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-Sandbox-Id': appConfig.sandboxId ?? '',
            },
            body: JSON.stringify({
              room_id: roomId,
              room_config: appConfig.agentName
                ? {
                    agents: [{ agent_name: appConfig.agentName }],
                  }
                : undefined,
            }),
          });
          return await readConnectionDetailsResponse(res);
        } catch (error) {
          console.error('Error fetching connection details:', error);
          if (error instanceof Error) {
            throw error;
          }
          throw new Error('Error fetching connection details!');
        }
      }),
    [appConfig]
  );

  const startSession = useCallback(() => {
    if (browserSourceClient.enabled && !isBrowserMediaAvailable()) {
      toastAlert({
        title: 'Camera and microphone require a secure page',
        description:
          'Open this page with HTTPS, localhost, or launch Chrome/Edge with --unsafely-treat-insecure-origin-as-secure for this IP address.',
      });
      return;
    }

    const recoverFromStartError = (error: Error) => {
      browserSourceClient.stop();
      room.disconnect();
      setIsSessionActive(false);
      toastAlert({
        title: 'There was an error connecting to the agent',
        description: `${error.name}: ${error.message}`,
      });
    };

    const handleStartError = (error: Error) => {
      if (aborted.current) {
        // Once the effect has cleaned up after itself, drop any errors
        //
        // These errors are likely caused by this effect rerunning rapidly,
        // resulting in a previous run `disconnect` running in parallel with
        // a current run `connect`
        return;
      }

      recoverFromStartError(error);
    };

    setIsSessionActive(true);

    const startDefaultMicrophone = async () => {
      await room.localParticipant.setMicrophoneEnabled(true, undefined, {
        preConnectBuffer: appConfig.isPreConnectBufferEnabled,
      });
    };

    const startLocalInput = async () => {
      if (browserSourceClient.enabled) {
        await browserSourceClient.start();
        return;
      }

      if (appConfig.usesServerRoomInput) {
        await room.localParticipant.setMicrophoneEnabled(false);
        return;
      }

      await startDefaultMicrophone();
    };

    if (room.state === 'disconnected') {
      if (browserSourceClient.enabled || appConfig.usesServerRoomInput) {
        tokenSource
          .fetch({ agentName: appConfig.agentName })
          .then((connectionDetails) =>
            room.connect(connectionDetails.serverUrl, connectionDetails.participantToken)
          )
          .then(() => startLocalInput())
          .catch(handleStartError);
        return;
      }

      Promise.all([
        startDefaultMicrophone(),
        tokenSource
          .fetch({ agentName: appConfig.agentName })
          .then((connectionDetails) =>
            room.connect(connectionDetails.serverUrl, connectionDetails.participantToken)
          ),
      ]).catch(handleStartError);
    } else {
      startLocalInput().catch((error) => {
        recoverFromStartError(error);
      });
    }
  }, [room, appConfig, tokenSource, browserSourceClient]);

  const endSession = useCallback(() => {
    browserSourceClient.stop();
    room.disconnect();
    setIsSessionActive(false);
  }, [browserSourceClient, room]);

  return { room, isSessionActive, startSession, endSession, browserSourceClient };
}

function isBrowserMediaAvailable() {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') {
    return false;
  }

  return Boolean(
    window.isSecureContext &&
      navigator.mediaDevices &&
      typeof navigator.mediaDevices.getUserMedia === 'function'
  );
}
