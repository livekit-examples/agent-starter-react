'use client';

import { useMemo } from 'react';
import { VideoTrackConfig } from '@/app-config';

export interface UseExcludedVideoTracksOptions {
  videoTrackConfigs?: VideoTrackConfig[];
}

export interface UseExcludedVideoTracksReturn {
  excludedTrackNames: string[];
  shouldExcludeTrack: (trackName: string) => boolean;
}

/**
 * Hook to manage excluded video track names from configuration
 * 管理需要从头像视频中排除的轨道名称
 */
export function useExcludedVideoTracks({
  videoTrackConfigs = [],
}: UseExcludedVideoTracksOptions = {}): UseExcludedVideoTracksReturn {
  // 提取所有配置的LiveKit轨道名称
  const excludedTrackNames = useMemo(() => {
    const trackNames: string[] = [];

    videoTrackConfigs.forEach((config) => {
      if (config.type === 'livekit' && config.enabled) {
        // 使用 livekitTrackName 或 id 作为轨道名称
        const trackName = config.livekitTrackName || config.id;
        trackNames.push(trackName);
      }
    });

    return trackNames;
  }, [videoTrackConfigs]);

  // 检查轨道是否应该被排除
  const shouldExcludeTrack = useMemo(() => {
    return (trackName: string): boolean => {
      return excludedTrackNames.some((excludeName) => {
        if (!excludeName) {
          return false;
        }
        return trackName.includes(excludeName) || excludeName.includes(trackName);
      });
    };
  }, [excludedTrackNames]);

  return {
    excludedTrackNames,
    shouldExcludeTrack,
  };
}
