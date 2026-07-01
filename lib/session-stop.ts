import { resolveRoleInputDevices, usesServerRoomInputDevice } from './input-device-config';

export type RoomInputControlAction = 'start' | 'stop';

export interface ResolveRoomInputStopUrlsOptions {
  inputSource?: string | null;
  audioInputDevice?: string | null;
  visionInputDevice?: string | null;
  /**
   * Room-input control URLs are configured as base endpoint paths. The
   * normalizer intentionally strips query/hash fragments when switching
   * between /start and /stop so stop calls do not inherit start-only params.
   */
  roomAudioInputUrl?: string | null;
  roomVisionInputUrl?: string | null;
  roomInputUrl?: string | null;
  frontdeskInputParticipantUrl?: string | null;
  faceServiceUrl?: string | null;
  genericCameraParticipantUrl?: string | null;
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

function addRoomInputStopUrl(urls: Set<string>, rawUrl?: string | null): void {
  const stopUrl = normalizeRoomInputControlUrl(rawUrl || '', 'stop');
  if (stopUrl) {
    urls.add(stopUrl);
  }
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

export function resolveRoomInputStopUrls({
  inputSource,
  audioInputDevice,
  visionInputDevice,
  roomAudioInputUrl,
  roomVisionInputUrl,
  roomInputUrl,
  frontdeskInputParticipantUrl,
  faceServiceUrl,
  genericCameraParticipantUrl,
}: ResolveRoomInputStopUrlsOptions): string[] {
  const {
    audioInputDevice: resolvedAudioInputDevice,
    visionInputDevice: resolvedVisionInputDevice,
  } = resolveRoleInputDevices({
    inputSource,
    audioInputDevice,
    visionInputDevice,
  });

  const urls = new Set<string>();
  const selectedServerDevices = new Set<string>();

  if (usesServerRoomInputDevice(resolvedAudioInputDevice)) {
    selectedServerDevices.add(resolvedAudioInputDevice);
    addRoomInputStopUrl(urls, roomAudioInputUrl || roomInputUrl);
  }
  if (usesServerRoomInputDevice(resolvedVisionInputDevice)) {
    selectedServerDevices.add(resolvedVisionInputDevice);
    addRoomInputStopUrl(urls, roomVisionInputUrl || roomInputUrl);
  }
  if (selectedServerDevices.size === 0) {
    return [];
  }

  if (selectedServerDevices.has('xunfei')) {
    addRoomInputStopUrl(urls, frontdeskInputParticipantUrl);
    addRoomInputStopUrl(urls, faceServiceUrl);
  }
  if (selectedServerDevices.has('generic')) {
    addRoomInputStopUrl(urls, genericCameraParticipantUrl);
  }

  return [...urls];
}
