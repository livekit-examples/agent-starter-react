import { useCallback } from 'react';
import { LocalVideoTrack, createLocalVideoTrack } from 'livekit-client';
import { VideoTrackConfig } from '@/app-config';

export interface UseVideoTrackFactoryReturn {
  createTrackFromConfig: (
    config: VideoTrackConfig,
    existingTrack?: LocalVideoTrack
  ) => Promise<LocalVideoTrack | null>;
  createSystemCameraTrack: (deviceId?: string) => Promise<LocalVideoTrack | null>;
  createLivekitTrack: (existingTrack?: LocalVideoTrack) => Promise<LocalVideoTrack | null>;
}

export function useVideoTrackFactory(): UseVideoTrackFactoryReturn {
  // 创建系统摄像头轨道
  const createSystemCameraTrack = useCallback(
    async (deviceId?: string): Promise<LocalVideoTrack | null> => {
      try {
        const options: Parameters<typeof createLocalVideoTrack>[0] = {};

        if (deviceId) {
          options.deviceId = deviceId;
        } else {
          options.facingMode = 'user';
        }

        const track = await createLocalVideoTrack(options);
        return track;
      } catch (error) {
        console.error('Failed to create system camera track:', error);
        return null;
      }
    },
    []
  );

  // 创建LiveKit轨道（使用现有轨道或克隆）
  const createLivekitTrack = useCallback(
    async (existingTrack?: LocalVideoTrack): Promise<LocalVideoTrack | null> => {
      try {
        if (existingTrack) {
          // 返回现有轨道
          return existingTrack;
        }

        // 如果没有提供现有轨道，尝试创建一个新的轨道
        // 这里可以根据需要实现轨道查找逻辑
        console.warn('No existing LiveKit track provided and track creation not implemented');
        return null;
      } catch (error) {
        console.error('Failed to create LiveKit track:', error);
        return null;
      }
    },
    []
  );

  // 根据配置创建视频轨道
  const createTrackFromConfig = useCallback(
    async (
      config: VideoTrackConfig,
      existingTrack?: LocalVideoTrack
    ): Promise<LocalVideoTrack | null> => {
      if (!config.enabled) {
        return null;
      }

      try {
        switch (config.type) {
          case 'system':
            return await createSystemCameraTrack();

          case 'livekit':
            return await createLivekitTrack(existingTrack);

          default:
            console.warn(`Unknown video track type: ${config.type}`);
        }
      } catch (error) {
        console.error(`Failed to create video track for config ${config.id}:`, error);
      }

      return null;
    },
    [createLivekitTrack, createSystemCameraTrack]
  );

  return {
    createTrackFromConfig,
    createSystemCameraTrack,
    createLivekitTrack,
  };
}
