import type { AppConfig } from '@/app-config';

/**
 * Which decoder renders the agent's video tile.
 * - `standard`: LiveKit `VideoTrack` / audio visualizer (default behaviour).
 * - `spatius`: Spatius AvatarKit WebGPU decoder for their motion-over-RTC avatars.
 */
export type AvatarProvider = 'standard' | 'spatius';

export interface SpatiusSettings {
  provider: AvatarProvider;
  appId: string;
  avatarId: string;
  /**
   * Agent name to dispatch into the room. Must match a worker registered with
   * explicit dispatch (`agent_name="…"`); leave empty when the worker uses
   * automatic dispatch (registered without an `agent_name`).
   */
  agentName: string;
}

const STORAGE_KEY = 'agent-starter:avatar-settings';

/**
 * Default settings seeded from `AppConfig` (which in turn reads `AGENT_NAME` and
 * `NEXT_PUBLIC_SPATIUS_*` env vars). Used for SSR and the first client paint,
 * before per-browser overrides are loaded from localStorage.
 */
export function defaultSpatiusSettings(appConfig: AppConfig): SpatiusSettings {
  const appId = appConfig.spatiusAppId ?? '';
  const avatarId = appConfig.spatiusAvatarId ?? '';
  // Only default to the Spatius provider when an avatar id has been configured.
  return {
    provider: avatarId ? 'spatius' : 'standard',
    appId,
    avatarId,
    // Empty by default (automatic dispatch); seed from AGENT_NAME when set.
    agentName: appConfig.agentName ?? '',
  };
}

/** Read persisted per-browser settings, falling back to `defaults`. Safe on the server. */
export function loadSpatiusSettings(defaults: SpatiusSettings): SpatiusSettings {
  if (typeof window === 'undefined') {
    return defaults;
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return defaults;
    }
    const parsed = JSON.parse(raw) as Partial<SpatiusSettings>;
    return {
      provider: parsed.provider === 'spatius' ? 'spatius' : 'standard',
      appId: typeof parsed.appId === 'string' ? parsed.appId : defaults.appId,
      avatarId: typeof parsed.avatarId === 'string' ? parsed.avatarId : defaults.avatarId,
      agentName: typeof parsed.agentName === 'string' ? parsed.agentName : defaults.agentName,
    };
  } catch {
    return defaults;
  }
}

/** Persist settings for this browser. No-op on the server. */
export function saveSpatiusSettings(settings: SpatiusSettings): void {
  if (typeof window === 'undefined') {
    return;
  }
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // Ignore write failures (e.g. private mode / storage disabled).
  }
}

/** Whether the given settings should activate the Spatius decode path. */
export function isSpatiusEnabled(settings: SpatiusSettings): boolean {
  return settings.provider === 'spatius' && settings.avatarId.trim().length > 0;
}
