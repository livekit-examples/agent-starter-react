'use client';

import { useEffect, useRef } from 'react';
import { Track, VideoTrack } from 'livekit-client';

/**
 * VIDEO TILE COMPONENT
 *
 * Displays a video track from a participant.
 *
 * Key concepts:
 * - Tracks need to be "attached" to HTML elements to render
 * - Video tracks attach to <video> elements
 * - Audio tracks attach to <audio> elements (though usually you just enable them)
 * - When a track is detached or the component unmounts, you should clean up
 */

interface VideoTileProps {
  // The video track to display
  track: VideoTrack | null;

  // Label to show on the tile (e.g., participant name)
  label: string;

  // Mirror the video (useful for local camera)
  mirror?: boolean;
}

export function VideoTile({ track, label, mirror = false }: VideoTileProps) {
  // Reference to the video element
  const videoRef = useRef<HTMLVideoElement>(null);

  // Attach/detach track when it changes
  useEffect(() => {
    const videoElement = videoRef.current;
    if (!videoElement) return;

    if (track) {
      // Attach the track to the video element
      // This starts rendering the video stream
      track.attach(videoElement);

      return () => {
        // Clean up: detach when component unmounts or track changes
        track.detach(videoElement);
      };
    }
  }, [track]);

  return (
    <div className="video-container">
      {track ? (
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted // Local video should always be muted to prevent echo
          style={{
            transform: mirror ? 'scaleX(-1)' : undefined,
          }}
        />
      ) : (
        // Placeholder when no video
        <div
          style={{
            width: '100%',
            height: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#666',
            background: '#1a1a1a',
          }}
        >
          No video
        </div>
      )}
      <div className="video-label">{label}</div>
    </div>
  );
}
