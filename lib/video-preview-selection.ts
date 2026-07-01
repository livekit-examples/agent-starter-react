import type { VideoTrackConfig } from '@/app-config';

type PreviewTrackType = VideoTrackConfig['type'] | null | undefined;

interface ResolveCameraPreviewTrackParams<T> {
  selectedTrack: T | null | undefined;
  selectedTrackId: string | null | undefined;
  selectedTrackType?: PreviewTrackType;
  canShowDefaultCameraPreview: boolean;
  configuredCameraTrack?: T;
  defaultCameraTrack?: T;
}

export function resolveCameraPreviewTrack<T>({
  selectedTrack,
  selectedTrackId,
  selectedTrackType,
  canShowDefaultCameraPreview,
  configuredCameraTrack,
  defaultCameraTrack,
}: ResolveCameraPreviewTrackParams<T>): T | undefined {
  if (selectedTrack) {
    return selectedTrack;
  }

  if (!canShowDefaultCameraPreview) {
    return undefined;
  }

  if (!selectedTrackId) {
    return configuredCameraTrack ?? defaultCameraTrack;
  }

  if (selectedTrackType === 'system') {
    return defaultCameraTrack;
  }

  return undefined;
}
