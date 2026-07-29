import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Room, RoomEvent, TokenSource } from 'livekit-client';
import { AppConfig } from '@/app-config';
import { toastAlert } from '@/components/livekit/alert-toast';
import { useBrowserSourceClient } from '@/hooks/useBrowserSourceClient';
import { getVoiceSessionId, resetVoiceSessionId } from '@/lib/browser-room-session';
import { readConnectionDetailsResponse } from '@/lib/connection-details-response';
import { isValidConnectionRoomId } from '@/lib/connection-room-id';
import { usesServerRoomInputDevice } from '@/lib/input-device-config';
import {
  FRONTEND_EVENTS,
  beginFrontendObservabilitySession,
  endFrontendObservabilitySession,
  flushFrontendObservabilityEvents,
  recordFrontendObservabilityEvent,
} from '@/lib/observability';
import { waitForRoomDisconnected } from '@/lib/room-disconnect';
import {
  AgentSessionDispatchCancelledError,
  requestAgentSessionDispatch,
} from '@/lib/session-dispatch-client';
import {
  beginAgentSessionStart,
  cancelAgentSessionStart,
  registerAgentSessionDispatch,
  requestAgentSessionStop,
  waitForAgentSessionStop,
} from '@/lib/session-stop-client';

function requiresRoomVideoInputReady(appConfig: AppConfig) {
  return appConfig.visionInputDevice
    ? usesServerRoomInputDevice(appConfig.visionInputDevice)
    : false;
}

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
  const resolveVoiceSessionId = useCallback(() => {
    const configuredSessionId = appConfig.voiceSessionId?.trim();
    if (isValidConnectionRoomId(configuredSessionId)) {
      return configuredSessionId;
    }
    return getVoiceSessionId();
  }, [appConfig.voiceSessionId]);
  const recordFrontendObservability = useCallback(
    (name: string, attributes?: Record<string, string | number | boolean | null>) => {
      void recordFrontendObservabilityEvent({
        enabled: !!appConfig.observabilityEnabled,
        room,
        name,
        attributes,
      }).catch((error) => {
        console.warn('[frontend-observability] failed to publish event', error);
      });
    },
    [appConfig.observabilityEnabled, room]
  );

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
      endFrontendObservabilitySession(room);
      room.disconnect();
    };
  }, [room]);

  const tokenSource = useMemo(
    () =>
      TokenSource.custom(async () => {
        const url = new URL(
          process.env.NEXT_PUBLIC_CONN_DETAILS_ENDPOINT ?? 'api/connection-details',
          window.location.href
        );

        try {
          recordFrontendObservability(FRONTEND_EVENTS.CONNECTION_DETAILS_STARTED);
          const sessionId = sessionIdRef.current ?? resolveVoiceSessionId();
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
          const connectionDetails = await readConnectionDetailsResponse(res, { sessionId });
          recordFrontendObservability(FRONTEND_EVENTS.CONNECTION_DETAILS_FINISHED);
          return connectionDetails;
        } catch (error) {
          console.error('Error fetching connection details:', error);
          if (error instanceof Error) {
            throw error;
          }
          throw new Error('Error fetching connection details!');
        }
      }),
    [appConfig, recordFrontendObservability, resolveVoiceSessionId]
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

    const sessionId = resolveVoiceSessionId();
    sessionIdRef.current = sessionId;
    let dispatchSessionId: string | null = sessionId;
    let connectedRoomName: string | null = null;

    const recoverFromStartError = async (error: unknown) => {
      const startError = error instanceof Error ? error : new Error(String(error));
      if (connectedRoomName) {
        try {
          await flushFrontendObservabilityEvents({
            enabled: !!appConfig.observabilityEnabled,
            room,
          });
        } catch (observabilityError) {
          console.warn(
            '[frontend-observability] failed to flush startup failure events',
            observabilityError
          );
        }
      }
      try {
        await browserSourceClient.stop();
      } catch (stopError) {
        console.warn('Failed to stop browser source after start failure', stopError);
      } finally {
        room.disconnect();
      }
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
      endFrontendObservabilitySession(room);
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
    beginFrontendObservabilitySession(room);

    const dispatchAgentSession = async () => {
      recordFrontendObservability(FRONTEND_EVENTS.DISPATCH_STARTED);
      dispatchSessionId = sessionId;
      const signal = beginAgentSessionStart(room.name, sessionId);
      const dispatchPromise = requestAgentSessionDispatch(appConfig.agentName, sessionId, {
        requireRoomVideoInputReady: requiresRoomVideoInputReady(appConfig),
        signal,
      });
      registerAgentSessionDispatch(room.name, sessionId, dispatchPromise);
      await dispatchPromise;
      recordFrontendObservability(FRONTEND_EVENTS.DISPATCH_FINISHED);
      await flushFrontendObservabilityEvents({
        enabled: !!appConfig.observabilityEnabled,
        room,
      });
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

    const startLocalInputOrCancelDispatch = async () => {
      try {
        await startLocalInput();
      } catch (error) {
        cancelAgentSessionStart(sessionId);
        throw error;
      }
    };
    const usesManagedRoomInput = browserSourceClient.enabled || appConfig.usesServerRoomInput;
    const usesSandboxConcurrentStartup = Boolean(appConfig.sandboxId) && usesManagedRoomInput;

    try {
      await waitForAgentSessionStop();
      await waitForRoomDisconnected(room);

      if (usesManagedRoomInput) {
        const connectionDetails = await tokenSource.fetch({ agentName: appConfig.agentName });
        recordFrontendObservability(FRONTEND_EVENTS.ROOM_CONNECT_STARTED);
        await room.connect(connectionDetails.serverUrl, connectionDetails.participantToken);
        recordFrontendObservability(FRONTEND_EVENTS.ROOM_CONNECT_FINISHED);
        recordFrontendObservability(FRONTEND_EVENTS.ROOM_CONNECTED);
        connectedRoomName = room.name;
        if (usesSandboxConcurrentStartup) {
          const [localInputResult, dispatchResult] = await Promise.allSettled([
            startLocalInputOrCancelDispatch(),
            dispatchAgentSession(),
          ]);
          if (localInputResult.status === 'rejected') {
            if (dispatchResult.status === 'rejected') {
              console.warn(
                'Agent dispatch also failed while local input was starting',
                dispatchResult.reason
              );
            }
            throw localInputResult.reason;
          }
          if (dispatchResult.status === 'rejected') {
            throw dispatchResult.reason;
          }
        } else {
          await startLocalInput();
        }
      } else {
        await Promise.all([
          startDefaultMicrophone(),
          tokenSource.fetch({ agentName: appConfig.agentName }).then(async (connectionDetails) => {
            recordFrontendObservability(FRONTEND_EVENTS.ROOM_CONNECT_STARTED);
            await room.connect(connectionDetails.serverUrl, connectionDetails.participantToken);
            recordFrontendObservability(FRONTEND_EVENTS.ROOM_CONNECT_FINISHED);
            recordFrontendObservability(FRONTEND_EVENTS.ROOM_CONNECTED);
            connectedRoomName = room.name;
          }),
        ]);
      }

      if (!usesSandboxConcurrentStartup) {
        await dispatchAgentSession();
      }
    } catch (error) {
      await handleStartError(error);
    }
  }, [
    room,
    appConfig,
    tokenSource,
    browserSourceClient,
    resolveVoiceSessionId,
    recordFrontendObservability,
  ]);

  const endSession = useCallback(async () => {
    try {
      await browserSourceClient.stop();
    } catch (error) {
      console.warn('Failed to stop browser source while ending session', error);
    } finally {
      room.disconnect();
      resetVoiceSessionId();
      endFrontendObservabilitySession(room);
      sessionIdRef.current = null;
      setIsSessionActive(false);
    }
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
