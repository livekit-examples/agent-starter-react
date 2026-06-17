import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Room, RoomEvent, TokenSource } from 'livekit-client';
import { AppConfig } from '@/app-config';
import { toastAlert } from '@/components/livekit/alert-toast';
import { useBrowserSourceClient } from '@/hooks/useBrowserSourceClient';
import { getVoiceSessionId, resetVoiceSessionId } from '@/lib/browser-room-session';
import { readConnectionDetailsResponse } from '@/lib/connection-details-response';
import { waitForRoomDisconnected } from '@/lib/room-disconnect';
import {
  AgentSessionDispatchCancelledError,
  requestAgentSessionDispatch,
} from '@/lib/session-dispatch-client';
import {
  beginAgentSessionStart,
  registerAgentSessionDispatch,
  requestAgentSessionStop,
  waitForAgentSessionStop,
} from '@/lib/session-stop-client';

export function useRoom(appConfig: AppConfig) {
  const aborted = useRef(false);
  const sessionIdRef = useRef<string | null>(null);
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
      void requestAgentSessionStop(sessionIdRef.current, {
        waitForRemote: false,
      });
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
          const sessionId = sessionIdRef.current ?? getVoiceSessionId();
          sessionIdRef.current = sessionId;

          const res = await fetch(url.toString(), {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-Sandbox-Id': appConfig.sandboxId ?? '',
            },
            body: JSON.stringify({
              sessionId,
            }),
          });
          return await readConnectionDetailsResponse(res, { sessionId });
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

  const startSession = useCallback(async () => {
    if (browserSourceClient.enabled && !isBrowserMediaAvailable()) {
      toastAlert({
        title: 'Camera and microphone require a secure page',
        description:
          'Open this page with HTTPS, localhost, or launch Chrome/Edge with --unsafely-treat-insecure-origin-as-secure for this IP address.',
      });
      return;
    }

    const sessionId = getVoiceSessionId();
    sessionIdRef.current = sessionId;
    let dispatchSessionId: string | null = sessionId;
    let connectedRoomName: string | null = null;

    const recoverFromStartError = async (error: unknown) => {
      const startError = error instanceof Error ? error : new Error(String(error));
      browserSourceClient.stop();
      room.disconnect();
      if (connectedRoomName) {
        try {
          await requestAgentSessionStop(dispatchSessionId ?? sessionIdRef.current ?? undefined, {
            waitForRemote: true,
          });
        } catch (stopError) {
          console.warn('Failed to stop remote agent session after start failure', stopError);
        }
      }
      resetVoiceSessionId();
      sessionIdRef.current = null;
      setIsSessionActive(false);
      toastAlert({
        title: 'There was an error connecting to the agent',
        description: `${startError.name}: ${startError.message}`,
      });
    };

    const handleStartError = async (error: unknown) => {
      if (aborted.current || isExpectedStartCancellation(error)) {
        // Once the effect has cleaned up after itself, drop any errors
        //
        // These errors are likely caused by this effect rerunning rapidly,
        // resulting in a previous run `disconnect` running in parallel with
        // a current run `connect`
        return;
      }

      await recoverFromStartError(error);
    };

    setIsSessionActive(true);

    const dispatchAgentSession = async () => {
      dispatchSessionId = sessionId;
      const signal = beginAgentSessionStart(room.name, sessionId);
      const dispatchPromise = requestAgentSessionDispatch(appConfig.agentName, sessionId, {
        signal,
      });
      registerAgentSessionDispatch(room.name, sessionId, dispatchPromise);
      await dispatchPromise;
    };

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

    try {
      await waitForAgentSessionStop();
      await waitForRoomDisconnected(room);

      if (browserSourceClient.enabled || appConfig.usesServerRoomInput) {
        const connectionDetails = await tokenSource.fetch({ agentName: appConfig.agentName });
        await room.connect(connectionDetails.serverUrl, connectionDetails.participantToken);
        connectedRoomName = room.name;
        await startLocalInput();
      } else {
        await Promise.all([
          startDefaultMicrophone(),
          tokenSource.fetch({ agentName: appConfig.agentName }).then(async (connectionDetails) => {
            await room.connect(connectionDetails.serverUrl, connectionDetails.participantToken);
            connectedRoomName = room.name;
          }),
        ]);
      }

      await dispatchAgentSession();
    } catch (error) {
      await handleStartError(error);
    }
  }, [room, appConfig, tokenSource, browserSourceClient]);

  const endSession = useCallback(() => {
    browserSourceClient.stop();
    room.disconnect();
    resetVoiceSessionId();
    sessionIdRef.current = null;
    setIsSessionActive(false);
  }, [browserSourceClient, room]);
  const getCurrentSessionId = useCallback(() => sessionIdRef.current, []);

  return {
    room,
    isSessionActive,
    startSession,
    endSession,
    getCurrentSessionId,
    browserSourceClient,
  };
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

function isExpectedStartCancellation(error: unknown) {
  if (!error || typeof error !== 'object') {
    return false;
  }

  const name = 'name' in error ? String(error.name) : '';
  return name === 'AbortError' || error instanceof AgentSessionDispatchCancelledError;
}
