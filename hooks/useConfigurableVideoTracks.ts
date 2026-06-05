'use client';

import { useCallback, useEffect, useState } from 'react';
import { LocalVideoTrack, type RemoteVideoTrack } from 'livekit-client';
import { type TrackReference, useRoomContext } from '@livekit/components-react';
import type { AppConfig, VideoTrackConfig } from '@/app-config';
import {
  type UseRemoteVideoTracksReturn,
  createRemoteVideoTrackReference,
} from './useRemoteVideoTracks';
import { useVideoTrackFactory } from './useVideoTrackFactory';

function debugVideoLog(config: Pick<AppConfig, 'debugVideo'> | undefined, ...args: unknown[]) {
  if (config?.debugVideo) {
    console.log(...args);
  }
}

type TrackSelectionOrigin = 'auto' | 'user';

export function getInitialAvailableOption(
  options: VideoTrackOption[],
  defaultTrackId?: string | null
) {
  if (!defaultTrackId) {
    return options.find((option) => option.available);
  }

  const defaultOption = options.find((option) => option.id === defaultTrackId);
  if (defaultOption?.available) {
    return defaultOption;
  }

  return options.find((option) => option.available);
}

export function getAutoPromotedDefaultOption(
  options: VideoTrackOption[],
  currentTrackId: string | null,
  defaultTrackId?: string | null,
  selectionOrigin: TrackSelectionOrigin = 'auto'
) {
  if (
    selectionOrigin !== 'auto' ||
    !currentTrackId ||
    !defaultTrackId ||
    currentTrackId === defaultTrackId
  ) {
    return undefined;
  }

  const defaultOption = options.find((option) => option.id === defaultTrackId);
  return defaultOption?.available ? defaultOption : undefined;
}

export interface VideoTrackOption {
  id: string;
  label: string;
  type: VideoTrackConfig['type'];
  icon?: VideoTrackConfig['icon'];
  description?: string;
  config: VideoTrackConfig;
  available: boolean;
  track?: LocalVideoTrack | RemoteVideoTrack;
  trackReference?: TrackReference;
}

export type ConfigurableVideoTrackChange =
  | LocalVideoTrack
  | RemoteVideoTrack
  | TrackReference
  | null;

export interface UseConfigurableVideoTracksOptions {
  availableConfigs: VideoTrackConfig[];
  defaultTrackId?: string;
  existingLivekitTracks?: Map<string, LocalVideoTrack>; // 现有的LiveKit轨道
  remoteVideoTracksApi: Pick<UseRemoteVideoTracksReturn, 'subscribeToTrack' | 'getTrackByName'>;
  appConfig?: Pick<AppConfig, 'debugVideo'>;
  onTrackChange?: (trackId: string, track: ConfigurableVideoTrackChange) => void | Promise<void>;
  onError?: (error: Error) => void;
}

export interface UseConfigurableVideoTracksReturn {
  videoOptions: VideoTrackOption[];
  currentTrackId: string | null;
  currentTrack: LocalVideoTrack | RemoteVideoTrack | null;
  isLoading: boolean;
  error: string | null;
  switchToTrack: (trackId: string) => Promise<boolean>;
  selectTrack: (trackId: string | null) => void;
  getTrackById: (trackId: string) => VideoTrackOption | undefined;
  clearError: () => void;
}

export function useConfigurableVideoTracks({
  availableConfigs,
  defaultTrackId,
  existingLivekitTracks,
  remoteVideoTracksApi,
  appConfig,
  onTrackChange,
  onError,
}: UseConfigurableVideoTracksOptions): UseConfigurableVideoTracksReturn {
  const room = useRoomContext();
  const [videoOptions, setVideoOptions] = useState<VideoTrackOption[]>([]);
  const [currentTrackId, setCurrentTrackId] = useState<string | null>(null);
  const [selectionOrigin, setSelectionOrigin] = useState<TrackSelectionOrigin>('auto');
  const [currentTrack, setCurrentTrack] = useState<LocalVideoTrack | RemoteVideoTrack | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const trackFactory = useVideoTrackFactory();
  const { subscribeToTrack, getTrackByName } = remoteVideoTracksApi;

  // 初始化视频选项
  const initializeVideoOptions = useCallback(async () => {
    setIsLoading(true);

    const options: VideoTrackOption[] = [];

    for (const config of availableConfigs) {
      if (!config.enabled) continue;

      const option: VideoTrackOption = {
        id: config.id,
        label: config.label,
        type: config.type,
        icon: config.icon,
        description: config.description,
        config,
        available: false,
        track: undefined,
      };

      // 检查轨道是否可用
      try {
        if (config.type === 'system') {
          // 检查系统摄像头
          const devices = await navigator.mediaDevices.enumerateDevices();
          const hasCamera = devices.some((device) => device.kind === 'videoinput');
          option.available = hasCamera;
        } else if (config.type === 'livekit') {
          // 检查LiveKit轨道是否存在
          const trackKey = config.livekitTrackName || config.id;

          // 优先检查 existingLivekitTracks（用于本地轨道）
          if (existingLivekitTracks && existingLivekitTracks.has(trackKey)) {
            option.available = true;
          } else {
            // 检查远程轨道
            const remoteTrackInfo = getTrackByName(trackKey);
            option.available = !!remoteTrackInfo;
            debugVideoLog(
              appConfig,
              `[useConfigurableVideoTracks] LiveKit track "${trackKey}" ${option.available ? 'found' : 'not found'} in remote tracks`
            );
          }
        } else {
          option.available = false;
        }
      } catch (error) {
        console.warn(`Failed to check availability for track ${config.id}:`, error);
        option.available = false;
      }

      options.push(option);
    }

    setVideoOptions(options);
    setIsLoading(false);

    const nextAutoOption = currentTrackId
      ? getAutoPromotedDefaultOption(options, currentTrackId, defaultTrackId, selectionOrigin)
      : getInitialAvailableOption(options, defaultTrackId);

    if (nextAutoOption && nextAutoOption.id !== currentTrackId) {
      setCurrentTrackId(nextAutoOption.id);
      setSelectionOrigin('auto');
      debugVideoLog(appConfig, `Auto track selected: ${nextAutoOption.label} (not connected yet)`);
    }
  }, [
    appConfig,
    availableConfigs,
    currentTrackId,
    defaultTrackId,
    existingLivekitTracks,
    getTrackByName,
    selectionOrigin,
  ]);

  // 切换到指定轨道
  const switchToTrack = useCallback(
    async (trackId: string) => {
      debugVideoLog(appConfig, '[useConfigurableVideoTracks] switchToTrack called:', trackId);
      debugVideoLog(appConfig, '[useConfigurableVideoTracks] Current state:', {
        currentTrackId,
        videoOptionsCount: videoOptions.length,
        availableOptions: videoOptions.filter((opt) => opt.available).map((opt) => opt.id),
      });

      setIsLoading(true);
      setError(null); // 清除之前的错误

      try {
        const option = videoOptions.find((opt) => opt.id === trackId);
        if (!option) {
          const errorMsg = `视频轨道 "${trackId}" 不存在`;
          setError(errorMsg);
          debugVideoLog(appConfig, errorMsg);
          return false;
        }

        debugVideoLog(appConfig, '[useConfigurableVideoTracks] Found option:', {
          id: option.id,
          label: option.label,
          type: option.config.type,
          available: option.available,
        });

        // 先设置当前选中的轨道ID（即使连接可能失败）
        setCurrentTrackId(trackId);
        debugVideoLog(appConfig, '[useConfigurableVideoTracks] Set currentTrackId to:', trackId);

        const currentOption = currentTrackId
          ? videoOptions.find((opt) => opt.id === currentTrackId)
          : undefined;
        if (currentOption?.config.type === 'system') {
          stopLocalVideoTrack(currentTrack);
        }
        setCurrentTrack(null);

        let existingTrack: LocalVideoTrack | undefined;

        // 处理不同类型的轨道
        if (option.config.type === 'livekit') {
          const trackKey = option.config.livekitTrackName || option.config.id;

          // 优先使用本地轨道
          existingTrack = existingLivekitTracks?.get(trackKey);

          if (!existingTrack) {
            // 尝试订阅远程轨道
            const remoteTrackInfo = getTrackByName(trackKey);
            if (remoteTrackInfo) {
              debugVideoLog(
                appConfig,
                `[useConfigurableVideoTracks] Attempting to subscribe to remote track: ${trackKey}`
              );
              const subscribed = remoteTrackInfo.isSubscribed || (await subscribeToTrack(trackKey));
              if (!subscribed) {
                const errorMsg = `无法订阅LiveKit轨道 "${option.label}"，请检查轨道状态`;
                setError(errorMsg);
                debugVideoLog(appConfig, errorMsg);
                return false;
              }

              const latestTrackInfo = getTrackByName(trackKey) ?? remoteTrackInfo;
              if (latestTrackInfo.track) {
                debugVideoLog(
                  appConfig,
                  `[useConfigurableVideoTracks] Successfully subscribed to remote track: ${trackKey}`
                );

                const trackReference = createRemoteVideoTrackReference(room, latestTrackInfo);
                if (!trackReference) {
                  const errorMsg = `LiveKit轨道 "${option.label}" 所属参与者未找到`;
                  setError(errorMsg);
                  debugVideoLog(appConfig, errorMsg);
                  return false;
                }

                // 设置当前轨道（用于状态管理）
                setCurrentTrack(latestTrackInfo.track);

                // 更新选项中的轨道引用
                setVideoOptions((prev) =>
                  prev.map((opt) =>
                    opt.id === trackId
                      ? { ...opt, track: latestTrackInfo.track ?? undefined, trackReference }
                      : { ...opt, track: opt.id === currentTrackId ? undefined : opt.track }
                  )
                );

                debugVideoLog(appConfig, `Successfully connected to remote track: ${option.label}`);

                // 设置当前轨道ID
                setCurrentTrackId(trackId);

                // 对于远程轨道，传递 trackReference 给 onTrackChange
                await onTrackChange?.(trackId, trackReference);
                return true; // 直接返回，不需要继续创建轨道
              }

              debugVideoLog(
                appConfig,
                `[useConfigurableVideoTracks] Waiting for subscribed remote track media: ${trackKey}`
              );
              return false;
            } else {
              const errorMsg = `LiveKit轨道 "${option.label}" 未找到，请确保轨道已正确发布`;
              setError(errorMsg);
              debugVideoLog(appConfig, errorMsg);
              // 不要回退到其他轨道，保持当前选择但不连接
              return false;
            }
          }
        }

        // 对于系统摄像头，检查可用性
        if (option.config.type === 'system' && !option.available) {
          const errorMsg = `系统摄像头 "${option.label}" 当前不可用，请检查设备连接或权限`;
          setError(errorMsg);
          debugVideoLog(appConfig, errorMsg);
          return false;
        }

        const newTrack = await trackFactory.createTrackFromConfig(option.config, existingTrack);

        if (newTrack) {
          setCurrentTrack(newTrack);

          // 设置当前轨道ID
          setCurrentTrackId(trackId);

          // 更新选项中的轨道引用
          setVideoOptions((prev) =>
            prev.map((opt) =>
              opt.id === trackId
                ? { ...opt, track: newTrack }
                : { ...opt, track: opt.id === currentTrackId ? undefined : opt.track }
            )
          );

          debugVideoLog(appConfig, `Successfully connected to track: ${option.label}`);
          await onTrackChange?.(trackId, newTrack);
          return true;
        } else {
          const errorMsg = `无法创建视频轨道 "${option.label}"，请检查设备或权限`;
          setError(errorMsg);
          debugVideoLog(appConfig, errorMsg);
          // 保持选择但不连接轨道
          return false;
        }
      } catch (error) {
        const errorMsg = `连接视频轨道时发生错误: ${(error as Error).message}`;
        setError(errorMsg);
        console.error('Error connecting video track:', error);
        // 保持选择但不连接轨道
        onError?.(error as Error);
        return false;
      } finally {
        setIsLoading(false);
      }
    },
    [
      videoOptions,
      appConfig,
      currentTrack,
      currentTrackId,
      trackFactory,
      existingLivekitTracks,
      onTrackChange,
      onError,
      room,
      subscribeToTrack,
      getTrackByName,
    ]
  );

  const selectTrack = useCallback((trackId: string | null) => {
    setCurrentTrackId(trackId);
    setSelectionOrigin(trackId ? 'user' : 'auto');
    setError(null);
  }, []);

  // 刷新轨道列表
  // 移除刷新功能 - 视频轨道列表在初始化时确定

  // 根据ID获取轨道选项
  const getTrackById = useCallback(
    (trackId: string) => {
      return videoOptions.find((opt) => opt.id === trackId);
    },
    [videoOptions]
  );

  // 清除错误
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  // 初始化
  useEffect(() => {
    initializeVideoOptions();
  }, [initializeVideoOptions]);

  return {
    videoOptions,
    currentTrackId,
    currentTrack,
    isLoading,
    error,
    switchToTrack,
    selectTrack,
    getTrackById,
    clearError,
  };
}

function stopLocalVideoTrack(track: LocalVideoTrack | RemoteVideoTrack | null) {
  if (track instanceof LocalVideoTrack) {
    track.stop();
  }
}
