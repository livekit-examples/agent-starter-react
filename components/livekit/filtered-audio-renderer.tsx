'use client';

import { useEffect, useRef } from 'react';
import {
  ParticipantEvent,
  RemoteParticipant,
  RemoteTrack,
  RemoteTrackPublication,
  RoomEvent,
  Track,
} from 'livekit-client';
import { useRemoteParticipants, useRoomContext } from '@livekit/components-react';

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
};

interface FilteredAudioRendererProps {
  excludeTrackNames?: string[];
  volume?: number;
  debugAudio?: boolean;
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
  pendingPlayback,
  trigger,
}: {
  audioElement: HTMLAudioElement;
  debugAudio?: boolean;
  elementKey: string;
  diagnostics: AudioTrackDiagnostics;
  pendingPlayback: Map<string, PendingPlayback>;
  trigger: string;
}) {
  const playPromise = audioElement.play();
  if (playPromise === undefined) {
    pendingPlayback.delete(elementKey);
    return;
  }

  playPromise
    .then(() => {
      pendingPlayback.delete(elementKey);
      debugAudioLog(debugAudio, '[FilteredAudioRenderer] 音频播放成功', {
        trigger,
        track: diagnostics,
      });
    })
    .catch((error: unknown) => {
      pendingPlayback.set(elementKey, {
        element: audioElement,
        diagnostics,
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
}: FilteredAudioRendererProps) {
  const room = useRoomContext();
  const participants = useRemoteParticipants();
  const audioElementsRef = useRef<Map<string, HTMLAudioElement>>(new Map());
  const pendingPlaybackRef = useRef<Map<string, PendingPlayback>>(new Map());

  useEffect(() => {
    if (!room) return;

    const audioElements = audioElementsRef.current;
    const pendingPlayback = pendingPlaybackRef.current;

    // 清理函数
    const cleanup = () => {
      audioElements.forEach((element) => {
        element.pause();
        element.srcObject = null;
        element.remove();
      });
      audioElements.clear();
      pendingPlayback.clear();
    };

    // 处理音频轨道订阅
    const handleAudioTrack = (publication: RemoteTrackPublication, participantIdentity: string) => {
      if (publication.kind !== Track.Kind.Audio || !publication.track) {
        return;
      }

      const trackName = publication.trackName || publication.trackSid;
      const elementKey = `${participantIdentity}-${trackName}`;
      const diagnostics = buildAudioTrackDiagnostics(publication, participantIdentity);

      debugAudioLog(debugAudio, '[FilteredAudioRenderer] 收到音频轨道订阅', diagnostics);

      // 检查是否应该排除此轨道
      const shouldExclude = excludeTrackNames.some(
        (excludeName) =>
          trackName.includes(excludeName) ||
          trackName === excludeName ||
          publication.trackSid === excludeName
      );

      if (shouldExclude) {
        debugAudioLog(
          debugAudio,
          `[FilteredAudioRenderer] 排除音频轨道: ${trackName} (参与者: ${participantIdentity})`,
          diagnostics
        );

        // 如果之前有播放这个轨道，现在停止
        const existingElement = audioElements.get(elementKey);
        if (existingElement) {
          existingElement.pause();
          existingElement.srcObject = null;
          existingElement.remove();
          audioElements.delete(elementKey);
          pendingPlayback.delete(elementKey);
        }
        return;
      }

      debugAudioLog(debugAudio, '[FilteredAudioRenderer] 准备播放远端音频轨道', diagnostics);

      // 创建或更新音频元素
      let audioElement = audioElements.get(elementKey);
      if (!audioElement) {
        audioElement = document.createElement('audio');
        audioElement.autoplay = true;
        audioElement.setAttribute('playsinline', 'true');
        audioElement.dataset.livekitParticipantIdentity = participantIdentity;
        audioElement.dataset.livekitTrackName = trackName;
        audioElement.volume = volume;
        document.body.appendChild(audioElement);
        audioElements.set(elementKey, audioElement);

        debugAudioLog(
          debugAudio,
          `[FilteredAudioRenderer] 创建音频元素: ${trackName} (参与者: ${participantIdentity})`
        );
      }

      // 设置音频流
      const mediaStream = new MediaStream([publication.track.mediaStreamTrack]);
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
        pendingPlayback,
        trigger: 'track-subscribed',
      });
    };

    const retryPendingPlayback = (trigger: string) => {
      pendingPlayback.forEach(({ element, diagnostics }, elementKey) => {
        playAudioElement({
          audioElement: element,
          debugAudio,
          elementKey,
          diagnostics,
          pendingPlayback,
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

      const audioElement = audioElements.get(elementKey);
      if (audioElement) {
        audioElement.pause();
        audioElement.srcObject = null;
        audioElement.remove();
        audioElements.delete(elementKey);
        pendingPlayback.delete(elementKey);

        debugAudioLog(
          debugAudio,
          `[FilteredAudioRenderer] 停止音频轨道: ${trackName} (参与者: ${participantIdentity})`
        );
      }
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
      audioElements.forEach((element, key) => {
        if (key.startsWith(`${participant.identity}-`)) {
          element.pause();
          element.srcObject = null;
          element.remove();
          keysToRemove.push(key);
        }
      });
      keysToRemove.forEach((key) => {
        audioElements.delete(key);
        pendingPlayback.delete(key);
      });
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
