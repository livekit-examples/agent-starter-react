'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { LocalVideoTrack, Track } from 'livekit-client';
import { type TrackReference, useLocalParticipant } from '@livekit/components-react';
import { BroadcastIcon, CameraIcon, WarningIcon, XIcon } from '@phosphor-icons/react/dist/ssr';
import type { AppConfig, VideoTrackConfig } from '@/app-config';
import { TrackToggle } from '@/components/livekit/agent-control-bar/track-toggle';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/livekit/select';
import {
  type ConfigurableVideoTrackChange,
  useConfigurableVideoTracks,
} from '@/hooks/useConfigurableVideoTracks';
import { useRemoteVideoTracks } from '@/hooks/useRemoteVideoTracks';
import { useSelectedVideoTrack } from '@/hooks/useSelectedVideoTrack';
import { cn } from '@/lib/utils';

function debugVideoLog(config: Pick<AppConfig, 'debugVideo'> | undefined, ...args: unknown[]) {
  if (config?.debugVideo) {
    console.log(...args);
  }
}

export function shouldDeferAutoPreviewRetry(
  pendingTrackId: string | null,
  requestedTrackId: string | null | undefined,
  previewReady: boolean
) {
  return Boolean(requestedTrackId && pendingTrackId === requestedTrackId && !previewReady);
}

export function shouldClearPendingAutoPreviewRetry(
  pendingTrackId: string | null,
  requestedTrackId: string | null | undefined,
  previewAvailable: boolean
) {
  return Boolean(requestedTrackId && pendingTrackId === requestedTrackId && !previewAvailable);
}

interface ConfigurableVideoSelectorProps {
  availableConfigs: VideoTrackConfig[];
  defaultTrackId?: string;
  existingLivekitTracks?: Map<string, LocalVideoTrack>;
  pressed?: boolean;
  pending?: boolean;
  disabled?: boolean;
  mediaEnabled?: boolean;
  mediaPending?: boolean;
  autoPreviewLivekitTracks?: boolean;
  appConfig?: Pick<
    AppConfig,
    'debugVideo' | 'remoteVideoWidth' | 'remoteVideoHeight' | 'remoteVideoFps'
  >;
  className?: string;
  onPressedChange?: (pressed: boolean) => void;
  onMediaEnabledChange?: (enabled: boolean) => Promise<void> | void;
  onMediaDeviceError?: (error: Error) => void;
  onTrackChange?: (trackId: string, track: ConfigurableVideoTrackChange) => void;
}

export function ConfigurableVideoSelector({
  availableConfigs,
  defaultTrackId,
  existingLivekitTracks,
  pressed,
  pending,
  disabled,
  mediaEnabled,
  mediaPending,
  autoPreviewLivekitTracks = true,
  appConfig,
  className,
  onPressedChange,
  onMediaEnabledChange,
  onMediaDeviceError,
  onTrackChange,
}: ConfigurableVideoSelectorProps) {
  const { localParticipant } = useLocalParticipant();
  const {
    setSelectedTrack,
    clearSelectedTrack,
    trackId: selectedContextTrackId,
  } = useSelectedVideoTrack();
  const remoteVideoTracksApi = useRemoteVideoTracks(appConfig);
  const { getTrackByName } = remoteVideoTracksApi;

  const [isSystemCameraEnabled, setIsSystemCameraEnabled] = useState(false);
  const [isTrackPreviewEnabled, setIsTrackPreviewEnabled] = useState(false);
  const previewedTrackIdRef = useRef<string | null>(null);
  const pendingAutoPreviewTrackIdRef = useRef<string | null>(null);
  const autoPreviewDisabledRef = useRef(false);
  const isMediaExternallyControlled =
    mediaEnabled !== undefined || onMediaEnabledChange !== undefined;

  const getLocalTrackReference = useCallback(
    (trackName: string): TrackReference | null => {
      const publications = Array.from(localParticipant.videoTrackPublications.values());
      const publication = publications.find(
        (item) => (item.trackName || item.trackSid) === trackName
      );

      if (!publication || publication.isMuted || !publication.track) {
        return null;
      }

      return {
        participant: localParticipant,
        source: publication.source,
        publication,
      };
    },
    [localParticipant]
  );

  const {
    videoOptions,
    currentTrackId: selectedTrackId,
    currentTrack,
    isLoading,
    error,
    switchToTrack,
    selectTrack,
    getTrackById,
    clearError,
  } = useConfigurableVideoTracks({
    availableConfigs,
    defaultTrackId,
    existingLivekitTracks,
    remoteVideoTracksApi,
    appConfig,
    onTrackChange: async (trackId, trackOrTrackRef) => {
      debugVideoLog(
        appConfig,
        '[ConfigurableVideoSelector] Track changed:',
        trackId,
        trackOrTrackRef
      );
      debugVideoLog(
        appConfig,
        '[ConfigurableVideoSelector] TrackOrTrackRef type:',
        typeof trackOrTrackRef
      );
      debugVideoLog(
        appConfig,
        '[ConfigurableVideoSelector] TrackOrTrackRef keys:',
        trackOrTrackRef ? Object.keys(trackOrTrackRef) : 'null'
      );

      const option = getTrackById(trackId);
      if (!option) {
        debugVideoLog(
          appConfig,
          '[ConfigurableVideoSelector] No option found for trackId:',
          trackId
        );
        return;
      }

      debugVideoLog(appConfig, '[ConfigurableVideoSelector] Processing track:', {
        trackId,
        type: option.config.type,
        label: option.label,
      });

      try {
        if (option.config.type === 'system' && trackOrTrackRef instanceof LocalVideoTrack) {
          // 系统摄像头：发布本地轨道
          debugVideoLog(appConfig, '[ConfigurableVideoSelector] Enabling system camera');

          const currentCameraTrack = localParticipant.getTrackPublication(Track.Source.Camera);
          if (currentCameraTrack?.track) {
            await localParticipant.unpublishTrack(currentCameraTrack.track);
          }

          await localParticipant.publishTrack(trackOrTrackRef, {
            source: Track.Source.Camera,
            name: trackId,
          });

          // 设置预览轨道
          const cameraPublication = localParticipant.getTrackPublication(Track.Source.Camera);
          if (!cameraPublication) {
            throw new Error('系统摄像头发布失败');
          }
          const trackRef: TrackReference = {
            participant: localParticipant,
            source: Track.Source.Camera,
            publication: cameraPublication,
          };
          setSelectedTrack(trackId, trackRef);
          setIsSystemCameraEnabled(true);
        } else if (option.config.type === 'livekit' && trackOrTrackRef) {
          // 远程轨道：直接使用远程轨道，不取消发布本地轨道
          debugVideoLog(
            appConfig,
            '[ConfigurableVideoSelector] Processing livekit track:',
            trackId
          );
          debugVideoLog(appConfig, '[ConfigurableVideoSelector] TrackOrTrackRef details:', {
            hasParticipant: 'participant' in trackOrTrackRef,
            hasPublication: 'publication' in trackOrTrackRef,
            hasSource: 'source' in trackOrTrackRef,
            keys: Object.keys(trackOrTrackRef),
          });

          debugVideoLog(
            appConfig,
            '[ConfigurableVideoSelector] Setting selected track for livekit:',
            trackId
          );
          if (isTrackReference(trackOrTrackRef)) {
            setSelectedTrack(trackId, trackOrTrackRef);
          } else {
            const trackKey = option.config.livekitTrackName || option.config.id;
            const localTrackReference = getLocalTrackReference(trackKey);
            setSelectedTrack(trackId, localTrackReference);
          }
          setIsTrackPreviewEnabled(true);

          debugVideoLog(
            appConfig,
            '[ConfigurableVideoSelector] Livekit track enabled, selectedTrack set:',
            trackId
          );
        } else {
          debugVideoLog(
            appConfig,
            '[ConfigurableVideoSelector] Track type not handled:',
            option.config.type
          );
        }

        onTrackChange?.(trackId, trackOrTrackRef);
      } catch (err) {
        console.error('[ConfigurableVideoSelector] Failed to handle track change:', err);
        throw err;
      }
    },
    onError: onMediaDeviceError,
  });
  const selectedOption =
    (selectedTrackId ? getTrackById(selectedTrackId) : undefined) ||
    (defaultTrackId ? getTrackById(defaultTrackId) : undefined);
  const getPreviewTrackId = useCallback(
    (trackIdOverride?: string | null) => {
      const preferredTrackIds = [trackIdOverride, selectedTrackId, defaultTrackId];

      for (const trackId of preferredTrackIds) {
        if (!trackId) {
          continue;
        }

        const option = getTrackById(trackId);
        if (option?.available) {
          return option.id;
        }
      }

      return videoOptions.find((option) => option.available)?.id ?? null;
    },
    [defaultTrackId, getTrackById, selectedTrackId, videoOptions]
  );
  const effectivePressed =
    mediaEnabled !== undefined
      ? !!mediaEnabled
      : selectedOption?.config.type === 'system'
        ? !!pressed || isSystemCameraEnabled
        : isTrackPreviewEnabled;
  const isLivekitPreviewReady = useCallback(
    (trackId: string) => {
      const option = getTrackById(trackId);
      if (option?.config.type !== 'livekit' || !option.available) {
        return false;
      }

      const trackKey = option.config.livekitTrackName || option.config.id;
      if (existingLivekitTracks?.has(trackKey) || getLocalTrackReference(trackKey)) {
        return true;
      }

      return Boolean(getTrackByName(trackKey)?.track);
    },
    [existingLivekitTracks, getLocalTrackReference, getTrackById, getTrackByName]
  );

  // 清理所有资源
  const cleanupAllResources = useCallback(
    async (resetAutoPreview = true) => {
      debugVideoLog(
        appConfig,
        '[ConfigurableVideoSelector] Complete cleanup - no state dependency'
      );

      // 完全清理所有资源，不区分轨道类型
      if (!isMediaExternallyControlled) {
        const currentCameraTrack = localParticipant.getTrackPublication(Track.Source.Camera);
        if (currentCameraTrack?.track) {
          await localParticipant.unpublishTrack(currentCameraTrack.track);
        }
      }
      if (currentTrack instanceof LocalVideoTrack && !isMediaExternallyControlled) {
        currentTrack.stop();
      }
      clearSelectedTrack({ disablePreview: !resetAutoPreview });
      setIsSystemCameraEnabled(false);
      setIsTrackPreviewEnabled(false);
      if (resetAutoPreview) {
        previewedTrackIdRef.current = null;
        pendingAutoPreviewTrackIdRef.current = null;
        autoPreviewDisabledRef.current = false;
      }
    },
    [appConfig, isMediaExternallyControlled, localParticipant, currentTrack, clearSelectedTrack]
  );

  const enableTrackPreview = useCallback(
    async (trackId: string) => {
      const option = getTrackById(trackId);
      if (!option) {
        return false;
      }

      debugVideoLog(appConfig, '[ConfigurableVideoSelector] Enabling track preview:', trackId);
      if (option.config.type === 'system' || isSystemCameraEnabled) {
        await cleanupAllResources();
      }

      const connected = await switchToTrack(trackId);
      if (!connected) {
        return false;
      }

      if (option.config.type === 'system') {
        setIsSystemCameraEnabled(true);
        setIsTrackPreviewEnabled(false);
        onPressedChange?.(true);
      } else {
        setIsSystemCameraEnabled(false);
        setIsTrackPreviewEnabled(true);
      }
      previewedTrackIdRef.current = trackId;

      return true;
    },
    [
      appConfig,
      cleanupAllResources,
      getTrackById,
      isSystemCameraEnabled,
      onPressedChange,
      switchToTrack,
    ]
  );

  const disableTrackPreview = useCallback(async () => {
    debugVideoLog(appConfig, '[ConfigurableVideoSelector] Disabling track preview');
    previewedTrackIdRef.current = null;
    pendingAutoPreviewTrackIdRef.current = null;
    autoPreviewDisabledRef.current = true;
    await cleanupAllResources(false);
    onPressedChange?.(false);
  }, [appConfig, cleanupAllResources, onPressedChange]);

  // 指定轨道预览开关逻辑
  const handleTrackPreviewToggle = useCallback(
    async (enabled?: boolean, trackIdOverride?: string) => {
      const shouldEnable = enabled !== undefined ? enabled : !isTrackPreviewEnabled;
      const trackToUse = getPreviewTrackId(trackIdOverride);

      if (shouldEnable) {
        if (trackToUse) {
          await enableTrackPreview(trackToUse);
        }
      } else {
        await disableTrackPreview();
      }
    },
    [isTrackPreviewEnabled, getPreviewTrackId, enableTrackPreview, disableTrackPreview]
  );

  // 统一的摄像头开关逻辑
  const handleToggleVideo = useCallback(
    async (enabled?: boolean) => {
      const shouldEnable = enabled !== undefined ? enabled : !effectivePressed;
      debugVideoLog(appConfig, '[ConfigurableVideoSelector] Toggle video requested:', {
        enabled,
        effectivePressed,
        shouldEnable,
      });
      await onMediaEnabledChange?.(shouldEnable);

      if (shouldEnable) {
        previewedTrackIdRef.current = null;
        pendingAutoPreviewTrackIdRef.current = null;
        autoPreviewDisabledRef.current = false;
        if (isMediaExternallyControlled && !autoPreviewLivekitTracks) {
          clearSelectedTrack();
          return;
        }

        // 根据选择的轨道类型决定启用哪种预览
        const trackToUse = selectedTrackId || defaultTrackId;
        if (trackToUse) {
          await handleTrackPreviewToggle(true);
        }
      } else {
        await disableTrackPreview();
      }
    },
    [
      effectivePressed,
      selectedTrackId,
      defaultTrackId,
      handleTrackPreviewToggle,
      disableTrackPreview,
      onMediaEnabledChange,
      isMediaExternallyControlled,
      autoPreviewLivekitTracks,
      clearSelectedTrack,
      appConfig,
    ]
  );

  // 轨道切换逻辑
  const handleTrackChange = useCallback(
    async (trackId: string) => {
      debugVideoLog(appConfig, '[ConfigurableVideoSelector] Switching to track:', trackId);

      selectTrack(trackId);

      // 如果当前摄像头是开启状态，立即启用新轨道
      if (effectivePressed) {
        await handleTrackPreviewToggle(true, trackId);
      }
    },
    [appConfig, effectivePressed, handleTrackPreviewToggle, selectTrack]
  );

  // LiveKit 输入轨道来自 room 中的输入 participant，不需要用户再次手动打开本机摄像头。
  // 当默认远程轨道已经订阅成功时，自动把它选为预览轨道。
  useEffect(() => {
    const trackToUse = selectedTrackId || defaultTrackId;
    const option = trackToUse ? getTrackById(trackToUse) : undefined;
    const canPreviewTrack = option?.config.type === 'livekit' && option.available;
    const previewReady = trackToUse && canPreviewTrack ? isLivekitPreviewReady(trackToUse) : false;

    if (
      shouldClearPendingAutoPreviewRetry(
        pendingAutoPreviewTrackIdRef.current,
        trackToUse,
        Boolean(canPreviewTrack)
      )
    ) {
      pendingAutoPreviewTrackIdRef.current = null;
      previewedTrackIdRef.current = null;
    }

    if (
      !autoPreviewLivekitTracks ||
      disabled ||
      isLoading ||
      autoPreviewDisabledRef.current ||
      shouldDeferAutoPreviewRetry(pendingAutoPreviewTrackIdRef.current, trackToUse, previewReady) ||
      (isTrackPreviewEnabled && previewedTrackIdRef.current === trackToUse) ||
      (isMediaExternallyControlled && !mediaEnabled)
    ) {
      return;
    }

    if (!trackToUse) {
      return;
    }

    if (!canPreviewTrack) {
      return;
    }

    previewedTrackIdRef.current = trackToUse;
    pendingAutoPreviewTrackIdRef.current = trackToUse;
    void enableTrackPreview(trackToUse)
      .then((connected) => {
        previewedTrackIdRef.current = connected ? trackToUse : null;
        pendingAutoPreviewTrackIdRef.current = connected ? null : trackToUse;
      })
      .catch((err) => {
        previewedTrackIdRef.current = null;
        pendingAutoPreviewTrackIdRef.current = null;
        onMediaDeviceError?.(err as Error);
      });
  }, [
    disabled,
    isLoading,
    isTrackPreviewEnabled,
    selectedTrackId,
    defaultTrackId,
    getTrackById,
    enableTrackPreview,
    isLivekitPreviewReady,
    onMediaDeviceError,
    isMediaExternallyControlled,
    mediaEnabled,
    autoPreviewLivekitTracks,
  ]);

  // 房间切换后，旧的远程 TrackReference 可能已经失效。
  // 一旦当前选中的 livekit 轨道在房间里消失，立即清掉旧引用，避免继续渲染已失效对象。
  useEffect(() => {
    if (!selectedTrackId) {
      return;
    }

    const option = getTrackById(selectedTrackId);
    if (option?.config.type !== 'livekit') {
      return;
    }

    const trackKey = option.config.livekitTrackName || option.config.id;
    const localTrackReference = getLocalTrackReference(trackKey);
    if (localTrackReference) {
      return;
    }

    const remoteTrackInfo = getTrackByName(trackKey);
    if (remoteTrackInfo) {
      return;
    }

    if (selectedContextTrackId === selectedTrackId) {
      debugVideoLog(
        appConfig,
        '[ConfigurableVideoSelector] Selected livekit track disappeared, clearing stale track reference:',
        trackKey
      );
      clearSelectedTrack();
      setIsTrackPreviewEnabled(false);
      previewedTrackIdRef.current = null;
      pendingAutoPreviewTrackIdRef.current = null;
      autoPreviewDisabledRef.current = false;
    }
  }, [
    selectedTrackId,
    selectedContextTrackId,
    getTrackById,
    getTrackByName,
    getLocalTrackReference,
    clearSelectedTrack,
    appConfig,
  ]);

  // 获取可用的轨道选项
  const availableOptions = videoOptions.filter((opt) => opt.available);
  const hasLocalSystemCameraConfig = availableConfigs.some(
    (config) => config.enabled && config.type === 'system'
  );

  // 如果没有可用选项，显示基础切换按钮
  if (availableOptions.length === 0) {
    return (
      <TrackToggle
        size="icon"
        variant="primary"
        source={Track.Source.Camera}
        pressed={effectivePressed}
        pending={pending || mediaPending || isLoading}
        disabled={
          disabled ||
          mediaPending ||
          isLoading ||
          (!hasLocalSystemCameraConfig && !isMediaExternallyControlled)
        }
        onPressedChange={
          isMediaExternallyControlled
            ? handleToggleVideo
            : hasLocalSystemCameraConfig
              ? onPressedChange
              : undefined
        }
        className={className}
      />
    );
  }

  return (
    <div className={cn('flex flex-col gap-1', className)}>
      <div className="flex items-center gap-0">
        <TrackToggle
          size="icon"
          variant="primary"
          source={Track.Source.Camera}
          pressed={effectivePressed}
          pending={pending || mediaPending || isLoading}
          disabled={disabled || mediaPending || isLoading}
          onPressedChange={handleToggleVideo}
          className="peer/track group/track has-[~_div]:rounded-r-none has-[~_div]:pr-2 has-[~_div]:pl-3"
        />

        <hr className="bg-border peer-data-[state=off]/track:bg-destructive/20 relative z-10 -mr-px hidden h-4 w-px border-none has-[~_div]:block" />

        <div className="flex items-center">
          <Select
            value={selectedTrackId || ''}
            onValueChange={handleTrackChange}
            disabled={disabled || isLoading}
          >
            <SelectTrigger
              className={cn(
                'h-10 w-auto min-w-[140px] rounded-l-none border-none bg-transparent pl-2 text-sm',
                'peer-data-[state=off]/track:text-destructive',
                'hover:text-foreground focus:text-foreground',
                'hover:peer-data-[state=off]/track:text-foreground',
                'focus:peer-data-[state=off]/track:text-destructive',
                error && 'border-destructive'
              )}
            >
              <SelectValue placeholder="选择视频源...">
                {selectedTrackId &&
                  (() => {
                    const currentOption = availableOptions.find(
                      (opt) => opt.id === selectedTrackId
                    );
                    return currentOption ? (
                      <div className="flex items-center gap-2">
                        <VideoTrackOptionIcon icon={currentOption.icon} />
                        <span>{currentOption.label}</span>
                      </div>
                    ) : (
                      '选择视频源...'
                    );
                  })()}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {availableOptions.map((option) => (
                <SelectItem key={option.id} value={option.id}>
                  <div className="flex items-center gap-2">
                    <VideoTrackOptionIcon icon={option.icon} />
                    <div className="flex flex-col">
                      <span>{option.label}</span>
                      {option.description && (
                        <span className="text-muted-foreground text-xs">{option.description}</span>
                      )}
                    </div>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* 错误消息显示 */}
      {error && (
        <div className="text-destructive bg-destructive/10 border-destructive/20 flex items-center gap-2 rounded border px-2 py-1 text-xs">
          <WarningIcon size={14} weight="bold" />
          <span className="flex-1">{error}</span>
          <button
            onClick={clearError}
            className="text-destructive hover:text-destructive/80 ml-1"
            title="关闭错误消息"
          >
            <XIcon size={12} weight="bold" />
          </button>
        </div>
      )}
    </div>
  );
}

function isTrackReference(value: ConfigurableVideoTrackChange): value is TrackReference {
  return (
    !!value &&
    typeof value === 'object' &&
    'participant' in value &&
    'publication' in value &&
    'source' in value
  );
}

function VideoTrackOptionIcon({ icon }: { icon: VideoTrackConfig['icon'] }) {
  if (icon === 'camera') {
    return <CameraIcon size={16} weight="bold" />;
  }
  if (icon === 'broadcast') {
    return <BroadcastIcon size={16} weight="bold" />;
  }
  return null;
}
