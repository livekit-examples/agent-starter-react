import React, { useCallback, useMemo, useState } from 'react';
import { Track } from 'livekit-client';
import { X } from 'lucide-react';
import { AnimatePresence, type MotionProps, motion } from 'motion/react';
import {
  type TrackReference,
  VideoTrack,
  useLocalParticipant,
  useRemoteParticipants,
  useTracks,
  useVoiceAssistant,
} from '@livekit/components-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/shadcn/utils';
import { AudioVisualizer } from './audio-visualizer';

const ANIMATION_TRANSITION: MotionProps['transition'] = {
  type: 'spring',
  stiffness: 675,
  damping: 75,
  mass: 1,
};

const tileViewClassNames = {
  // GRID
  // 2 Columns x 3 Rows
  grid: [
    'w-full',
    'grid gap-x-2 place-content-start',
    'grid-cols-[1fr_auto_1fr] grid-rows-[90px_1fr_90px]',
  ],
  // Agent
  // chatOpen: true,
  // hasSecondTile: true
  // layout: Column 1 / Row 1
  // align: x-end y-center
  agentChatOpenWithSecondTile: ['col-start-2 row-start-1', 'self-start justify-self-center'],
  // Agent
  // chatOpen: true,
  // hasSecondTile: false
  // layout: Column 1 / Row 1 / Column-Span 2
  // align: x-center y-center
  agentChatOpenWithoutSecondTile: ['col-start-2 row-start-1', 'self-center justify-self-center'],
  // Agent
  // chatOpen: false
  // layout: Column 1 / Row 1 / Column-Span 2 / Row-Span 3
  // align: x-center y-center
  agentChatClosed: ['col-start-1 row-start-1', 'col-span-3 row-span-3', 'place-content-center'],
  // Second tile
  // chatOpen: true,
  // hasSecondTile: true
  // layout: Column 2 / Row 1
  // align: x-start y-center
  secondTileChatOpen: ['col-start-3 row-start-1', 'self-start justify-self-start'],
  // Second tile
  // chatOpen: false,
  // hasSecondTile: false
  // layout: Column 3 / Row 1
  // align: x-start y-start
  secondTileChatClosed: ['col-start-3 row-start-1', 'self-start justify-self-start'],
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
  themeMode?: 'dark' | 'light';
  isChatOpen: boolean;
  audioVisualizerType?: 'bar' | 'wave' | 'grid' | 'radial' | 'aura';
  audioVisualizerColor?: `#${string}`;
  audioVisualizerColorShift?: number;
  audioVisualizerWaveLineWidth?: number;
  audioVisualizerGridRowCount?: number;
  audioVisualizerGridColumnCount?: number;
  audioVisualizerRadialBarCount?: number;
  audioVisualizerRadialRadius?: number;
  audioVisualizerBarCount?: number;
}

export function TileLayout({
  themeMode,
  isChatOpen,
  audioVisualizerType,
  audioVisualizerColor,
  audioVisualizerColorShift,
  audioVisualizerBarCount,
  audioVisualizerRadialBarCount,
  audioVisualizerRadialRadius,
  audioVisualizerGridRowCount,
  audioVisualizerGridColumnCount,
  audioVisualizerWaveLineWidth,
}: TileLayoutProps) {
  const { videoTrack: agentVideoTrack } = useVoiceAssistant();
  const [screenShareTrack] = useTracks([Track.Source.ScreenShare]);
  const cameraTrack: TrackReference | undefined = useLocalTrackRef(Track.Source.Camera);
  const remoteParticipants = useRemoteParticipants();

  const isCameraEnabled = cameraTrack && !cameraTrack.publication.isMuted;
  const isScreenShareEnabled = screenShareTrack && !screenShareTrack.publication.isMuted;
  const hasSecondTile = isCameraEnabled || isScreenShareEnabled;

  const remoteVideoTracks = useMemo(() => {
    return remoteParticipants
      .filter((p) => {
        const pub = p.getTrackPublication(Track.Source.Camera);
        return pub && !pub.isMuted;
      })
      .map(
        (p) =>
          ({
            source: Track.Source.Camera,
            participant: p,
            publication: p.getTrackPublication(Track.Source.Camera)!,
          }) as TrackReference
      );
  }, [remoteParticipants]);

  const [zoomedTrackRef, setZoomedTrackRef] = useState<TrackReference | null>(null);

  const handleZoom = useCallback((trackRef: TrackReference) => {
    setZoomedTrackRef(trackRef);
  }, []);

  const handleCloseZoom = useCallback(() => {
    setZoomedTrackRef(null);
  }, []);

  const animationDelay = isChatOpen ? 0 : 0.15;
  const isAvatar = agentVideoTrack !== undefined;
  const videoWidth = agentVideoTrack?.publication.dimensions?.width ?? 0;
  const videoHeight = agentVideoTrack?.publication.dimensions?.height ?? 0;

  //<div className="pointer-events-none absolute inset-x-0 top-8 bottom-32 z-50 md:top-12 md:bottom-40">
  //  <div className="relative mx-auto h-full max-w-2xl px-4 md:px-0">
  return (
    <>
      <div className="">
        <div className="relative mx-auto w-full max-w-5xl px-4 md:px-0">
          <div className={cn(tileViewClassNames.grid)}>
            {/* Agent */}
            <div
              className={cn([
                'grid',
                !isChatOpen && tileViewClassNames.agentChatClosed,
                isChatOpen && hasSecondTile && tileViewClassNames.agentChatOpenWithSecondTile,
                isChatOpen && !hasSecondTile && tileViewClassNames.agentChatOpenWithoutSecondTile,
              ])}
            >
              <AnimatePresence mode="popLayout">
                {!isAvatar && (
                  // Audio Agent
                  <motion.div
                    key="agent"
                    layoutId="agent"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{
                      ...ANIMATION_TRANSITION,
                      delay: animationDelay,
                    }}
                    className={cn('relative aspect-square h-[90px]')}
                  >
                    <AudioVisualizer
                      key="audio-visualizer"
                      initial={{ scale: 1 }}
                      animate={{ scale: isChatOpen ? 0.2 : 1 }}
                      transition={{
                        ...ANIMATION_TRANSITION,
                        delay: animationDelay,
                      }}
                      audioVisualizerType={audioVisualizerType}
                      audioVisualizerColor={audioVisualizerColor}
                      audioVisualizerColorShift={audioVisualizerColorShift}
                      audioVisualizerBarCount={audioVisualizerBarCount}
                      audioVisualizerRadialBarCount={audioVisualizerRadialBarCount}
                      audioVisualizerRadialRadius={audioVisualizerRadialRadius}
                      audioVisualizerGridRowCount={audioVisualizerGridRowCount}
                      audioVisualizerGridColumnCount={audioVisualizerGridColumnCount}
                      audioVisualizerWaveLineWidth={audioVisualizerWaveLineWidth}
                      themeMode={themeMode}
                      isChatOpen={isChatOpen}
                      className={cn(
                        'absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2',
                        'bg-background rounded-[50px] border border-transparent transition-[border,drop-shadow]',
                        isChatOpen && 'border-input shadow-2xl/10 delay-200'
                      )}
                      style={{ color: audioVisualizerColor }}
                    />
                  </motion.div>
                )}

                {isAvatar && (
                  // Avatar Agent
                  <motion.div
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
                      borderRadius: isChatOpen ? 6 : 12,
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
                      isChatOpen ? 'h-[90px]' : 'h-auto w-full'
                    )}
                  >
                    <VideoTrack
                      width={videoWidth}
                      height={videoHeight}
                      trackRef={agentVideoTrack}
                      onClick={() => handleZoom(agentVideoTrack)}
                      className={cn('cursor-pointer', isChatOpen && 'size-[90px] object-cover')}
                    />
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <div
              className={cn([
                'grid',
                isChatOpen && tileViewClassNames.secondTileChatOpen,
                !isChatOpen && tileViewClassNames.secondTileChatClosed,
              ])}
            >
              {/* Camera & Screen Share */}
              <AnimatePresence>
                {((cameraTrack && isCameraEnabled) ||
                  (screenShareTrack && isScreenShareEnabled)) && (
                  <motion.div
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
                    className="aspect-square size-[90px] drop-shadow-lg/20"
                  >
                    <VideoTrack
                      trackRef={cameraTrack || screenShareTrack}
                      width={(cameraTrack || screenShareTrack)?.publication.dimensions?.width ?? 0}
                      height={
                        (cameraTrack || screenShareTrack)?.publication.dimensions?.height ?? 0
                      }
                      onClick={() => handleZoom(cameraTrack || screenShareTrack!)}
                      className="bg-muted aspect-square size-[90px] rounded-md object-cover"
                    />
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
          {(remoteVideoTracks.length > 0 ||
            (isAvatar && (isCameraEnabled || isScreenShareEnabled))) && (
            <div className="flex flex-wrap justify-center gap-2 pt-2">
              {isAvatar && (isCameraEnabled || isScreenShareEnabled) && (
                <div className="bg-muted relative aspect-square size-[90px] overflow-hidden rounded-md">
                  <VideoTrack
                    trackRef={cameraTrack || screenShareTrack!}
                    width={(cameraTrack || screenShareTrack)?.publication.dimensions?.width ?? 0}
                    height={(cameraTrack || screenShareTrack)?.publication.dimensions?.height ?? 0}
                    onClick={() => handleZoom(cameraTrack || screenShareTrack!)}
                    className="size-full cursor-pointer object-cover"
                  />
                  <span className="absolute right-0 bottom-0 left-0 truncate bg-black/50 px-1 text-center text-xs text-white">
                    {isCameraEnabled ? 'Камера' : 'Демонстрация экрана'}
                  </span>
                </div>
              )}
              {remoteVideoTracks.map((track) => (
                <div
                  key={track.participant.identity}
                  className="bg-muted relative aspect-square size-[90px] overflow-hidden rounded-md"
                >
                  <VideoTrack
                    trackRef={track}
                    width={track.publication.dimensions?.width ?? 0}
                    height={track.publication.dimensions?.height ?? 0}
                    onClick={() => handleZoom(track)}
                    className="size-full cursor-pointer object-cover"
                  />
                  <span className="absolute right-0 bottom-0 left-0 truncate bg-black/50 px-1 text-center text-xs text-white">
                    {track.participant.name || track.participant.identity}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
      {zoomedTrackRef && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80"
          onClick={handleCloseZoom}
        >
          <motion.div
            initial={{ scale: 0.8 }}
            animate={{ scale: 1 }}
            className="relative max-h-[90vh] max-w-[90vw]"
            onClick={(e) => e.stopPropagation()}
          >
            <Button
              variant="ghost"
              size="icon"
              onClick={handleCloseZoom}
              className="absolute -top-10 right-0 text-white hover:text-white/70"
              aria-label="Закрыть просмотр"
            >
              <X className="size-6" />
            </Button>
            <VideoTrack
              trackRef={zoomedTrackRef}
              width={zoomedTrackRef.publication.dimensions?.width ?? 1280}
              height={zoomedTrackRef.publication.dimensions?.height ?? 720}
              className="max-h-[90vh] max-w-[90vw] rounded-lg object-contain"
            />
          </motion.div>
        </motion.div>
      )}
    </>
  );
}
