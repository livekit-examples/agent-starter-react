'use client';

import { useCallback, useEffect } from 'react';
import {
  ParticipantEvent,
  type RemoteParticipant,
  type RemoteTrackPublication,
  RoomEvent,
  Track,
  type TrackPublication,
} from 'livekit-client';
import { useRemoteParticipants, useRoomContext } from '@livekit/components-react';

interface UseAudioTrackFilterProps {
  excludeTrackNames?: string[];
  autoUnsubscribe?: boolean; // 是否自动取消订阅被排除的轨道
}

/**
 * 音频轨道过滤Hook
 * 提供更精细的音频轨道订阅控制
 */
export function useAudioTrackFilter({
  excludeTrackNames = [],
  autoUnsubscribe = false,
}: UseAudioTrackFilterProps = {}) {
  const room = useRoomContext();
  const participants = useRemoteParticipants();

  // 检查轨道是否应该被排除
  const shouldExcludeTrack = useCallback(
    (publication: TrackPublication): boolean => {
      const trackName = publication.trackName || publication.trackSid;
      return excludeTrackNames.some((excludeName) => {
        if (!excludeName) {
          return false;
        }
        return trackName.includes(excludeName) || publication.trackSid === excludeName;
      });
    },
    [excludeTrackNames]
  );

  // 手动取消订阅指定轨道
  const unsubscribeTrack = useCallback(
    async (trackSid: string) => {
      if (!room) return false;

      for (const participant of participants) {
        // 查找音频轨道
        const publication = participant.audioTrackPublications.get(
          trackSid
        ) as RemoteTrackPublication;
        if (publication && publication.isSubscribed) {
          try {
            publication.setSubscribed(false);
            console.log(
              `[AudioTrackFilter] 手动取消订阅音频轨道: ${publication.trackName || trackSid}`
            );
            return true;
          } catch (error) {
            console.error(`[AudioTrackFilter] 取消订阅失败:`, error);
            return false;
          }
        }
      }
      return false;
    },
    [room, participants]
  );

  // 手动订阅指定轨道
  const subscribeTrack = useCallback(
    async (trackSid: string) => {
      if (!room) return false;

      for (const participant of participants) {
        // 查找音频轨道
        const publication = participant.audioTrackPublications.get(
          trackSid
        ) as RemoteTrackPublication;
        if (publication && !publication.isSubscribed) {
          try {
            publication.setSubscribed(true);
            console.log(
              `[AudioTrackFilter] 手动订阅音频轨道: ${publication.trackName || trackSid}`
            );
            return true;
          } catch (error) {
            console.error(`[AudioTrackFilter] 订阅失败:`, error);
            return false;
          }
        }
      }
      return false;
    },
    [room, participants]
  );

  // 获取所有被过滤的轨道信息
  const getFilteredTracks = useCallback(() => {
    const filteredTracks: Array<{
      participantIdentity: string;
      trackSid: string;
      trackName: string;
      isSubscribed: boolean;
    }> = [];

    participants.forEach((participant) => {
      participant.audioTrackPublications.forEach((publication) => {
        if (shouldExcludeTrack(publication)) {
          filteredTracks.push({
            participantIdentity: participant.identity,
            trackSid: publication.trackSid,
            trackName: publication.trackName || publication.trackSid,
            isSubscribed: publication.isSubscribed,
          });
        }
      });
    });

    return filteredTracks;
  }, [participants, shouldExcludeTrack]);

  // 自动处理轨道订阅
  useEffect(() => {
    if (!room || !autoUnsubscribe) return;

    const handleTrackPublished = async (publication: RemoteTrackPublication) => {
      if (publication.kind === Track.Kind.Audio && shouldExcludeTrack(publication)) {
        console.log(
          `[AudioTrackFilter] 检测到被排除的音频轨道，自动取消订阅: ${publication.trackName || publication.trackSid}`
        );
        try {
          publication.setSubscribed(false);
        } catch (error) {
          console.error(`[AudioTrackFilter] 自动取消订阅失败:`, error);
        }
      }
    };

    // 处理现有轨道
    participants.forEach((participant) => {
      participant.audioTrackPublications.forEach((publication) => {
        if (publication.isSubscribed && shouldExcludeTrack(publication)) {
          console.log(
            `[AudioTrackFilter] 发现已订阅的被排除轨道，取消订阅: ${publication.trackName || publication.trackSid}`
          );
          try {
            (publication as RemoteTrackPublication).setSubscribed(false);
          } catch (error) {
            console.error(`[AudioTrackFilter] 取消订阅失败:`, error);
          }
        }
      });

      participant.on(ParticipantEvent.TrackPublished, handleTrackPublished);
    });

    const onParticipantConnected = (participant: RemoteParticipant) => {
      participant.on(ParticipantEvent.TrackPublished, handleTrackPublished);
    };

    room.on(RoomEvent.ParticipantConnected, onParticipantConnected);

    return () => {
      room.off(RoomEvent.ParticipantConnected, onParticipantConnected);
      participants.forEach((participant) => {
        participant.off(ParticipantEvent.TrackPublished, handleTrackPublished);
      });
    };
  }, [room, participants, shouldExcludeTrack, autoUnsubscribe]);

  return {
    shouldExcludeTrack,
    unsubscribeTrack,
    subscribeTrack,
    getFilteredTracks,
  };
}
