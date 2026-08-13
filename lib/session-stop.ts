import { resolveRoleInputDevices, usesServerRoomInputDevice } from './input-device-config';

export type RoomInputControlAction = 'start' | 'stop';

export interface ResolveRoomInputStopUrlsOptions {
  inputSource?: string | null;
  audioInputDevice?: string | null;
  visionInputDevice?: string | null;
  videoProcessorUrl?: string | null;
  edgeMediaUrl?: string | null;
}

export function resolveLiveKitHttpUrl(liveKitUrl?: string | null): string | undefined {
  const normalized = liveKitUrl?.trim();
  if (!normalized) {
    return undefined;
  }
  if (normalized.startsWith('wss://')) {
    return `https://${normalized.slice('wss://'.length)}`;
  }
  if (normalized.startsWith('ws://')) {
    return `http://${normalized.slice('ws://'.length)}`;
  }
  return normalized;
}

export function normalizeRoomInputControlUrl(
  rawUrl: string,
  action: RoomInputControlAction
): string {
  const value = rawUrl.trim();
  if (!value) {
    return '';
  }

  try {
    const url = new URL(value);
    const pathname = url.pathname.replace(/\/+$/, '');
    const otherAction = action === 'stop' ? 'start' : 'stop';
    if (pathname.endsWith(`/${otherAction}`)) {
      url.pathname = `${pathname.slice(0, -1 * (otherAction.length + 1))}/${action}`;
    } else if (!pathname.endsWith(`/${action}`)) {
      url.pathname = `${pathname}/${action}`;
    }
    // Control URLs are base endpoint paths; query/hash fragments are not part
    // of the room-input stop contract and should not be carried across actions.
    url.search = '';
    url.hash = '';
    return url.toString();
  } catch {
    const withoutTrailingSlash = value.replace(/\/+$/, '');
    if (withoutTrailingSlash.endsWith(`/${action}`)) {
      return withoutTrailingSlash;
    }

    const otherAction = action === 'stop' ? 'start' : 'stop';
    if (withoutTrailingSlash.endsWith(`/${otherAction}`)) {
      return `${withoutTrailingSlash.slice(0, -1 * (otherAction.length + 1))}/${action}`;
    }
    return `${withoutTrailingSlash}/${action}`;
  }
}

export async function executeRoomInputStopsSequentially<T>(
  stopUrls: readonly string[],
  stop: (stopUrl: string) => Promise<T>
): Promise<T[]> {
  const results: T[] = [];
  for (const stopUrl of stopUrls) {
    results.push(await stop(stopUrl));
  }
  return results;
}

export function resolveRoomInputStopUrls({
  inputSource,
  audioInputDevice,
  visionInputDevice,
  videoProcessorUrl,
  edgeMediaUrl,
}: ResolveRoomInputStopUrlsOptions): string[] {
  const {
    audioInputDevice: resolvedAudioInputDevice,
    visionInputDevice: resolvedVisionInputDevice,
  } = resolveRoleInputDevices({
    inputSource,
    audioInputDevice,
    visionInputDevice,
  });

  const usesServerInput =
    usesServerRoomInputDevice(resolvedAudioInputDevice) ||
    usesServerRoomInputDevice(resolvedVisionInputDevice);
  if (!usesServerInput) {
    return [];
  }

  const videoProcessorStopUrl = normalizeRoomInputControlUrl(videoProcessorUrl || '', 'stop');
  const edgeMediaStopUrl = normalizeRoomInputControlUrl(edgeMediaUrl || '', 'stop');
  if (!videoProcessorStopUrl || !edgeMediaStopUrl) {
    throw new Error('VIDEO_PROCESSOR_URL and EDGE_MEDIA_URL are required for server room input');
  }
  if (videoProcessorStopUrl === edgeMediaStopUrl) {
    throw new Error(
      'VIDEO_PROCESSOR_URL and EDGE_MEDIA_URL must resolve to distinct stop endpoints'
    );
  }

  return [videoProcessorStopUrl, edgeMediaStopUrl];
}
