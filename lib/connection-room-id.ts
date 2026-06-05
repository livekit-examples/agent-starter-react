const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isValidConnectionRoomId(value: unknown): value is string {
  return typeof value === 'string' && UUID_PATTERN.test(value.trim());
}

export function resolveConnectionRoomId(
  body: unknown,
  createRoomId: () => string = () => crypto.randomUUID()
) {
  const candidate = readRoomIdCandidate(body);
  if (isValidConnectionRoomId(candidate)) {
    return candidate.trim();
  }

  return createRoomId();
}

function readRoomIdCandidate(body: unknown) {
  if (!body || typeof body !== 'object') {
    return undefined;
  }

  const record = body as Record<string, unknown>;
  return record.room_id ?? record.roomId;
}
