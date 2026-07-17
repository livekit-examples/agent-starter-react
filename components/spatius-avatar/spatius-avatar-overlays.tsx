'use client';

import { cn } from '@/lib/shadcn/utils';
import type { SpatiusAvatarConnectionStatus } from '@/lib/spatius/types';

const overlayBase =
  'pointer-events-none absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-black/60 p-4 text-center text-white backdrop-blur-sm';

export interface SpatiusAvatarLoadingProps {
  status: SpatiusAvatarConnectionStatus;
  downloadProgress: number | null;
  isConnected: boolean;
}

/** Loading overlay shown while the model downloads and the motion stream connects. */
export function SpatiusAvatarLoading({
  status,
  downloadProgress,
  isConnected,
}: SpatiusAvatarLoadingProps) {
  const isBusy = !isConnected && (status === 'initializing' || status === 'connecting');
  if (!isBusy) {
    return null;
  }

  const percent =
    downloadProgress !== null
      ? Math.min(100, Math.max(0, Math.round(downloadProgress * 100)))
      : null;

  // Phase-specific label so a long model download never looks frozen.
  const isDownloading = status === 'initializing' && percent !== null && percent < 100;
  let label: string;
  if (status === 'connecting') {
    label = 'Connecting to avatar stream…';
  } else if (isDownloading) {
    label = `Downloading avatar… ${percent}%`;
  } else if (percent === 100) {
    label = 'Loading avatar…';
  } else {
    label = 'Preparing avatar…';
  }

  return (
    <div className={overlayBase}>
      <div className="size-6 animate-spin rounded-full border-2 border-white/30 border-t-white" />
      <p className="text-sm font-medium">{label}</p>
      {isDownloading && (
        <div className="h-1 w-40 overflow-hidden rounded-full bg-white/20">
          <div
            className="h-full rounded-full bg-white transition-[width] duration-200"
            style={{ width: `${percent}%` }}
          />
        </div>
      )}
    </div>
  );
}

export interface SpatiusAvatarErrorProps {
  error: Error | null;
}

/** Error overlay shown when the avatar fails to initialize or connect. */
export function SpatiusAvatarError({ error }: SpatiusAvatarErrorProps) {
  if (!error) {
    return null;
  }
  return (
    <div className={cn(overlayBase, 'bg-black/75')}>
      <p className="text-sm font-semibold">Avatar unavailable</p>
      <p className="max-w-xs text-xs text-white/70">{error.message}</p>
    </div>
  );
}

export interface SpatiusAvatarNoticeProps {
  children: React.ReactNode;
  className?: string;
}

/** Small badge used for the unsupported-browser (audio-only) fallback notice. */
export function SpatiusAvatarNotice({ children, className }: SpatiusAvatarNoticeProps) {
  return (
    <div
      className={cn(
        'bg-background/80 text-muted-foreground pointer-events-none absolute inset-x-0 bottom-2 z-10 mx-auto w-fit max-w-[90%] rounded-full border px-3 py-1 text-center text-xs backdrop-blur-sm',
        className
      )}
    >
      {children}
    </div>
  );
}
