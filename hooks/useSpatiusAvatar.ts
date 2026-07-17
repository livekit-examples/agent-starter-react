import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { TokenSource } from 'livekit-client';
import type { Room } from 'livekit-client';
import { useSession } from '@livekit/components-react';
import { AvatarManager, AvatarSDK, AvatarView, LoadProgress } from '@spatius/avatarkit';
import { AvatarPlayer, LiveKitProvider } from '@spatius/avatarkit-rtc';
import type {
  SpatiusAvatarConnectionStatus,
  SpatiusAvatarState,
  UseSpatiusAvatarOptions,
  UseSpatiusAvatarResult,
} from '@/lib/spatius/types';

function toError(error: unknown, fallbackMessage: string) {
  return error instanceof Error ? error : new Error(fallbackMessage);
}

function createIdleState(): SpatiusAvatarState {
  return {
    downloadProgress: null,
    error: null,
    isConnected: false,
    isLoading: false,
    room: null,
    status: 'idle',
  };
}

/**
 * Drives a Spatius AvatarKit avatar over a LiveKit connection.
 *
 * The Spatius `AvatarPlayer` owns the LiveKit `Room` — it attaches an
 * `RTCRtpScriptTransform` to the avatar's motion (fake-VP8) video receiver to
 * decode lip-sync/animation frames. That transform is fragile: if the player is
 * disconnected and reconnected, or re-initialized, the motion stream stops
 * (only the local idle animation keeps rendering). So this hook connects
 * **exactly once** (guarded by `initedRef`) using a **ref-based** container, and
 * only tears down on real unmount — never on transient re-renders of the tile.
 *
 * Once connected, the SDK-owned `Room` is handed to `useSession({ room })` so the
 * rest of the `@livekit/components-react` UI (transcript, control bar, agent
 * state) operates on the same room.
 */
export function useSpatiusAvatar(options: UseSpatiusAvatarOptions): UseSpatiusAvatarResult {
  const {
    appId,
    avatarId,
    connection,
    enabled = true,
    region,
    sdkLogLevel,
    sessionToken,
    userId,
  } = options;
  const { roomName, token, url } = connection;

  const containerRef = useRef<HTMLDivElement | null>(null);
  const playerRef = useRef<AvatarPlayer | null>(null);
  const viewRef = useRef<AvatarView | null>(null);
  const initedRef = useRef(false);
  const disposedRef = useRef(false);

  const [containerReady, setContainerReady] = useState(false);
  const [state, setState] = useState<SpatiusAvatarState>(createIdleState);

  // Latest callbacks/options without re-triggering the connect effect.
  const optsRef = useRef(options);
  useEffect(() => {
    optsRef.current = options;
  });

  const tokenSource = useMemo(
    () => TokenSource.literal({ participantToken: token, serverUrl: url }),
    [token, url]
  );

  // Adopt the AvatarPlayer-owned room once it is connected. Proven safe — it does
  // not disturb the motion transform.
  const baseSession = useSession(tokenSource, { room: state.room ?? undefined });

  const updateStatus = useCallback((status: SpatiusAvatarConnectionStatus) => {
    setState((previous) => ({
      ...previous,
      isConnected: status === 'connected',
      isLoading: status === 'initializing' || status === 'connecting',
      status,
    }));
    optsRef.current.onStateChange?.(status);
  }, []);

  // Container ref-callback: store the node (ref, not state) and observe its size.
  const setContainerRef = useCallback((node: HTMLDivElement | null) => {
    containerRef.current = node;
    if (!node) {
      setContainerReady(false);
      return;
    }
    const check = () => setContainerReady(node.offsetWidth > 0 && node.offsetHeight > 0);
    requestAnimationFrame(check);
  }, []);

  const disconnect = useCallback(async () => {
    const player = playerRef.current;
    const view = viewRef.current;
    playerRef.current = null;
    viewRef.current = null;
    initedRef.current = false;
    try {
      await player?.disconnect();
    } catch {
      // ignore teardown errors
    }
    try {
      view?.dispose();
    } catch {
      // ignore teardown errors
    }
    if (!disposedRef.current) {
      setState(createIdleState());
    }
  }, []);

  const reconnect = useCallback(async () => {
    const player = playerRef.current;
    if (!player) throw new Error('Avatar player is not ready yet.');
    updateStatus('connecting');
    try {
      await player.reconnect();
      const room = (player.getNativeClient() as Room | null) ?? null;
      setState((previous) => ({ ...previous, room }));
      updateStatus('connected');
    } catch (error) {
      const normalizedError = toError(error, 'Failed to reconnect avatar motion stream.');
      setState((previous) => ({ ...previous, error: normalizedError, status: 'error' }));
      optsRef.current.onAvatarError?.(normalizedError);
      throw normalizedError;
    }
  }, [updateStatus]);

  // Surface `disconnect` as the session's `end`, and reflect the avatar's real
  // connection state as `isConnected` — `useSession` adopts an already-connected
  // room so it never observes the connect transition on its own, which would
  // otherwise leave the control bar's leave button disabled.
  const session = useMemo(
    () =>
      ({
        ...baseSession,
        end: disconnect,
        isConnected: state.isConnected || baseSession.isConnected,
      }) as typeof baseSession,
    [baseSession, disconnect, state.isConnected]
  );

  // Connect exactly once, when the container has a size. Deliberately depends only
  // on `containerReady`/`enabled` so tile re-renders never re-run it.
  useEffect(() => {
    if (!enabled || !containerReady || initedRef.current || !containerRef.current) {
      return;
    }
    initedRef.current = true;
    disposedRef.current = false;
    const container = containerRef.current;

    const connect = async () => {
      updateStatus('initializing');
      setState((previous) => ({ ...previous, downloadProgress: null, error: null }));
      try {
        if (!AvatarSDK.configuration) {
          await AvatarSDK.initialize(appId, { region: region ?? 'us-west', logLevel: sdkLogLevel });
        }
        if (sessionToken) AvatarSDK.setSessionToken(sessionToken);
        if (userId) AvatarSDK.setUserId(userId);

        const avatar = await AvatarManager.shared.load(avatarId, (progress) => {
          optsRef.current.onLoadProgress?.(progress);
          setState((previous) => ({
            ...previous,
            downloadProgress:
              progress.type === LoadProgress.downloading
                ? (progress.progress ?? null)
                : progress.type === LoadProgress.completed
                  ? 1
                  : previous.downloadProgress,
          }));
        });
        if (disposedRef.current) return;

        const view = new AvatarView(avatar, container);
        const player = new AvatarPlayer(new LiveKitProvider(), view, optsRef.current.playerOptions);
        viewRef.current = view;
        playerRef.current = player;

        player.on('error', (error: unknown) => {
          const normalizedError = toError(error, 'Avatar error.');
          setState((previous) => ({ ...previous, error: normalizedError, status: 'error' }));
          optsRef.current.onAvatarError?.(normalizedError);
        });
        player.on('stalled', () => {
          void reconnect().catch(() => {});
        });
        player.on('disconnected', () => {
          if (disposedRef.current) return;
          optsRef.current.onDisconnected?.();
        });

        updateStatus('connecting');
        await player.connect({ roomName, token, url });
        if (disposedRef.current) return;

        const room = (player.getNativeClient() as Room | null) ?? null;
        setState((previous) => ({ ...previous, room }));
        updateStatus('connected');
        optsRef.current.onConnected?.(room);
      } catch (error) {
        if (disposedRef.current) return;
        const normalizedError = toError(error, 'Failed to initialize avatar.');
        setState((previous) => ({ ...previous, error: normalizedError, status: 'error' }));
        optsRef.current.onAvatarError?.(normalizedError);
      }
    };

    void connect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, containerReady]);

  // Tear down only on real unmount.
  useEffect(() => {
    return () => {
      disposedRef.current = true;
      const player = playerRef.current;
      const view = viewRef.current;
      playerRef.current = null;
      viewRef.current = null;
      initedRef.current = false;
      void player?.disconnect().catch(() => {});
      try {
        view?.dispose();
      } catch {
        // ignore
      }
    };
  }, []);

  return {
    ...state,
    connection,
    containerRef: setContainerRef,
    disconnect,
    reconnect,
    session,
  };
}
