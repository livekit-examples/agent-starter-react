import { cache } from 'react';
import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { APP_CONFIG_DEFAULTS, buildDefaultVideoTracks, getDefaultVideoTrack } from '@/app-config';
import type { AppConfig, VideoTrackConfig } from '@/app-config';

export const CONFIG_ENDPOINT =
  process.env.APP_CONFIG_ENDPOINT || process.env.NEXT_PUBLIC_APP_CONFIG_ENDPOINT;
export const SANDBOX_ID = process.env.SANDBOX_ID;

export const THEME_STORAGE_KEY = 'theme-mode';
export const THEME_MEDIA_QUERY = '(prefers-color-scheme: dark)';

export interface SandboxConfig {
  [key: string]: SandboxConfigEntry;
}

type SandboxConfigEntry =
  | { type: 'string'; value: string }
  | { type: 'number'; value: number }
  | { type: 'boolean'; value: boolean }
  | { type: 'array'; value: unknown[] }
  | { type: 'object'; value: Record<string, unknown> }
  | null;

type SandboxConfigEntryType = NonNullable<SandboxConfigEntry>['type'];

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

function readEnv(...names: string[]) {
  for (const name of names) {
    const value = process.env[name];
    if (value && value.trim()) return value.trim();
  }
  return '';
}

function readBooleanEnv(defaultValue: boolean, ...names: string[]) {
  const value = readEnv(...names).toLowerCase();
  if (!value) return defaultValue;
  return ['1', 'true', 'yes', 'on'].includes(value);
}

function readNumberEnv(defaultValue: number, ...names: string[]) {
  const parsed = Number(readEnv(...names));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : defaultValue;
}

function hasAppConfigKey(key: string): key is keyof AppConfig {
  return key in APP_CONFIG_DEFAULTS;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function matchesSandboxEntryType(value: unknown, type: SandboxConfigEntryType) {
  if (type === 'array') {
    return Array.isArray(value);
  }

  if (type === 'object') {
    return isPlainObject(value);
  }

  return typeof value === type;
}

function isVideoTrackConfig(value: unknown): value is VideoTrackConfig {
  if (!isPlainObject(value)) {
    return false;
  }

  const type = value.type;
  const icon = value.icon;

  return (
    typeof value.id === 'string' &&
    typeof value.label === 'string' &&
    (type === 'system' || type === 'livekit') &&
    typeof value.enabled === 'boolean' &&
    (value.livekitTrackName === undefined || typeof value.livekitTrackName === 'string') &&
    (icon === undefined || icon === 'camera' || icon === 'broadcast') &&
    (value.description === undefined || typeof value.description === 'string')
  );
}

function isValidAppConfigValue(key: keyof AppConfig, value: unknown) {
  if (key === 'availableVideoTracks') {
    return Array.isArray(value) && value.every(isVideoTrackConfig);
  }

  if (key === 'excludeAudioTracks' || key === 'userTranscriptionIdentities') {
    return Array.isArray(value) && value.every((item) => typeof item === 'string');
  }

  return true;
}

function canApplySandboxConfigEntry(key: keyof AppConfig, entry: NonNullable<SandboxConfigEntry>) {
  if (
    !matchesSandboxEntryType(entry.value, entry.type) ||
    !isValidAppConfigValue(key, entry.value)
  ) {
    return false;
  }

  const defaultValue = APP_CONFIG_DEFAULTS[key];
  if (defaultValue === undefined) {
    return true;
  }

  return matchesSandboxEntryType(defaultValue, entry.type);
}

export function getClientConfigFromEnv(): AppConfig {
  const inputSource = readEnv(
    'INPUT_SOURCE',
    'NEXT_PUBLIC_INPUT_SOURCE',
    'NEXT_PUBLIC_LEXVOICE_DEVICE'
  ).toLowerCase();
  const isBrowserInput = inputSource === 'browser';
  const usesServerRoomInput = ['xunfei', 'generic'].includes(inputSource);
  const agentName = readEnv(
    'AGENT_NAME',
    'NEXT_PUBLIC_AGENT_NAME',
    'NEXT_PUBLIC_LEXVOICE_AGENT_NAME'
  );

  return {
    ...APP_CONFIG_DEFAULTS,
    supportsScreenShare: isBrowserInput ? false : APP_CONFIG_DEFAULTS.supportsScreenShare,
    usesBrowserRawMediaInput: isBrowserInput,
    usesServerRoomInput,
    agentName: agentName || undefined,
    showDefaultCameraPreview: isBrowserInput ? false : APP_CONFIG_DEFAULTS.showDefaultCameraPreview,
    availableVideoTracks: buildDefaultVideoTracks(isBrowserInput, usesServerRoomInput),
    defaultVideoTrack: getDefaultVideoTrack(),
    browserMediaStreamName:
      readEnv(
        'BROWSER_MEDIA_STREAM_NAME',
        'NEXT_PUBLIC_BROWSER_MEDIA_STREAM_NAME',
        'NEXT_PUBLIC_LEXVOICE_BROWSER_MEDIA_STREAM_NAME'
      ) || APP_CONFIG_DEFAULTS.browserMediaStreamName,
    browserVideoWidth: readNumberEnv(
      APP_CONFIG_DEFAULTS.browserVideoWidth ?? 640,
      'BROWSER_VIDEO_WIDTH',
      'NEXT_PUBLIC_BROWSER_VIDEO_WIDTH',
      'NEXT_PUBLIC_LEXVOICE_BROWSER_VIDEO_WIDTH'
    ),
    browserVideoHeight: readNumberEnv(
      APP_CONFIG_DEFAULTS.browserVideoHeight ?? 480,
      'BROWSER_VIDEO_HEIGHT',
      'NEXT_PUBLIC_BROWSER_VIDEO_HEIGHT',
      'NEXT_PUBLIC_LEXVOICE_BROWSER_VIDEO_HEIGHT'
    ),
    browserVideoFps: readNumberEnv(
      APP_CONFIG_DEFAULTS.browserVideoFps ?? 25,
      'BROWSER_VIDEO_FPS',
      'NEXT_PUBLIC_BROWSER_VIDEO_FPS',
      'NEXT_PUBLIC_LEXVOICE_BROWSER_VIDEO_FPS'
    ),
    browserVideoMaxBitrate: readNumberEnv(
      APP_CONFIG_DEFAULTS.browserVideoMaxBitrate ?? 1700000,
      'BROWSER_VIDEO_MAX_BITRATE',
      'NEXT_PUBLIC_BROWSER_VIDEO_MAX_BITRATE',
      'NEXT_PUBLIC_LEXVOICE_BROWSER_VIDEO_MAX_BITRATE'
    ),
    browserVideoStats: readBooleanEnv(
      APP_CONFIG_DEFAULTS.browserVideoStats ?? false,
      'BROWSER_VIDEO_STATS',
      'NEXT_PUBLIC_BROWSER_VIDEO_STATS',
      'NEXT_PUBLIC_LEXVOICE_BROWSER_VIDEO_STATS'
    ),
    remoteVideoWidth: readNumberEnv(
      APP_CONFIG_DEFAULTS.remoteVideoWidth ?? 640,
      'REMOTE_VIDEO_WIDTH',
      'NEXT_PUBLIC_REMOTE_VIDEO_WIDTH',
      'NEXT_PUBLIC_LEXVOICE_REMOTE_VIDEO_WIDTH'
    ),
    remoteVideoHeight: readNumberEnv(
      APP_CONFIG_DEFAULTS.remoteVideoHeight ?? 480,
      'REMOTE_VIDEO_HEIGHT',
      'NEXT_PUBLIC_REMOTE_VIDEO_HEIGHT',
      'NEXT_PUBLIC_LEXVOICE_REMOTE_VIDEO_HEIGHT'
    ),
    remoteVideoFps: readNumberEnv(
      APP_CONFIG_DEFAULTS.remoteVideoFps ?? 25,
      'REMOTE_VIDEO_FPS',
      'NEXT_PUBLIC_REMOTE_VIDEO_FPS',
      'NEXT_PUBLIC_LEXVOICE_REMOTE_VIDEO_FPS'
    ),
    debugAudio: readBooleanEnv(
      APP_CONFIG_DEFAULTS.debugAudio ?? false,
      'DEBUG_AUDIO',
      'NEXT_PUBLIC_DEBUG_AUDIO',
      'NEXT_PUBLIC_LEXVOICE_DEBUG_AUDIO'
    ),
    debugVideo: readBooleanEnv(
      APP_CONFIG_DEFAULTS.debugVideo ?? false,
      'DEBUG_VIDEO',
      'NEXT_PUBLIC_DEBUG_VIDEO',
      'NEXT_PUBLIC_LEXVOICE_DEBUG_VIDEO'
    ),
  };
}

// https://react.dev/reference/react/cache#caveats
// > React will invalidate the cache for all memoized functions for each server request.
export const getAppConfig = cache(async (headers: Headers): Promise<AppConfig> => {
  const envConfig = getClientConfigFromEnv();

  if (CONFIG_ENDPOINT) {
    const sandboxId = SANDBOX_ID ?? headers.get('x-sandbox-id') ?? '';

    try {
      if (!sandboxId) {
        throw new Error('Sandbox ID is required');
      }

      const response = await fetch(CONFIG_ENDPOINT, {
        cache: 'no-store',
        headers: { 'X-Sandbox-ID': sandboxId },
      });

      const remoteConfig: SandboxConfig = await response.json();
      const config: AppConfig = { ...envConfig, sandboxId };

      for (const [key, entry] of Object.entries(remoteConfig)) {
        if (entry === null) continue;
        // Only include app config entries declared in defaults and matching the
        // expected type. Structured fields get extra shape checks above.
        if (hasAppConfigKey(key) && canApplySandboxConfigEntry(key, entry)) {
          Object.assign(config, { [key]: entry.value });
        }
      }

      return config;
    } catch (error) {
      console.error('ERROR: getAppConfig() - lib/utils.ts', error);
    }
  }

  return envConfig;
});

// check provided accent colors against defaults
// apply styles if they differ (or in development mode)
// generate a hover color for the accent color by mixing it with 20% black
export function getStyles(appConfig: AppConfig) {
  const { accent, accentDark } = appConfig;

  return [
    accent
      ? `:root { --primary: ${accent}; --primary-hover: color-mix(in srgb, ${accent} 80%, #000); }`
      : '',
    accentDark
      ? `.dark { --primary: ${accentDark}; --primary-hover: color-mix(in srgb, ${accentDark} 80%, #000); }`
      : '',
  ]
    .filter(Boolean)
    .join('\n');
}
