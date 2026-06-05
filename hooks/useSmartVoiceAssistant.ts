'use client';

import { useMemo } from 'react';
import { useRemoteParticipants, useVoiceAssistant } from '@livekit/components-react';
import { VideoTrackConfig } from '@/app-config';
import { useExcludedVideoTracks } from './useExcludedVideoTracks';

const EXCLUDED_AVATAR_PARTICIPANT_IDENTITIES = new Set(['room_audio_input', 'room_vision_input']);

export interface UseSmartVoiceAssistantOptions {
  videoTrackConfigs?: VideoTrackConfig[];
}

/**
 * 智能语音助手 Hook，优先选择非配置的视频轨道作为 avatar
 */
export function useSmartVoiceAssistant({
  videoTrackConfigs = [],
}: UseSmartVoiceAssistantOptions = {}) {
  const voiceAssistant = useVoiceAssistant();
  const remoteParticipants = useRemoteParticipants();
  const { shouldExcludeTrack } = useExcludedVideoTracks({ videoTrackConfigs });

  // 智能选择 avatar 视频轨道
  const smartVideoTrack = useMemo(() => {
    // 如果原始 voiceAssistant 有视频轨道且不在排除列表中，使用它
    if (voiceAssistant.videoTrack) {
      const trackName =
        voiceAssistant.videoTrack.publication.trackName ||
        voiceAssistant.videoTrack.publication.trackSid;
      const participantIdentity = voiceAssistant.videoTrack.participant.identity;

      if (
        !EXCLUDED_AVATAR_PARTICIPANT_IDENTITIES.has(participantIdentity) &&
        !shouldExcludeTrack(trackName)
      ) {
        return voiceAssistant.videoTrack;
      }
    }

    // 如果原始轨道被排除，寻找其他合适的轨道
    for (const participant of remoteParticipants) {
      if (!participant.isAgent) continue;
      if (EXCLUDED_AVATAR_PARTICIPANT_IDENTITIES.has(participant.identity)) continue;

      for (const [, publication] of participant.videoTrackPublications) {
        if (!publication.isSubscribed || !publication.track) continue;

        const trackName = publication.trackName || publication.trackSid;

        // 跳过配置中的轨道
        if (shouldExcludeTrack(trackName)) {
          continue;
        }

        // 找到合适的轨道
        const trackRef = {
          participant,
          publication,
          source: publication.source,
        };

        return trackRef;
      }
    }

    return undefined;
  }, [voiceAssistant.videoTrack, remoteParticipants, shouldExcludeTrack]);

  return {
    ...voiceAssistant,
    videoTrack: smartVideoTrack,
  };
}
