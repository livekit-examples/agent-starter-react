'use client';

import { useCallback, useEffect, useRef } from 'react';
import {
  ParticipantEvent,
  RemoteParticipant,
  RemoteTrack,
  RemoteTrackPublication,
  RoomEvent,
  Track,
} from 'livekit-client';
import { useRemoteParticipants, useRoomContext } from '@livekit/components-react';
import { startMediaTrackAudioObserver } from '@/lib/frontend-audio-observer';
import {
  FRONTEND_EVENTS,
  OBSERVABILITY_ATTRS,
  outputSegmentAttributesFromMarker,
  parseBackendObservabilityMarkerPayload,
  publishFrontendObservabilityEvent,
} from '@/lib/observability';
import type { ObservabilityAttribute } from '@/lib/observability';

function debugAudioLog(enabled: boolean | undefined, ...args: unknown[]) {
  if (enabled) {
    console.log(...args);
  }
}

type AudioTrackDiagnostics = {
  participantIdentity: string;
  trackName: string;
  trackSid: string;
  source: string;
  publicationMuted: boolean;
  subscribed: boolean;
  trackEnabled?: boolean;
  trackMuted?: boolean;
  trackReadyState?: MediaStreamTrackState;
};

type PendingPlayback = {
  element: HTMLAudioElement;
  diagnostics: AudioTrackDiagnostics;
  mediaStreamTrack: MediaStreamTrack;
};

interface FilteredAudioRendererProps {
  excludeTrackNames?: string[];
  volume?: number;
  debugAudio?: boolean;
  observabilityEnabled?: boolean;
}

function participantSegmentKey(participantIdentity: string) {
  return `participant:${participantIdentity}`;
}

function buildAudioTrackDiagnostics(
  publication: RemoteTrackPublication,
  participantIdentity: string
): AudioTrackDiagnostics {
  const mediaStreamTrack = publication.track?.mediaStreamTrack;

  return {
    participantIdentity,
    trackName: publication.trackName || publication.trackSid,
    trackSid: publication.trackSid,
    source: String(publication.source),
    publicationMuted: publication.isMuted,
    subscribed: publication.isSubscribed,
    trackEnabled: mediaStreamTrack?.enabled,
    trackMuted: mediaStreamTrack?.muted,
    trackReadyState: mediaStreamTrack?.readyState,
  };
}

function describePlaybackError(error: unknown) {
  if (error instanceof DOMException || error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
    };
  }

  return {
    name: 'UnknownError',
    message: String(error),
  };
}

function playAudioElement({
  audioElement,
  debugAudio,
  elementKey,
  diagnostics,
  mediaStreamTrack,
  pendingPlayback,
  recordPlaybackError,
  startPlaybackObserver,
  trigger,
}: {
  audioElement: HTMLAudioElement;
  debugAudio?: boolean;
  elementKey: string;
  diagnostics: AudioTrackDiagnostics;
  mediaStreamTrack: MediaStreamTrack;
  pendingPlayback: Map<string, PendingPlayback>;
  recordPlaybackError: (
    diagnostics: AudioTrackDiagnostics,
    trigger: string,
    error: unknown
  ) => void;
  startPlaybackObserver: (
    elementKey: string,
    diagnostics: AudioTrackDiagnostics,
    mediaStreamTrack: MediaStreamTrack
  ) => void;
  trigger: string;
}) {
  const playPromise = audioElement.play();
  if (playPromise === undefined) {
    pendingPlayback.delete(elementKey);
    startPlaybackObserver(elementKey, diagnostics, mediaStreamTrack);
    return;
  }

  playPromise
    .then(() => {
      pendingPlayback.delete(elementKey);
      startPlaybackObserver(elementKey, diagnostics, mediaStreamTrack);
      debugAudioLog(debugAudio, '[FilteredAudioRenderer] 音频播放成功', {
        trigger,
        track: diagnostics,
      });
    })
    .catch((error: unknown) => {
      recordPlaybackError(diagnostics, trigger, error);
      pendingPlayback.set(elementKey, {
        element: audioElement,
        diagnostics,
        mediaStreamTrack,
      });
      debugAudioLog(debugAudio, '[FilteredAudioRenderer] 音频播放失败，等待用户手势后重试', {
        trigger,
        error: describePlaybackError(error),
        track: diagnostics,
        element: {
          paused: audioElement.paused,
          muted: audioElement.muted,
          volume: audioElement.volume,
          readyState: audioElement.readyState,
        },
      });
    });
}

/**
 * 自定义音频渲染器，支持按轨道名称过滤音频
 * 可以排除指定名称的音频轨道不进行播放
 */
export function FilteredAudioRenderer({
  excludeTrackNames = [],
  volume = 1.0,
  debugAudio,
  observabilityEnabled,
}: FilteredAudioRendererProps) {
  const room = useRoomContext();
  const participants = useRemoteParticipants();
  const audioElementsRef = useRef<Map<string, HTMLAudioElement>>(new Map());
  const pendingPlaybackRef = useRef<Map<string, PendingPlayback>>(new Map());
  const playbackObserverStopsRef = useRef<Map<string, () => void>>(new Map());
  const outputSegmentsRef = useRef<Map<string, Record<string, ObservabilityAttribute>>>(new Map());
  const activePlaybackSourcesRef = useRef<Map<string, PendingPlayback>>(new Map());
  const sharedAudioContextRef = useRef<AudioContext | null>(null);
  const observabilityEnabledRef = useRef(false);
  const recordFrontendObservabilityRef = useRef<
    (name: string, attributes?: Record<string, ObservabilityAttribute>) => void
  >(() => {});
  const recordFrontendObservability = useCallback(
    (name: string, attributes?: Record<string, ObservabilityAttribute>) => {
      void publishFrontendObservabilityEvent({
        enabled: !!observabilityEnabled,
        room,
        name,
        attributes,
      }).catch((error) => {
        console.warn('[frontend-observability] failed to publish event', error);
      });
    },
    [observabilityEnabled, room]
  );
  observabilityEnabledRef.current = !!observabilityEnabled;
  recordFrontendObservabilityRef.current = recordFrontendObservability;

  useEffect(() => {
    if (observabilityEnabled) {
      return;
    }

    playbackObserverStopsRef.current.forEach((stop) => stop());
    playbackObserverStopsRef.current.clear();
    outputSegmentsRef.current.clear();
    void sharedAudioContextRef.current?.close?.().catch(() => undefined);
    sharedAudioContextRef.current = null;
  }, [observabilityEnabled]);

  useEffect(() => {
    if (!room) return;
    const outputSegments = outputSegmentsRef.current;
    if (!observabilityEnabled) {
      outputSegments.clear();
      return;
    }

    const onDataReceived = (
      payload: Uint8Array,
      participant?: { identity?: string },
      _kind?: unknown,
      topic?: string
    ) => {
      const marker = parseBackendObservabilityMarkerPayload(payload, topic);
      if (!marker) {
        return;
      }
      const attributes = outputSegmentAttributesFromMarker(marker);
      // Fallback order: canonical backend marker field -> legacy field -> LiveKit sender.
      const markerParticipant = String(
        marker.attributes[OBSERVABILITY_ATTRS.PARTICIPANT_IDENTITY] ||
          marker.attributes[OBSERVABILITY_ATTRS.PARTICIPANT_IDENTITY_LEGACY] ||
          participant?.identity ||
          ''
      ).trim();
      if (!markerParticipant || !attributes[OBSERVABILITY_ATTRS.OUTPUT_SEGMENT_ID]) {
        return;
      }
      outputSegments.set(participantSegmentKey(markerParticipant), attributes);
    };

    room.on(RoomEvent.DataReceived, onDataReceived);
    return () => {
      room.off(RoomEvent.DataReceived, onDataReceived);
    };
  }, [room, observabilityEnabled]);

  useEffect(() => {
    if (!room) return;

    const audioElements = audioElementsRef.current;
    const pendingPlayback = pendingPlaybackRef.current;
    const playbackObserverStops = playbackObserverStopsRef.current;
    const outputSegments = outputSegmentsRef.current;
    const activePlaybackSources = activePlaybackSourcesRef.current;
    const audioElementListenerCleanups = new Map<string, () => void>();
    const getSharedAudioContext = () => {
      if (sharedAudioContextRef.current && sharedAudioContextRef.current.state !== 'closed') {
        return sharedAudioContextRef.current;
      }
      const AudioContextClass =
        typeof window === 'undefined'
          ? undefined
          : window.AudioContext || window.webkitAudioContext;
      if (!AudioContextClass) {
        return undefined;
      }
      sharedAudioContextRef.current = new AudioContextClass();
      return sharedAudioContextRef.current;
    };
    const activeSegmentAttributes = (participantIdentity: string) =>
      outputSegments.get(participantSegmentKey(participantIdentity)) ?? {};
    const playbackAttributes = (diagnostics: AudioTrackDiagnostics) => ({
      [OBSERVABILITY_ATTRS.FRONTEND_AUDIO_DIRECTION]: 'output',
      [OBSERVABILITY_ATTRS.PARTICIPANT_IDENTITY]: diagnostics.participantIdentity,
      [OBSERVABILITY_ATTRS.TRACK_NAME]: diagnostics.trackName,
      [OBSERVABILITY_ATTRS.TRACK_SID]: diagnostics.trackSid,
      [OBSERVABILITY_ATTRS.TRACK_SOURCE]: diagnostics.source,
      ...activeSegmentAttributes(diagnostics.participantIdentity),
    });
    const stopPlaybackObserver = (elementKey: string) => {
      playbackObserverStops.get(elementKey)?.();
      playbackObserverStops.delete(elementKey);
    };
    const recordPlaybackError = (
      diagnostics: AudioTrackDiagnostics,
      trigger: string,
      error: unknown
    ) => {
      const { name, message } = describePlaybackError(error);
      recordFrontendObservabilityRef.current(FRONTEND_EVENTS.REPLY_AUDIO_PLAYBACK_ERROR, {
        ...playbackAttributes(diagnostics),
        [OBSERVABILITY_ATTRS.FRONTEND_AUDIO_REASON]: trigger,
        [OBSERVABILITY_ATTRS.FRONTEND_AUDIO_ERROR]: `${name}: ${message}`,
      });
    };
    const startPlaybackObserver = (
      elementKey: string,
      diagnostics: AudioTrackDiagnostics,
      mediaStreamTrack: MediaStreamTrack
    ) => {
      if (!observabilityEnabledRef.current) {
        return;
      }
      stopPlaybackObserver(elementKey);
      playbackObserverStops.set(
        elementKey,
        startMediaTrackAudioObserver({
          mediaStreamTrack,
          startEventName: FRONTEND_EVENTS.REPLY_AUDIO_PLAYBACK_STARTED,
          endEventName: FRONTEND_EVENTS.REPLY_AUDIO_PLAYBACK_ENDED,
          resumeErrorEventName: FRONTEND_EVENTS.REPLY_AUDIO_PLAYBACK_ERROR,
          emit: (name, attributes) => recordFrontendObservabilityRef.current(name, attributes),
          sharedAudioContext: getSharedAudioContext(),
          attributes: () => playbackAttributes(diagnostics),
          startThreshold: 0.012,
          endThreshold: 0.004,
          startDurationMs: 40,
          endSilenceMs: 350,
        }).stop
      );
    };
    const removeAudioElement = (elementKey: string) => {
      const audioElement = audioElements.get(elementKey);
      if (!audioElement) {
        pendingPlayback.delete(elementKey);
        activePlaybackSources.delete(elementKey);
        stopPlaybackObserver(elementKey);
        return;
      }

      audioElementListenerCleanups.get(elementKey)?.();
      audioElementListenerCleanups.delete(elementKey);
      activePlaybackSources.delete(elementKey);
      stopPlaybackObserver(elementKey);
      audioElement.pause();
      audioElement.srcObject = null;
      audioElement.remove();
      audioElements.delete(elementKey);
      pendingPlayback.delete(elementKey);
    };

    // 清理函数
    const cleanup = () => {
      Array.from(audioElements.keys()).forEach((elementKey) => removeAudioElement(elementKey));
      pendingPlayback.clear();
      activePlaybackSources.clear();
      outputSegments.clear();
      void sharedAudioContextRef.current?.close?.().catch(() => undefined);
      sharedAudioContextRef.current = null;
    };

    // 处理音频轨道订阅
    const handleAudioTrack = (publication: RemoteTrackPublication, participantIdentity: string) => {
      if (publication.kind !== Track.Kind.Audio || !publication.track) {
        return;
      }

      const trackName = publication.trackName || publication.trackSid;
      const elementKey = `${participantIdentity}-${trackName}`;
      const diagnostics = buildAudioTrackDiagnostics(publication, participantIdentity);
      const mediaStreamTrack = publication.track.mediaStreamTrack;

      debugAudioLog(debugAudio, '[FilteredAudioRenderer] 收到音频轨道订阅', diagnostics);

      // 检查是否应该排除此轨道
      const shouldExclude = excludeTrackNames.some((excludeName) => {
        if (!excludeName) {
          return false;
        }
        return trackName.includes(excludeName) || publication.trackSid === excludeName;
      });

      if (shouldExclude) {
        debugAudioLog(
          debugAudio,
          `[FilteredAudioRenderer] 排除音频轨道: ${trackName} (参与者: ${participantIdentity})`,
          diagnostics
        );

        // 如果之前有播放这个轨道，现在停止
        removeAudioElement(elementKey);
        return;
      }

      debugAudioLog(debugAudio, '[FilteredAudioRenderer] 准备播放远端音频轨道', diagnostics);

      // 创建或更新音频元素
      let audioElement = audioElements.get(elementKey);
      if (!audioElement) {
        const createdAudioElement = document.createElement('audio');
        createdAudioElement.autoplay = true;
        createdAudioElement.setAttribute('playsinline', 'true');
        createdAudioElement.dataset.livekitParticipantIdentity = participantIdentity;
        createdAudioElement.dataset.livekitTrackName = trackName;
        createdAudioElement.volume = volume;
        const handleElementPlaybackStopped = () => {
          stopPlaybackObserver(elementKey);
        };
        const handleElementPlaybackStarted = () => {
          const playbackSource = activePlaybackSources.get(elementKey);
          if (!playbackSource || playbackObserverStops.has(elementKey)) {
            return;
          }
          pendingPlayback.delete(elementKey);
          startPlaybackObserver(
            elementKey,
            playbackSource.diagnostics,
            playbackSource.mediaStreamTrack
          );
        };
        const handleElementPlaybackError = () => {
          const playbackSource = activePlaybackSources.get(elementKey);
          stopPlaybackObserver(elementKey);
          recordPlaybackError(
            playbackSource?.diagnostics ?? diagnostics,
            'audio-element-error',
            createdAudioElement.error ?? new Error('audio element playback failed')
          );
        };
        createdAudioElement.addEventListener('playing', handleElementPlaybackStarted);
        createdAudioElement.addEventListener('pause', handleElementPlaybackStopped);
        createdAudioElement.addEventListener('ended', handleElementPlaybackStopped);
        createdAudioElement.addEventListener('error', handleElementPlaybackError);
        audioElementListenerCleanups.set(elementKey, () => {
          createdAudioElement.removeEventListener('playing', handleElementPlaybackStarted);
          createdAudioElement.removeEventListener('pause', handleElementPlaybackStopped);
          createdAudioElement.removeEventListener('ended', handleElementPlaybackStopped);
          createdAudioElement.removeEventListener('error', handleElementPlaybackError);
        });
        document.body.appendChild(createdAudioElement);
        audioElements.set(elementKey, createdAudioElement);
        audioElement = createdAudioElement;

        debugAudioLog(
          debugAudio,
          `[FilteredAudioRenderer] 创建音频元素: ${trackName} (参与者: ${participantIdentity})`
        );
      }

      // 设置音频流
      activePlaybackSources.set(elementKey, {
        element: audioElement,
        diagnostics,
        mediaStreamTrack,
      });
      const mediaStream = new MediaStream([mediaStreamTrack]);
      audioElement.srcObject = mediaStream;
      audioElement.volume = volume;

      debugAudioLog(
        debugAudio,
        `[FilteredAudioRenderer] 准备播放音频轨道: ${trackName} (参与者: ${participantIdentity})`,
        diagnostics
      );

      playAudioElement({
        audioElement,
        debugAudio,
        elementKey,
        diagnostics,
        mediaStreamTrack,
        pendingPlayback,
        recordPlaybackError,
        startPlaybackObserver,
        trigger: 'track-subscribed',
      });
    };

    const retryPendingPlayback = (trigger: string) => {
      pendingPlayback.forEach(({ element, diagnostics, mediaStreamTrack }, elementKey) => {
        playAudioElement({
          audioElement: element,
          debugAudio,
          elementKey,
          diagnostics,
          mediaStreamTrack,
          pendingPlayback,
          recordPlaybackError,
          startPlaybackObserver,
          trigger,
        });
      });
    };

    const handleUserGesture = () => {
      retryPendingPlayback('user-gesture');
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        retryPendingPlayback('visibility-visible');
      }
    };

    const handleWindowFocus = () => {
      retryPendingPlayback('window-focus');
    };

    window.addEventListener('pointerdown', handleUserGesture, { capture: true });
    window.addEventListener('keydown', handleUserGesture, { capture: true });
    window.addEventListener('focus', handleWindowFocus);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    debugAudioLog(debugAudio, '[FilteredAudioRenderer] 已启用音频播放诊断和用户手势重试');

    // 处理轨道取消订阅
    const handleTrackUnsubscribed = (
      publication: RemoteTrackPublication,
      participantIdentity: string
    ) => {
      if (publication.kind !== Track.Kind.Audio) return;

      const trackName = publication.trackName || publication.trackSid;
      const elementKey = `${participantIdentity}-${trackName}`;

      removeAudioElement(elementKey);
      debugAudioLog(
        debugAudio,
        `[FilteredAudioRenderer] 停止音频轨道: ${trackName} (参与者: ${participantIdentity})`
      );
    };

    const participantListenerCleanups: Array<() => void> = [];

    const attachParticipantListeners = (participant: RemoteParticipant) => {
      participant.audioTrackPublications.forEach((publication) => {
        if (publication.isSubscribed && publication.track) {
          handleAudioTrack(publication, participant.identity);
        }
      });

      // 监听新的轨道订阅
      const onTrackSubscribed = (track: RemoteTrack, publication: RemoteTrackPublication) => {
        if (track.kind === Track.Kind.Audio) {
          handleAudioTrack(publication, participant.identity);
        }
      };

      const onTrackUnsubscribed = (track: RemoteTrack, publication: RemoteTrackPublication) => {
        if (track.kind === Track.Kind.Audio) {
          handleTrackUnsubscribed(publication, participant.identity);
        }
      };

      participant.on(ParticipantEvent.TrackSubscribed, onTrackSubscribed);
      participant.on(ParticipantEvent.TrackUnsubscribed, onTrackUnsubscribed);

      participantListenerCleanups.push(() => {
        participant.off(ParticipantEvent.TrackSubscribed, onTrackSubscribed);
        participant.off(ParticipantEvent.TrackUnsubscribed, onTrackUnsubscribed);
      });
    };

    // 监听现有参与者的轨道
    participants.forEach(attachParticipantListeners);

    // 监听参与者变化
    const onParticipantConnected = (participant: RemoteParticipant) => {
      attachParticipantListeners(participant);
    };

    const onParticipantDisconnected = (participant: RemoteParticipant) => {
      // 清理该参与者的所有音频元素
      const keysToRemove: string[] = [];
      audioElements.forEach((_element, key) => {
        if (key.startsWith(`${participant.identity}-`)) {
          keysToRemove.push(key);
        }
      });
      keysToRemove.forEach((key) => removeAudioElement(key));
      outputSegments.delete(participantSegmentKey(participant.identity));
    };

    room.on(RoomEvent.ParticipantConnected, onParticipantConnected);
    room.on(RoomEvent.ParticipantDisconnected, onParticipantDisconnected);

    return () => {
      cleanup();
      window.removeEventListener('pointerdown', handleUserGesture, { capture: true });
      window.removeEventListener('keydown', handleUserGesture, { capture: true });
      window.removeEventListener('focus', handleWindowFocus);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      room.off(RoomEvent.ParticipantConnected, onParticipantConnected);
      room.off(RoomEvent.ParticipantDisconnected, onParticipantDisconnected);
      participantListenerCleanups.forEach((cleanupListener) => cleanupListener());
    };
  }, [room, participants, excludeTrackNames, volume, debugAudio]);

  // 更新音量
  useEffect(() => {
    audioElementsRef.current.forEach((element) => {
      element.volume = volume;
    });
  }, [volume]);

  return null; // 这个组件不渲染任何UI
}
