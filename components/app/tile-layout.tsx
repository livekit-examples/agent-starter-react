import React, { useMemo } from 'react';
import { Track } from 'livekit-client';
import { AnimatePresence, motion } from 'motion/react';
import {
  BarVisualizer,
  type TrackReference,
  VideoTrack,
  useLocalParticipant,
  useTracks,
} from '@livekit/components-react';
import { APP_CONFIG_DEFAULTS, type VideoTrackConfig } from '@/app-config';
import { useSelectedVideoTrack } from '@/hooks/useSelectedVideoTrack';
import { useSmartVoiceAssistant } from '@/hooks/useSmartVoiceAssistant';
import { cn } from '@/lib/utils';

function debugVideoLog(enabled: boolean | undefined, ...args: unknown[]) {
  if (enabled) {
    console.log(...args);
  }
}

const MotionContainer = motion.create('div');

const ANIMATION_TRANSITION = {
  type: 'spring',
  stiffness: 675,
  damping: 75,
  mass: 1,
};
const COMPACT_TILE_HEIGHT = 270;
const COMPACT_AGENT_TILE_WIDTH = 360;
const COMPACT_AGENT_TILE_CLASS = 'aspect-[4/3] w-[360px] max-w-[calc(100vw-32px)]';
const DEFAULT_CAMERA_TILE_WIDTH = 360;
const DEFAULT_SCREEN_SHARE_TILE_WIDTH = 480;
const MIN_SECOND_TILE_WIDTH = 270;
const MAX_SECOND_TILE_WIDTH = 480;
const GRID_GAP_PX = 8;

function resolveSecondTileWidth(trackRef: TrackReference | undefined, fallbackWidth: number) {
  const width = trackRef?.publication.dimensions?.width ?? 0;
  const height = trackRef?.publication.dimensions?.height ?? 0;
  if (width <= 0 || height <= 0) {
    return fallbackWidth;
  }

  return Math.round(
    Math.min(
      MAX_SECOND_TILE_WIDTH,
      Math.max(MIN_SECOND_TILE_WIDTH, COMPACT_TILE_HEIGHT * (width / height))
    )
  );
}

function isUsableCameraTrack(trackRef: TrackReference, allowedTrackNames: ReadonlySet<string>) {
  const publication = trackRef.publication;
  const trackName = publication.trackName || publication.trackSid;

  return (
    !!trackName &&
    allowedTrackNames.has(trackName) &&
    publication.isSubscribed &&
    !!publication.track &&
    !publication.isMuted
  );
}

const classNames = {
  // GRID
  // 2 Columns x 3 Rows
  grid: ['h-full w-full', 'grid gap-x-2 place-content-center', 'grid-rows-[270px_1fr_270px]'],
  gridDefault: ['grid-cols-[1fr_1fr]'],
  // Agent
  // chatOpen: true,
  // hasSecondTile: true
  // layout: Column 1 / Row 1
  // align: x-end y-center
  agentChatOpenWithSecondTile: ['col-start-1 row-start-1', 'self-center justify-self-end'],
  // Agent
  // chatOpen: true,
  // hasSecondTile: false
  // layout: Column 1 / Row 1 / Column-Span 2
  // align: x-center y-center
  agentChatOpenWithoutSecondTile: ['col-start-1 row-start-1', 'col-span-2', 'place-content-center'],
  // Agent
  // chatOpen: false
  // layout: Column 1 / Row 1 / Column-Span 2 / Row-Span 3
  // align: x-center y-center
  agentChatClosed: ['col-start-1 row-start-1', 'col-span-2 row-span-3', 'place-content-center'],
  // Second tile
  // chatOpen: true,
  // hasSecondTile: true
  // layout: Column 2 / Row 1
  // align: x-start y-center
  secondTileChatOpen: ['col-start-2 row-start-1', 'self-center justify-self-start'],
  // Second tile
  // chatOpen: false,
  // hasSecondTile: false
  // layout: Column 2 / Row 2
  // align: x-end y-end
  secondTileChatClosed: ['col-start-2 row-start-3', 'place-content-end'],
};

export function useLocalTrackRef(source: Track.Source) {
  const { localParticipant } = useLocalParticipant();
  const publication = localParticipant.getTrackPublication(source);
  const trackRef = useMemo<TrackReference | undefined>(
    () => (publication ? { source, participant: localParticipant, publication } : undefined),
    [source, publication, localParticipant]
  );
  return trackRef;
}

interface TileLayoutProps {
  chatOpen: boolean;
  videoTrackConfigs?: VideoTrackConfig[];
  defaultVideoTrackId?: string;
  showDefaultCameraPreview?: boolean;
  debugVideo?: boolean;
}

export function TileLayout({
  chatOpen,
  videoTrackConfigs = APP_CONFIG_DEFAULTS.availableVideoTracks,
  defaultVideoTrackId = APP_CONFIG_DEFAULTS.defaultVideoTrack,
  showDefaultCameraPreview = APP_CONFIG_DEFAULTS.showDefaultCameraPreview ?? true,
  debugVideo = APP_CONFIG_DEFAULTS.debugVideo,
}: TileLayoutProps) {
  const {
    state: agentState,
    audioTrack: agentAudioTrack,
    videoTrack: agentVideoTrack,
  } = useSmartVoiceAssistant({
    videoTrackConfigs,
  });
  const [screenShareTrack] = useTracks([Track.Source.ScreenShare]);
  const cameraTracks = useTracks([Track.Source.Camera]);
  const defaultCameraTrack: TrackReference | undefined = useLocalTrackRef(Track.Source.Camera);

  // 获取选中的视频轨道（可能是远程轨道）
  const {
    trackReference: selectedTrack,
    trackId: selectedTrackId,
    isPreviewDisabled,
  } = useSelectedVideoTrack();

  const configuredLivekitTrackNames = useMemo(() => {
    return new Set(
      videoTrackConfigs
        .filter((config) => config.enabled && config.type === 'livekit')
        .map((config) => config.livekitTrackName || config.id)
    );
  }, [videoTrackConfigs]);

  const configuredCameraTrack = useMemo<TrackReference | undefined>(() => {
    if (configuredLivekitTrackNames.size === 0) return undefined;

    const trackNameById = new Map(
      videoTrackConfigs
        .filter((config) => config.enabled && config.type === 'livekit')
        .map((config) => [config.id, config.livekitTrackName || config.id])
    );
    const preferredTrackNames = [selectedTrackId, defaultVideoTrackId]
      .map((trackId) => (trackId ? trackNameById.get(trackId) : undefined))
      .filter((trackName): trackName is string => !!trackName);

    for (const preferredTrackName of preferredTrackNames) {
      const preferredTrack = cameraTracks.find((trackRef) =>
        isUsableCameraTrack(trackRef, new Set([preferredTrackName]))
      );
      if (preferredTrack) {
        return preferredTrack;
      }
    }

    return cameraTracks.find((trackRef) =>
      isUsableCameraTrack(trackRef, configuredLivekitTrackNames)
    );
  }, [
    cameraTracks,
    configuredLivekitTrackNames,
    defaultVideoTrackId,
    selectedTrackId,
    videoTrackConfigs,
  ]);

  const canShowDefaultCameraPreview = showDefaultCameraPreview && !isPreviewDisabled;
  const cameraTrack =
    selectedTrack ||
    (canShowDefaultCameraPreview && selectedTrackId === null ? configuredCameraTrack : undefined) ||
    (canShowDefaultCameraPreview ? defaultCameraTrack : undefined);

  const isCameraEnabled = Boolean(cameraTrack?.publication && !cameraTrack.publication.isMuted);
  const isScreenShareEnabled = Boolean(screenShareTrack && !screenShareTrack.publication.isMuted);
  const secondTileTrack = isCameraEnabled
    ? cameraTrack
    : isScreenShareEnabled
      ? screenShareTrack
      : undefined;
  const isSecondTileScreenShare = !isCameraEnabled && isScreenShareEnabled;
  const secondTileWidth = resolveSecondTileWidth(
    secondTileTrack,
    isSecondTileScreenShare ? DEFAULT_SCREEN_SHARE_TILE_WIDTH : DEFAULT_CAMERA_TILE_WIDTH
  );
  const hasSecondTile = Boolean(isCameraEnabled || isScreenShareEnabled);
  const compactGridMaxWidth = COMPACT_AGENT_TILE_WIDTH + secondTileWidth + GRID_GAP_PX;

  const useCompactAgentTile = chatOpen || hasSecondTile;
  const animationDelay = useCompactAgentTile ? 0 : 0.15;
  const isAvatar = agentVideoTrack !== undefined;
  const videoWidth = agentVideoTrack?.publication.dimensions?.width ?? 0;
  const videoHeight = agentVideoTrack?.publication.dimensions?.height ?? 0;

  // 调试日志
  debugVideoLog(debugVideo, '[TileLayout] Camera track:', {
    selectedTrack: selectedTrack ? selectedTrack.publication?.trackName : null,
    cameraTrack: cameraTrack ? cameraTrack.publication?.trackName : null,
    isPreviewDisabled,
    isCameraEnabled,
    hasPublication: !!cameraTrack?.publication,
    isMuted: cameraTrack?.publication?.isMuted,
  });

  return (
    <div className="pointer-events-none fixed inset-x-0 top-8 bottom-32 z-50 md:top-12 md:bottom-40">
      <div
        className={cn('relative mx-auto h-full px-4 md:px-0', !hasSecondTile && 'max-w-[728px]')}
        style={{
          maxWidth: hasSecondTile ? `${compactGridMaxWidth}px` : undefined,
        }}
      >
        <div
          className={cn(classNames.grid, !hasSecondTile && classNames.gridDefault)}
          style={{
            gridTemplateColumns: hasSecondTile
              ? `${COMPACT_AGENT_TILE_WIDTH}fr ${secondTileWidth}fr`
              : undefined,
          }}
        >
          {/* Agent */}
          <div
            className={cn([
              'grid',
              hasSecondTile && 'w-full',
              hasSecondTile && classNames.agentChatOpenWithSecondTile,
              !hasSecondTile && !chatOpen && classNames.agentChatClosed,
              !hasSecondTile && chatOpen && classNames.agentChatOpenWithoutSecondTile,
            ])}
          >
            <AnimatePresence mode="popLayout">
              {!isAvatar && (
                // Audio Agent
                <MotionContainer
                  key="agent"
                  layoutId="agent"
                  initial={{
                    opacity: 0,
                    scale: 0,
                  }}
                  animate={{
                    opacity: 1,
                    scale: useCompactAgentTile ? 1 : 5,
                  }}
                  transition={{
                    ...ANIMATION_TRANSITION,
                    delay: animationDelay,
                  }}
                  className={cn(
                    'bg-background rounded-md border border-transparent transition-[border,drop-shadow]',
                    useCompactAgentTile ? COMPACT_AGENT_TILE_CLASS : 'h-[270px] w-[360px]',
                    useCompactAgentTile && 'border-input/50 drop-shadow-lg/10 delay-200'
                  )}
                >
                  <BarVisualizer
                    barCount={5}
                    state={agentState}
                    options={{ minHeight: 5 }}
                    trackRef={agentAudioTrack}
                    className={cn('flex h-full items-center justify-center gap-1')}
                  >
                    <span
                      className={cn([
                        'bg-muted min-h-2.5 w-2.5 rounded-full',
                        'origin-center transition-colors duration-250 ease-linear',
                        'data-[lk-highlighted=true]:bg-foreground data-[lk-muted=true]:bg-muted',
                      ])}
                    />
                  </BarVisualizer>
                </MotionContainer>
              )}

              {isAvatar && (
                // Avatar Agent
                <MotionContainer
                  key="avatar"
                  layoutId="avatar"
                  initial={{
                    scale: 1,
                    opacity: 1,
                    maskImage:
                      'radial-gradient(circle, rgba(0, 0, 0, 1) 0, rgba(0, 0, 0, 1) 20px, transparent 20px)',
                    filter: 'blur(20px)',
                  }}
                  animate={{
                    maskImage:
                      'radial-gradient(circle, rgba(0, 0, 0, 1) 0, rgba(0, 0, 0, 1) 500px, transparent 500px)',
                    filter: 'blur(0px)',
                    borderRadius: useCompactAgentTile ? 6 : 12,
                  }}
                  transition={{
                    ...ANIMATION_TRANSITION,
                    delay: animationDelay,
                    maskImage: {
                      duration: 1,
                    },
                    filter: {
                      duration: 1,
                    },
                  }}
                  className={cn(
                    'overflow-hidden bg-black drop-shadow-xl/80',
                    useCompactAgentTile ? COMPACT_AGENT_TILE_CLASS : 'h-auto w-full'
                  )}
                >
                  <VideoTrack
                    width={videoWidth}
                    height={videoHeight}
                    trackRef={agentVideoTrack}
                    className={cn(useCompactAgentTile && 'h-full w-full object-cover')}
                  />
                </MotionContainer>
              )}
            </AnimatePresence>
          </div>

          <div
            className={cn([
              'grid',
              hasSecondTile && 'w-full max-w-full',
              hasSecondTile && classNames.secondTileChatOpen,
              !hasSecondTile && classNames.secondTileChatClosed,
            ])}
          >
            {/* Camera & Screen Share */}
            <AnimatePresence>
              {secondTileTrack && (
                <MotionContainer
                  key="camera"
                  layout="position"
                  layoutId="camera"
                  initial={{
                    opacity: 0,
                    scale: 0,
                  }}
                  animate={{
                    opacity: 1,
                    scale: 1,
                  }}
                  exit={{
                    opacity: 0,
                    scale: 0,
                  }}
                  transition={{
                    ...ANIMATION_TRANSITION,
                    delay: animationDelay,
                  }}
                  className="w-full max-w-full drop-shadow-lg/20"
                >
                  <VideoTrack
                    trackRef={secondTileTrack}
                    width={secondTileTrack.publication.dimensions?.width ?? 0}
                    height={secondTileTrack.publication.dimensions?.height ?? 0}
                    className="bg-muted w-full rounded-md object-contain"
                    style={{
                      aspectRatio: `${secondTileWidth} / ${COMPACT_TILE_HEIGHT}`,
                      maxWidth: `${secondTileWidth}px`,
                      maxHeight: `${COMPACT_TILE_HEIGHT}px`,
                    }}
                  />
                </MotionContainer>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </div>
  );
}
