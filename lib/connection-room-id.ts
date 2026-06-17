const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const LIVEKIT_ROOM_PREFIX = 'voice_assistant_room_';

export function isValidConnectionRoomId(value: unknown): value is string {
  return typeof value === 'string' && UUID_PATTERN.test(value.trim());
}

export function deriveLiveKitRoomName(sessionId: string): string {
  return `${LIVEKIT_ROOM_PREFIX}${sessionId}`;
}

export function deriveSessionIdFromLiveKitRoomName(roomName: string | null | undefined): string {
  const normalizedRoomName = String(roomName ?? '').trim();
  if (!normalizedRoomName.startsWith(LIVEKIT_ROOM_PREFIX)) {
    return '';
  }

  const sessionId = normalizedRoomName.slice(LIVEKIT_ROOM_PREFIX.length);
  return isValidConnectionRoomId(sessionId) ? sessionId : '';
}

export function resolveConnectionSessionId(
  body: unknown,
  createSessionId: () => string = () => crypto.randomUUID()
) {
  const candidate = readRoomIdCandidate(body);
  if (isValidConnectionRoomId(candidate)) {
    return candidate.trim();
  }

  return createSessionId();
}

export function resolveConnectionRoomId(
  body: unknown,
  createRoomId: () => string = () => crypto.randomUUID()
) {
  return resolveConnectionSessionId(body, createRoomId);
}

function readRoomIdCandidate(body: unknown) {
  if (!body || typeof body !== 'object') {
    return undefined;
  }

  const record = body as Record<string, unknown>;
  return record.sessionId ?? record.session_id ?? record.room_id ?? record.roomId;
}
