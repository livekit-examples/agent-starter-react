import type { Room } from 'livekit-client';
import type { UseSessionReturn } from '@livekit/components-react';
import type { LogLevel as AvatarSdkLogLevel, LoadProgressInfo } from '@spatius/avatarkit';
import type { AvatarPlayerOptions } from '@spatius/avatarkit-rtc';

export type SpatiusAvatarConnectionStatus =
  | 'idle'
  | 'initializing'
  | 'connecting'
  | 'connected'
  | 'disconnecting'
  | 'error';

export interface SpatiusAvatarConnection {
  url: string;
  token: string;
  roomName: string;
}

interface SpatiusAvatarSdkOptions {
  appId: string;
  avatarId: string;
  characterApiBaseUrl?: string;
  region?: string;
  sessionToken?: string;
  sdkLogLevel?: AvatarSdkLogLevel;
  userId?: string;
}

export interface UseSpatiusAvatarOptions extends SpatiusAvatarSdkOptions {
  connection: SpatiusAvatarConnection;
  enabled?: boolean;
  onAvatarError?: (error: Error) => void;
  onConnected?: (room: Room | null) => void;
  onDisconnected?: () => void;
  onLoadProgress?: (progress: LoadProgressInfo) => void;
  onStateChange?: (status: SpatiusAvatarConnectionStatus) => void;
  playerOptions?: AvatarPlayerOptions;
}

export interface SpatiusAvatarState {
  downloadProgress: number | null;
  error: Error | null;
  isConnected: boolean;
  isLoading: boolean;
  room: Room | null;
  status: SpatiusAvatarConnectionStatus;
}

export interface UseSpatiusAvatarResult extends SpatiusAvatarState {
  connection: SpatiusAvatarConnection;
  containerRef: (node: HTMLDivElement | null) => void;
  disconnect: () => Promise<void>;
  reconnect: () => Promise<void>;
  session: UseSessionReturn;
}

/**
 * Value published on {@link SpatiusAvatarContext}. The tile reads this to decide
 * how to render the agent:
 * - `canvas`: mount the Spatius WebGPU canvas (full avatar result attached).
 * - `audio-only`: unsupported browser fallback — force the audio visualizer and
 *   show `notice`.
 */
export type SpatiusAvatarContextValue =
  | ({ renderMode: 'canvas'; notice?: undefined } & UseSpatiusAvatarResult)
  | { renderMode: 'audio-only'; notice: string };
