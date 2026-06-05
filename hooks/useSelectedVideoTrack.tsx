'use client';

import React, { ReactNode, createContext, useCallback, useContext, useState } from 'react';
import type { TrackReference } from '@livekit/components-react';

interface SelectedVideoTrackState {
  trackReference: TrackReference | null;
  trackId: string | null;
  isPreviewDisabled: boolean;
  setSelectedTrack: (trackId: string, trackReference: TrackReference | null) => void;
  clearSelectedTrack: (options?: { disablePreview?: boolean }) => void;
}

const SelectedVideoTrackContext = createContext<SelectedVideoTrackState | null>(null);

export function SelectedVideoTrackProvider({ children }: { children: ReactNode }) {
  const [trackReference, setTrackReference] = useState<TrackReference | null>(null);
  const [trackId, setTrackId] = useState<string | null>(null);
  const [isPreviewDisabled, setIsPreviewDisabled] = useState(false);

  const setSelectedTrack = useCallback(
    (newTrackId: string, newTrackReference: TrackReference | null) => {
      setTrackId(newTrackId);
      setTrackReference(newTrackReference);
      setIsPreviewDisabled(false);
    },
    []
  );

  const clearSelectedTrack = useCallback((options?: { disablePreview?: boolean }) => {
    setTrackId(null);
    setTrackReference(null);
    setIsPreviewDisabled(Boolean(options?.disablePreview));
  }, []);

  return (
    <SelectedVideoTrackContext.Provider
      value={{
        trackReference,
        trackId,
        isPreviewDisabled,
        setSelectedTrack,
        clearSelectedTrack,
      }}
    >
      {children}
    </SelectedVideoTrackContext.Provider>
  );
}

export function useSelectedVideoTrack() {
  const context = useContext(SelectedVideoTrackContext);
  if (!context) {
    // 如果没有 Provider，返回默认值
    return {
      trackReference: null,
      trackId: null,
      isPreviewDisabled: false,
      setSelectedTrack: () => {},
      clearSelectedTrack: () => {},
    };
  }
  return context;
}
