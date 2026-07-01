export const DEFAULT_ROLE_INPUT_DEVICE = 'xunfei';

const VALID_INPUT_DEVICE_VALUES = ['xunfei', 'generic', 'primebot', 'browser'] as const;
const SERVER_ROOM_INPUT_DEVICE_VALUES = ['xunfei', 'generic'] as const;

export const VALID_INPUT_DEVICES: ReadonlySet<string> = new Set(VALID_INPUT_DEVICE_VALUES);
export const SERVER_ROOM_INPUT_DEVICES: ReadonlySet<string> = new Set(
  SERVER_ROOM_INPUT_DEVICE_VALUES
);

export interface RoleInputDeviceOptions {
  inputSource?: string | null;
  audioInputDevice?: string | null;
  visionInputDevice?: string | null;
  outputDevice?: string | null;
}

export interface ResolvedRoleInputDevices {
  inputSource: string;
  audioInputDevice: string;
  visionInputDevice: string;
  outputDevice: string;
}

export function normalizeInputSource(inputSource?: string | null): string {
  const normalized = (inputSource || '').trim().toLowerCase();
  return normalized || 'browser';
}

export function normalizeRoleInputDevice(
  inputDevice: string | null | undefined,
  fallback: string
): string {
  const normalized = (inputDevice || '').trim().toLowerCase();
  if (VALID_INPUT_DEVICES.has(normalized)) {
    return normalized;
  }
  return fallback;
}

export function usesServerRoomInputDevice(inputDevice: string): boolean {
  return SERVER_ROOM_INPUT_DEVICES.has(inputDevice);
}

export function resolveRoleInputDevices({
  inputSource,
  audioInputDevice,
  visionInputDevice,
  outputDevice,
}: RoleInputDeviceOptions = {}): ResolvedRoleInputDevices {
  const normalizedInputSource = normalizeInputSource(inputSource);
  const isMixedInputSource = normalizedInputSource === 'mixed';
  const baseInputDevice = isMixedInputSource
    ? DEFAULT_ROLE_INPUT_DEVICE
    : normalizeRoleInputDevice(normalizedInputSource, DEFAULT_ROLE_INPUT_DEVICE);
  const resolvedAudioInputDevice = isMixedInputSource
    ? normalizeRoleInputDevice(audioInputDevice, baseInputDevice)
    : baseInputDevice;
  const resolvedVisionInputDevice = isMixedInputSource
    ? normalizeRoleInputDevice(visionInputDevice, baseInputDevice)
    : baseInputDevice;
  const resolvedOutputDevice = isMixedInputSource
    ? normalizeRoleInputDevice(outputDevice, baseInputDevice)
    : baseInputDevice;

  return {
    inputSource: normalizedInputSource,
    audioInputDevice: resolvedAudioInputDevice,
    visionInputDevice: resolvedVisionInputDevice,
    outputDevice: resolvedOutputDevice,
  };
}
