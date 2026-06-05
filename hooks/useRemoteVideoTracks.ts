'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  ParticipantEvent,
  type RemoteParticipant,
  type RemoteTrack,
  type RemoteTrackPublication,
  type RemoteVideoTrack,
  type Room,
  RoomEvent,
  Track,
  VideoQuality,
} from 'livekit-client';
import {
  type TrackReference,
  useRemoteParticipants,
  useRoomContext,
} from '@livekit/components-react';
import type { AppConfig } from '@/app-config';

type RemoteVideoConfig = Pick<
  AppConfig,
  'debugVideo' | 'remoteVideoWidth' | 'remoteVideoHeight' | 'remoteVideoFps'
>;

export interface RemoteVideoTrackInfo {
  trackName: string;
  trackSid: string;
  participantIdentity: string;
  track: RemoteVideoTrack | null;
  publication: RemoteTrackPublication;
  isSubscribed: boolean;
}

export interface UseRemoteVideoTracksReturn {
  remoteVideoTracks: Map<string, RemoteVideoTrackInfo>;
  subscribeToTrack: (trackName: string) => Promise<boolean>;
  unsubscribeFromTrack: (trackName: string) => Promise<boolean>;
  getTrackByName: (trackName: string) => RemoteVideoTrackInfo | undefined;
  refreshTracks: () => void;
}

function debugVideoLog(config: RemoteVideoConfig | undefined, ...args: unknown[]) {
  if (config?.debugVideo) {
    console.log(...args);
  }
}

export function requestRemoteVideoHighQuality(
  publication: RemoteTrackPublication | null | undefined,
  config?: RemoteVideoConfig
) {
  if (!publication || publication.kind !== Track.Kind.Video) {
    return;
  }

  publication.setVideoQuality(VideoQuality.HIGH);
  publication.setVideoDimensions({
    width: config?.remoteVideoWidth ?? 640,
    height: config?.remoteVideoHeight ?? 480,
  });
  publication.setVideoFPS(config?.remoteVideoFps ?? 25);
}

export function createRemoteVideoTrackReference(
  room: Room | undefined,
  trackInfo: RemoteVideoTrackInfo
): TrackReference | null {
  const participant = room?.remoteParticipants.get(trackInfo.participantIdentity);
  if (!participant) {
    return null;
  }

  return {
    participant,
    publication: trackInfo.publication,
    source: trackInfo.publication.source,
  };
}

/**
 * Hook to manage remote video tracks from LiveKit participants
 * 管理来自 LiveKit 参与者的远程视频轨道
 */
export function useRemoteVideoTracks(config?: RemoteVideoConfig): UseRemoteVideoTracksReturn {
  const room = useRoomContext();
  const participants = useRemoteParticipants();
  const [remoteVideoTracks, setRemoteVideoTracks] = useState<Map<string, RemoteVideoTrackInfo>>(
    new Map()
  );

  // 刷新轨道列表
  const refreshTracks = useCallback(() => {
    const tracks = new Map<string, RemoteVideoTrackInfo>();

    participants.forEach((participant) => {
      participant.videoTrackPublications.forEach((publication) => {
        const trackName = publication.trackName || publication.trackSid;
        const trackInfo: RemoteVideoTrackInfo = {
          trackName,
          trackSid: publication.trackSid,
          participantIdentity: participant.identity,
          track: publication.track as RemoteVideoTrack | null,
          publication,
          isSubscribed: publication.isSubscribed,
        };
        tracks.set(trackName, trackInfo);
      });
    });

    setRemoteVideoTracks(tracks);
    debugVideoLog(
      config,
      `[useRemoteVideoTracks] Found ${tracks.size} remote video tracks:`,
      Array.from(tracks.keys())
    );
  }, [config, participants]);

  // 订阅指定轨道
  const subscribeToTrack = useCallback(
    async (trackName: string): Promise<boolean> => {
      const trackInfo = remoteVideoTracks.get(trackName);
      if (!trackInfo) {
        console.warn(`[useRemoteVideoTracks] Track "${trackName}" not found`);
        return false;
      }

      if (trackInfo.isSubscribed) {
        debugVideoLog(config, `[useRemoteVideoTracks] Track "${trackName}" is already subscribed`);
        requestRemoteVideoHighQuality(trackInfo.publication, config);
        return true;
      }

      try {
        trackInfo.publication.setSubscribed(true);
        requestRemoteVideoHighQuality(trackInfo.publication, config);
        debugVideoLog(
          config,
          `[useRemoteVideoTracks] Successfully subscribed to track: ${trackName}`
        );
        return true;
      } catch (error) {
        console.error(`[useRemoteVideoTracks] Failed to subscribe to track "${trackName}":`, error);
        return false;
      }
    },
    [config, remoteVideoTracks]
  );

  // 取消订阅指定轨道
  const unsubscribeFromTrack = useCallback(
    async (trackName: string): Promise<boolean> => {
      const trackInfo = remoteVideoTracks.get(trackName);
      if (!trackInfo) {
        console.warn(`[useRemoteVideoTracks] Track "${trackName}" not found`);
        return false;
      }

      if (!trackInfo.isSubscribed) {
        debugVideoLog(
          config,
          `[useRemoteVideoTracks] Track "${trackName}" is already unsubscribed`
        );
        return true;
      }

      try {
        trackInfo.publication.setSubscribed(false);
        debugVideoLog(
          config,
          `[useRemoteVideoTracks] Successfully unsubscribed from track: ${trackName}`
        );
        return true;
      } catch (error) {
        console.error(
          `[useRemoteVideoTracks] Failed to unsubscribe from track "${trackName}":`,
          error
        );
        return false;
      }
    },
    [config, remoteVideoTracks]
  );

  // 根据名称获取轨道信息
  const getTrackByName = useCallback(
    (trackName: string): RemoteVideoTrackInfo | undefined => {
      return remoteVideoTracks.get(trackName);
    },
    [remoteVideoTracks]
  );

  // 监听参与者和轨道变化
  useEffect(() => {
    if (!room) return;

    // 初始化轨道列表
    refreshTracks();

    // 监听轨道订阅事件
    const handleTrackSubscribed = (track: RemoteTrack, publication: RemoteTrackPublication) => {
      if (track.kind === Track.Kind.Video) {
        requestRemoteVideoHighQuality(publication, config);
        debugVideoLog(
          config,
          `[useRemoteVideoTracks] Video track subscribed: ${publication.trackName || publication.trackSid}`
        );
        refreshTracks();
      }
    };

    const handleTrackUnsubscribed = (track: RemoteTrack, publication: RemoteTrackPublication) => {
      if (track.kind === Track.Kind.Video) {
        debugVideoLog(
          config,
          `[useRemoteVideoTracks] Video track unsubscribed: ${publication.trackName || publication.trackSid}`
        );
        refreshTracks();
      }
    };

    const handleTrackPublished = (publication: RemoteTrackPublication) => {
      if (publication.kind === Track.Kind.Video) {
        debugVideoLog(
          config,
          `[useRemoteVideoTracks] Video track published: ${publication.trackName || publication.trackSid}`
        );
        refreshTracks();
      }
    };

    const handleTrackUnpublished = (publication: RemoteTrackPublication) => {
      if (publication.kind === Track.Kind.Video) {
        debugVideoLog(
          config,
          `[useRemoteVideoTracks] Video track unpublished: ${publication.trackName || publication.trackSid}`
        );
        refreshTracks();
      }
    };

    const participantListenerCleanups: Array<() => void> = [];

    const attachParticipantListeners = (participant: RemoteParticipant) => {
      participant.on(ParticipantEvent.TrackSubscribed, handleTrackSubscribed);
      participant.on(ParticipantEvent.TrackUnsubscribed, handleTrackUnsubscribed);
      participant.on(ParticipantEvent.TrackPublished, handleTrackPublished);
      participant.on(ParticipantEvent.TrackUnpublished, handleTrackUnpublished);

      participantListenerCleanups.push(() => {
        participant.off(ParticipantEvent.TrackSubscribed, handleTrackSubscribed);
        participant.off(ParticipantEvent.TrackUnsubscribed, handleTrackUnsubscribed);
        participant.off(ParticipantEvent.TrackPublished, handleTrackPublished);
        participant.off(ParticipantEvent.TrackUnpublished, handleTrackUnpublished);
      });
    };

    // 监听现有参与者的事件
    participants.forEach(attachParticipantListeners);

    // 监听参与者连接/断开
    const handleParticipantConnected = (participant: RemoteParticipant) => {
      debugVideoLog(
        config,
        `[useRemoteVideoTracks] Participant connected: ${participant.identity}`
      );
      attachParticipantListeners(participant);
      refreshTracks();
    };

    const handleParticipantDisconnected = (participant: RemoteParticipant) => {
      debugVideoLog(
        config,
        `[useRemoteVideoTracks] Participant disconnected: ${participant.identity}`
      );
      refreshTracks();
    };

    room.on(RoomEvent.ParticipantConnected, handleParticipantConnected);
    room.on(RoomEvent.ParticipantDisconnected, handleParticipantDisconnected);

    return () => {
      participantListenerCleanups.forEach((cleanup) => cleanup());
      room.off(RoomEvent.ParticipantConnected, handleParticipantConnected);
      room.off(RoomEvent.ParticipantDisconnected, handleParticipantDisconnected);
    };
  }, [config, room, participants, refreshTracks]);

  return {
    remoteVideoTracks,
    subscribeToTrack,
    unsubscribeFromTrack,
    getTrackByName,
    refreshTracks,
  };
}
